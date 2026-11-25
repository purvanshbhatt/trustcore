"""Public sample audit: a real engine report on bundled demo inputs, with no login and no cost."""
from types import SimpleNamespace
from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

from app.core import billing
from app.core.engine import get_engine
from app.core.explainer import LLMExplainer
from app.core.ratelimit import limiter
from app.core.storage import get_storage
from app.routers import scans
from conftest import USER_A, bearer

SAMPLE_SECRET = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d"  # ships in the bundled demo app


@pytest.fixture(autouse=True)
def _fresh_sample_cache() -> None:
    scans.clear_sample_report_cache()


def test_sample_report_is_public_full_and_redacted(client: TestClient, paid_env: None) -> None:
    response = client.get("/api/v1/samples/launchgate/report")  # no token, live billing, auth required elsewhere
    assert response.status_code == 200, response.text
    report = response.json()

    assert report["id"] == "sample_launchgate"
    assert report["metadata"]["is_sample"] is True
    assert report["metadata"]["access"] == "full"
    assert len(report["findings"]) > 2
    assert all(f["citation"]["snippet"] for f in report["findings"])
    assert report["remediation_prompts"]
    assert report["summary"]["readiness_status"] == "BLOCKED"
    assert SAMPLE_SECRET not in response.text
    assert "sk-p****2c1d" in response.text


@pytest.mark.parametrize(
    "product,detail_field",
    [("agentscope", "permission_diff"), ("evidence", "evidence_matrix"), ("evalkit", "eval_results")],
)
def test_every_product_has_a_sample_report(client: TestClient, paid_env: None, product: str, detail_field: str) -> None:
    report = client.get(f"/api/v1/samples/{product}/report").json()
    assert report["product"] == product
    assert report["id"] == f"sample_{product}"
    assert report[detail_field]


def test_unknown_product_is_rejected(client: TestClient) -> None:
    assert client.get("/api/v1/samples/not-a-product/report").status_code == 422


def test_sample_report_is_never_stored_and_costs_the_visitor_nothing(client: TestClient, paid_env: None) -> None:
    for _ in range(3):
        assert client.get("/api/v1/samples/launchgate/report").status_code == 200

    # Not saved under any account.
    assert client.get("/api/v1/reports/sample_launchgate", headers=bearer(USER_A)).status_code == 404
    assert get_storage().list_reports("sample") == []
    listed = client.get("/api/v1/reports?limit=100", headers=bearer(USER_A)).json()
    assert not [r for r in listed if r["id"].startswith("sample_")]
    # The visitor's one free preview is untouched.
    assert client.get("/api/v1/billing/status").json()["free_preview_available"] is True
    scan = client.post(
        "/api/v1/run/launchgate",
        json={"product": "launchgate", "files": [{"filename": "a.sql", "content": "CREATE POLICY p ON t USING (true);"}]},
    )
    assert scan.status_code == 200
    assert scan.json()["metadata"]["access"] == "preview"


def test_sample_report_is_computed_once_and_not_rate_limited(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = get_engine()
    calls = {"count": 0}
    original = engine.run_scan

    def counting(*args: Any, **kwargs: Any) -> Any:
        calls["count"] += 1
        return original(*args, **kwargs)

    monkeypatch.setattr(engine, "run_scan", counting)
    monkeypatch.setenv("RATE_LIMIT_SCAN", "2/minute")
    limiter.reset()
    limiter.enabled = True
    try:
        bodies = [client.get("/api/v1/samples/launchgate/report") for _ in range(12)]
    finally:
        limiter.enabled = False
        limiter.reset()

    assert [r.status_code for r in bodies] == [200] * 12
    assert calls["count"] == 1
    assert len({r.text for r in bodies}) == 1


def test_sample_report_never_calls_the_model(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    fake = SimpleNamespace(models=SimpleNamespace(generate_content=lambda **kwargs: calls.append(kwargs)))
    monkeypatch.setenv("LLM_EXPLAINER_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "unit-test-key")
    monkeypatch.setattr(get_engine(), "explainer", LLMExplainer(gemini_client=fake))
    report = client.get("/api/v1/samples/launchgate/report").json()
    assert calls == []
    assert report["metadata"]["explainer"] == {"provider": "deterministic"}


# --- Checkout returns to the dashboard --------------------------------------

def test_mock_checkout_returns_to_the_dashboard(client: TestClient) -> None:
    response = client.post("/api/v1/billing/checkout", json={"tier": "per_scan"})
    assert response.status_code == 200
    assert response.json()["checkout_url"].startswith("http://localhost:3000/dashboard?billing=success&session_id=")


def test_live_checkout_defaults_return_to_the_dashboard(
    client: TestClient, paid_env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: Dict[str, Any] = {}

    def fake_create(self: billing.BillingService, params: Dict[str, Any], api_key: str) -> billing.CheckoutSession:
        captured.update(params)
        return billing.CheckoutSession(id="cs_live_2", url="https://checkout.stripe.com/c/pay/cs_live_2")

    monkeypatch.setattr(billing.BillingService, "_create_stripe_session", fake_create)
    monkeypatch.setenv("CORS_ORIGINS", "https://app.trustcore.test")
    assert client.post("/api/v1/billing/checkout", json={"tier": "per_scan"}, headers=bearer(USER_A)).status_code == 200
    assert captured["success_url"] == "https://app.trustcore.test/dashboard?billing=success&session_id={CHECKOUT_SESSION_ID}"
    assert captured["cancel_url"] == "https://app.trustcore.test/dashboard?billing=cancelled"


# --- Proxy hop diagnostic ----------------------------------------------------

def test_health_reports_how_many_forwarding_hops_it_saw(client: TestClient) -> None:
    assert client.get("/health").json()["forwarded_for_entries"] == 0
    seen = client.get("/health", headers={"X-Forwarded-For": "203.0.113.5, 198.51.100.7"}).json()
    assert seen["forwarded_for_entries"] == 2
    # Only the count is exposed, never the addresses.
    assert "203.0.113.5" not in str(seen)
