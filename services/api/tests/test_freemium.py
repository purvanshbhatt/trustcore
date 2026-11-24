"""Freemium gate: one free preview, full reports only for paying users (enforced server-side)."""
from typing import Any, Dict, List

import pytest
from fastapi.testclient import TestClient

from app.core.engine import get_engine
from app.main import app
from conftest import USER_A, USER_B, bearer, checkout_completed_event, post_webhook

SECRET = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d"
FILES: List[Dict[str, str]] = [
    {"filename": "src/api.ts", "content": f'const OPENAI_API_KEY = "{SECRET}";\n'},
    {"filename": "schema.sql", "content": 'CREATE POLICY "p" ON t FOR ALL USING (true);\n'},
    {"filename": ".env.production", "content": "STRIPE_SECRET_KEY=sk_test_51M0CKSTRIPEKEY99283746152433\n"},
    {"filename": "package.json", "content": '{"dependencies": {"react-domm": "^18.2.0"}}\n'},
]
TOTAL_FINDINGS = 4  # three CRITICAL (two secrets, open RLS) and one HIGH (typosquat)
STATUS_URL = "/api/v1/billing/status"


def _scan(client: TestClient, product: str = "launchgate", headers: Dict[str, str] | None = None, **extra: Any) -> Any:
    files = FILES if product == "launchgate" else client.get(f"/api/v1/samples/{product}").json()["files"]
    return client.post(
        f"/api/v1/run/{product}",
        json={"product": product, "project_name": "Gate", "files": files, **extra},
        headers=headers or {},
    )


def _grant(client: TestClient, user: str, tier: str = "per_scan", event_id: str = "evt_grant", **kwargs: Any) -> None:
    assert post_webhook(client, checkout_completed_event(user, tier, event_id=event_id, **kwargs)).status_code == 200


def _assert_preview(report: Dict[str, Any]) -> None:
    assert report["metadata"]["access"] == "preview"
    assert len(report["findings"]) == 2
    assert {f["severity"] for f in report["findings"]} == {"CRITICAL"}
    for finding in report["findings"]:
        assert finding["citation"]["file_path"]
        assert finding["citation"]["snippet"] == ""
        assert finding["citation"]["line_start"] is None
        assert finding["citation"]["line_end"] is None
        assert finding["remediation_prompt"] is None
    assert report["remediation_prompts"] == []
    # The score and counts describe the whole scan, not just the two visible findings.
    assert report["summary"]["total_findings"] == TOTAL_FINDINGS
    assert report["summary"]["critical_count"] == 3
    assert report["summary"]["readiness_status"] == "BLOCKED"
    assert report["metadata"]["locked"]["hidden_findings"] == TOTAL_FINDINGS - 2
    assert "citations" in report["metadata"]["locked"]["features"]


def _assert_full(report: Dict[str, Any]) -> None:
    assert report["metadata"]["access"] == "full"
    assert len(report["findings"]) == TOTAL_FINDINGS
    assert all(f["citation"]["snippet"] for f in report["findings"])
    assert all(f["citation"]["line_start"] for f in report["findings"])
    assert report["remediation_prompts"]
    assert "locked" not in report["metadata"]


# --- Anonymous visitors -----------------------------------------------------

def test_anonymous_visitor_gets_one_preview_then_must_pay(client: TestClient, paid_env: None) -> None:
    first = _scan(client)
    assert first.status_code == 200, first.text
    _assert_preview(first.json())
    assert SECRET not in first.text
    assert "sk-p" not in first.text  # not even the masked value: that is citation evidence

    second = _scan(client)
    assert second.status_code == 402
    assert "findings" not in second.json()
    assert isinstance(second.json()["detail"], str)

    status = client.get(STATUS_URL).json()
    assert status["free_preview_available"] is False
    assert status["can_run_full_scan"] is False


def test_anonymous_preview_is_never_stored(client: TestClient, paid_env: None) -> None:
    report = _scan(client).json()
    assert report["metadata"]["ephemeral"] is True
    assert client.get(f"/api/v1/reports/{report['id']}").status_code == 401
    assert client.get(f"/api/v1/reports/{report['id']}", headers=bearer(USER_A)).status_code == 404


