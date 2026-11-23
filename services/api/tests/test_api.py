import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.schemas import ProductType

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
