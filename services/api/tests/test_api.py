import json

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.schemas import ProductType
from conftest import USER_A, USER_B, bearer, checkout_completed_event, post_webhook, stripe_signature

client = TestClient(app)


def test_healthcheck():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Dual-Engine" in data["architecture"]


def test_launchgate_sample_and_scan():
    # 1. Fetch sample
    sample_res = client.get("/api/v1/samples/launchgate")
    assert sample_res.status_code == 200
    sample = sample_res.json()
    assert "files" in sample
    assert len(sample["files"]) > 0

    # 2. Run scan
    scan_res = client.post(
        "/api/v1/run/launchgate",
        json={
            "product": "launchgate",
            "project_name": "Test App",
            "files": sample["files"]
        }
    )
    assert scan_res.status_code == 200
    report = scan_res.json()
    assert report["product"] == "launchgate"
    assert report["summary"]["critical_count"] > 0
    assert report["summary"]["readiness_status"] == "BLOCKED"
    assert len(report["findings"]) > 0
    assert len(report["remediation_prompts"]) > 0

    # 3. Retrieve report
    report_id = report["id"]
    get_res = client.get(f"/api/v1/reports/{report_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == report_id


def test_agentscope_scan_and_diff():
    sample_res = client.get("/api/v1/samples/agentscope")
    assert sample_res.status_code == 200
    sample = sample_res.json()

    scan_res = client.post(
        "/api/v1/run/agentscope",
        json={
            "product": "agentscope",
            "project_name": "MCP Workstation Test",
            "files": sample["files"]
        }
    )
    assert scan_res.status_code == 200
    report = scan_res.json()
    assert report["product"] == "agentscope"
    assert report["permission_diff"] is not None
    assert len(report["permission_diff"]) > 0
    # Blast radius reduction check
    assert report["metadata"]["blast_radius_reduction_pct"] > 0


def test_evidence_to_answer_gap_flagging():
    sample_res = client.get("/api/v1/samples/evidence")
    assert sample_res.status_code == 200
    sample = sample_res.json()

    scan_res = client.post(
        "/api/v1/run/evidence",
        json={
            "product": "evidence",
            "project_name": "SOC 2 Questionnaire Test",
            "files": sample["files"]
        }
    )
    assert scan_res.status_code == 200
    report = scan_res.json()
    assert report["product"] == "evidence"
    assert report["evidence_matrix"] is not None
    
    # Check that unsupported gaps are explicitly flagged
    statuses = [item["status"] for item in report["evidence_matrix"]]
    assert "VERIFIED_EVIDENCE" in statuses
    assert "UNSUPPORTED_GAP" in statuses


def test_evalkit_adversarial_suite():
    sample_res = client.get("/api/v1/samples/evalkit")
    assert sample_res.status_code == 200
    sample = sample_res.json()

    scan_res = client.post(
        "/api/v1/run/evalkit",
        json={
            "product": "evalkit",
            "project_name": "SupportBot Guardrail Test",
            "files": sample["files"]
        }
    )
    assert scan_res.status_code == 200
    report = scan_res.json()
    assert report["product"] == "evalkit"
    assert report["eval_results"] is not None
    assert len(report["eval_results"]) == 5


# --- Phase 2: isolation, redaction, freemium gate, webhooks -----------------
# Focused end-to-end checks. The exhaustive cases live in test_auth_isolation.py,
# test_redaction.py, test_freemium.py, and test_billing.py.

LEAKY_FILES = [
    {"filename": "src/api.ts", "content": 'const OPENAI_API_KEY = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d";\n'},
    {"filename": "schema.sql", "content": 'CREATE POLICY "p" ON t FOR ALL USING (true);\n'},
    {"filename": "package.json", "content": '{"dependencies": {"react-domm": "^18.2.0"}}\n'},
]
RAW_SECRET = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d"


def _run_leaky_scan(headers=None):
    return client.post(
        "/api/v1/run/launchgate",
        json={"product": "launchgate", "project_name": "Phase 2", "files": LEAKY_FILES},
        headers=headers or {},
    )


def test_ownership_isolation(auth_env):
    report_id = _run_leaky_scan(bearer(USER_A)).json()["id"]

    # The owner can read and list the report; another account cannot see that it exists.
    assert client.get(f"/api/v1/reports/{report_id}", headers=bearer(USER_A)).status_code == 200
    assert client.get(f"/api/v1/reports/{report_id}", headers=bearer(USER_B)).status_code == 404
    assert report_id in [r["id"] for r in client.get("/api/v1/reports", headers=bearer(USER_A)).json()]
    assert report_id not in [r["id"] for r in client.get("/api/v1/reports", headers=bearer(USER_B)).json()]

    # Only the owner can delete it, and signed-out callers get nothing.
    assert client.delete(f"/api/v1/reports/{report_id}", headers=bearer(USER_B)).status_code == 404
    assert client.get(f"/api/v1/reports/{report_id}").status_code == 401
    assert client.delete(f"/api/v1/reports/{report_id}", headers=bearer(USER_A)).status_code == 204
    assert client.get(f"/api/v1/reports/{report_id}", headers=bearer(USER_A)).status_code == 404


def test_secret_redaction():
    scan = _run_leaky_scan()
    assert scan.status_code == 200
    stored = client.get(f"/api/v1/reports/{scan.json()['id']}")

    # The live key never appears in the response or in the stored report: only its mask does.
    for body in (scan.text, stored.text):
        assert RAW_SECRET not in body
        assert "sk-p****2c1d" in body
    secret_finding = next(f for f in scan.json()["findings"] if f["rule_id"] == "LG-SEC-001")
    assert secret_finding["citation"]["snippet"] == 'const OPENAI_API_KEY = "sk-p****2c1d";'


def test_freemium_gating(paid_env):
    # Signed-out visitor: one preview with the overall score and the top 2 findings only.
    preview = _run_leaky_scan()
    assert preview.status_code == 200
    report = preview.json()
    assert report["metadata"]["access"] == "preview"
    assert 0 <= report["summary"]["risk_score"] <= 100
    assert report["summary"]["total_findings"] == 3
    assert len(report["findings"]) == 2
    assert all(f["citation"]["snippet"] == "" and f["citation"]["line_start"] is None for f in report["findings"])
    assert report["remediation_prompts"] == []
    assert report["metadata"]["locked"]["hidden_findings"] == 1

    # The second scan is refused until the visitor pays.
    assert _run_leaky_scan().status_code == 402

    # A signed-in user who has paid gets the full report: citations and fix prompts.
    assert post_webhook(client, checkout_completed_event(USER_A, "per_scan", event_id="evt_api_gate")).status_code == 200
    full = _run_leaky_scan(bearer(USER_A)).json()
    assert full["metadata"]["access"] == "full"
    assert len(full["findings"]) == 3
    assert all(f["citation"]["snippet"] and f["citation"]["line_start"] for f in full["findings"])
    assert full["remediation_prompts"]
    assert RAW_SECRET not in json.dumps(full)


def test_webhook_handling(paid_env):
    event = checkout_completed_event(USER_A, "per_scan", event_id="evt_api_webhook")
    payload = json.dumps(event).encode()

    # Unsigned and wrongly signed events are rejected and grant nothing.
    assert client.post("/api/v1/billing/webhook", content=payload).status_code == 400
    forged = client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"Stripe-Signature": stripe_signature(payload, secret="whsec_attacker_guess_0000000000000")},
    )
    assert forged.status_code == 400
    assert client.get("/api/v1/billing/status", headers=bearer(USER_A)).json()["credits_remaining"] == 0

    # A genuine checkout.session.completed grants exactly one credit, even when re-delivered.
    assert post_webhook(client, event).status_code == 200
    assert post_webhook(client, event).status_code == 200
    status = client.get("/api/v1/billing/status", headers=bearer(USER_A)).json()
    assert (status["tier"], status["credits_remaining"], status["is_mock"]) == ("per_scan", 1, False)

    # A subscription activates, then customer.subscription.deleted ends it.
    subscribed = checkout_completed_event(USER_B, "pro_monthly", event_id="evt_api_sub", subscription="sub_api", customer="cus_api")
    assert post_webhook(client, subscribed).status_code == 200
    assert client.get("/api/v1/billing/status", headers=bearer(USER_B)).json()["subscription_active"] is True
    deleted = {
        "id": "evt_api_sub_deleted",
        "type": "customer.subscription.deleted",
        "data": {"object": {"id": "sub_api", "object": "subscription", "customer": "cus_api"}},
    }
    assert post_webhook(client, deleted).status_code == 200
    after = client.get("/api/v1/billing/status", headers=bearer(USER_B)).json()
    assert (after["tier"], after["subscription_active"]) == ("free", False)


def test_billing_checkout_and_status():
    # Test status
    status_res = client.get("/api/v1/billing/status")
    assert status_res.status_code == 200
    assert "credits_remaining" in status_res.json()

    # Test checkout
    checkout_res = client.post(
        "/api/v1/billing/checkout",
        json={"tier": "pro_monthly"}
    )
    assert checkout_res.status_code == 200
    data = checkout_res.json()
    assert "checkout_url" in data
    assert data["is_mock"] is True