def test_anonymous_previews_are_tracked_per_client_ip(
    client: TestClient, paid_env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    first_ip = {"X-Forwarded-For": "203.0.113.10"}
    second_ip = {"X-Forwarded-For": "203.0.113.20"}
    assert _scan(client, headers=first_ip).status_code == 200
    assert _scan(client, headers=first_ip).status_code == 402
    assert _scan(client, headers=second_ip).status_code == 200
    # Prepending a forged address does not mint a fresh preview.
    assert _scan(client, headers={"X-Forwarded-For": "198.51.100.99, 203.0.113.10"}).status_code == 402


def test_anonymous_visitor_can_ingest_files(client: TestClient, paid_env: None) -> None:
    response = client.post(
        "/api/v1/ingest/upload",
        files=[("files", ("a.ts", b"const a = 1;", "text/plain"))],
        data={"product": "launchgate"},
    )
    assert response.status_code == 200


# --- Signed-in free users ---------------------------------------------------

def test_signed_in_free_user_gets_one_stored_preview(client: TestClient, paid_env: None) -> None:
    first = _scan(client, headers=bearer(USER_A))
    assert first.status_code == 200
    report = first.json()
    _assert_preview(report)

    stored = client.get(f"/api/v1/reports/{report['id']}", headers=bearer(USER_A))
    assert stored.status_code == 200
    _assert_preview(stored.json())

    assert _scan(client, headers=bearer(USER_A)).status_code == 402
    # Another account still has its own preview.
    assert _scan(client, headers=bearer(USER_B)).status_code == 200


@pytest.mark.parametrize(
    "product,detail_field", [("agentscope", "permission_diff"), ("evidence", "evidence_matrix"), ("evalkit", "eval_results")]
)
def test_preview_withholds_product_detail_views(client: TestClient, paid_env: None, product: str, detail_field: str) -> None:
    report = _scan(client, product, headers=bearer(USER_A)).json()
    assert report["metadata"]["access"] == "preview"
    assert report[detail_field] is None
    assert len(report["findings"]) <= 2
    assert report["remediation_prompts"] == []
    assert "detail_views" in report["metadata"]["locked"]["features"]


def test_zero_retention_preview_is_not_stored(client: TestClient, paid_env: None) -> None:
    report = _scan(client, headers=bearer(USER_A), ephemeral=True).json()
    assert report["metadata"]["access"] == "preview"
    assert client.get(f"/api/v1/reports/{report['id']}", headers=bearer(USER_A)).status_code == 404


# --- Paying users -----------------------------------------------------------

def test_scan_credit_unlocks_one_full_report(client: TestClient, paid_env: None) -> None:
    _grant(client, USER_A)
    first = _scan(client, headers=bearer(USER_A))
    assert first.status_code == 200
    _assert_full(first.json())
    assert SECRET not in first.text  # paying never disables redaction
    assert client.get(STATUS_URL, headers=bearer(USER_A)).json()["credits_remaining"] == 0

    # Credit spent: the account falls back to its unused free preview, then to the paywall.
    _assert_preview(_scan(client, headers=bearer(USER_A)).json())
    assert _scan(client, headers=bearer(USER_A)).status_code == 402


def test_stored_full_report_stays_full_for_its_owner(client: TestClient, paid_env: None) -> None:
    _grant(client, USER_A)
    report_id = _scan(client, headers=bearer(USER_A)).json()["id"]
    _assert_full(client.get(f"/api/v1/reports/{report_id}", headers=bearer(USER_A)).json())
    assert client.get(f"/api/v1/reports/{report_id}", headers=bearer(USER_B)).status_code == 404


def test_subscription_unlocks_unlimited_full_reports(client: TestClient, paid_env: None) -> None:
    _grant(client, USER_A, "pro_monthly", subscription="sub_1")
    for _ in range(3):
        response = _scan(client, headers=bearer(USER_A))
        assert response.status_code == 200
        _assert_full(response.json())


def test_zero_retention_full_scan_spends_a_credit_and_stores_nothing(client: TestClient, paid_env: None) -> None:
    _grant(client, USER_A)
    report = _scan(client, headers=bearer(USER_A), ephemeral=True).json()
    _assert_full(report)
    assert client.get(f"/api/v1/reports/{report['id']}", headers=bearer(USER_A)).status_code == 404
    assert client.get(STATUS_URL, headers=bearer(USER_A)).json()["credits_remaining"] == 0


def test_failed_scan_refunds_the_credit(paid_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app, raise_server_exceptions=False)
    _grant(client, USER_A)

    def explode(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("rule pack crashed")

    engine = get_engine()
    monkeypatch.setattr(engine.rule_packs[next(iter(engine.rule_packs))], "run", explode)
    assert _scan(client, headers=bearer(USER_A)).status_code == 500
    assert client.get(STATUS_URL, headers=bearer(USER_A)).json()["credits_remaining"] == 1


# --- Local development ------------------------------------------------------

def test_mock_billing_gives_full_reports_without_limits(client: TestClient) -> None:
    for _ in range(3):
        response = _scan(client)
        assert response.status_code == 200
        _assert_full(response.json())
