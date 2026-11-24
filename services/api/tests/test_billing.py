"""Stripe entitlements: persisted tiers and credits, webhook verification, checkout."""
import json
import time
from typing import Any, Dict

import pytest
import stripe
from fastapi.testclient import TestClient

from app.core import billing
from app.core.entitlements import EntitlementRepository, PaymentRequired, ScanAccess, Tier
from conftest import (
    TEST_WEBHOOK_SECRET,
    USER_A,
    USER_B,
    bearer,
    checkout_completed_event,
    post_webhook,
    stripe_signature,
)

STATUS_URL = "/api/v1/billing/status"
CHECKOUT_URL = "/api/v1/billing/checkout"
WEBHOOK_URL = "/api/v1/billing/webhook"
COMPLETED = "checkout.session.completed"
DELETED = "customer.subscription.deleted"


def _status(client: TestClient, user: str) -> Dict[str, Any]:
    response = client.get(STATUS_URL, headers=bearer(user))
    assert response.status_code == 200, response.text
    return response.json()


def _subscription_deleted(subscription: str, customer: str, event_id: str = "evt_sub_deleted") -> Dict[str, Any]:
    return {
        "id": event_id,
        "type": DELETED,
        "data": {"object": {"id": subscription, "object": "subscription", "customer": customer, "metadata": {}}},
    }


# --- Repository -------------------------------------------------------------

@pytest.fixture
def repo() -> EntitlementRepository:
    return EntitlementRepository("sqlite+pysqlite:///:memory:")


def test_unknown_user_is_free_with_one_preview(repo: EntitlementRepository) -> None:
    entitlement = repo.get("nobody")
    assert entitlement.tier is Tier.FREE
    assert entitlement.credits_remaining == 0
    assert entitlement.free_preview_available is True
    assert entitlement.can_run_full_scan is False


def test_free_user_gets_exactly_one_preview(repo: EntitlementRepository) -> None:
    assert repo.authorize_scan("u1").access is ScanAccess.PREVIEW
    with pytest.raises(PaymentRequired):
        repo.authorize_scan("u1")
    assert repo.get("u1").free_preview_available is False
    # Another user is unaffected.
    assert repo.authorize_scan("u2").access is ScanAccess.PREVIEW


def test_credits_are_spent_one_per_full_scan_and_never_go_negative(repo: EntitlementRepository) -> None:
    assert repo.grant_checkout("evt_1", COMPLETED, "u1", Tier.PER_SCAN, credits=2, customer_id="cus_1")
    assert repo.authorize_scan("u1").access is ScanAccess.FULL
    assert repo.authorize_scan("u1").access is ScanAccess.FULL
    assert repo.get("u1").credits_remaining == 0
    # Out of credits: the unused free preview is all that is left, then nothing.
    assert repo.authorize_scan("u1").access is ScanAccess.PREVIEW
    with pytest.raises(PaymentRequired):
        repo.authorize_scan("u1")
    assert repo.get("u1").credits_remaining == 0


def test_refund_returns_the_consumed_credit(repo: EntitlementRepository) -> None:
    repo.grant_checkout("evt_1", COMPLETED, "u1", Tier.PER_SCAN, credits=1, customer_id="cus_1")
    grant = repo.authorize_scan("u1")
    assert repo.get("u1").credits_remaining == 0
    repo.refund(grant)
    assert repo.get("u1").credits_remaining == 1


def test_refund_returns_the_free_preview(repo: EntitlementRepository) -> None:
    grant = repo.authorize_scan("u1")
    repo.refund(grant)
    assert repo.get("u1").free_preview_available is True


def test_grant_is_idempotent_per_event_id(repo: EntitlementRepository) -> None:
    assert repo.grant_checkout("evt_1", COMPLETED, "u1", Tier.PER_SCAN, credits=1, customer_id="cus_1") is True
    assert repo.grant_checkout("evt_1", COMPLETED, "u1", Tier.PER_SCAN, credits=1, customer_id="cus_1") is False
    assert repo.get("u1").credits_remaining == 1
    assert repo.grant_checkout("evt_2", COMPLETED, "u1", Tier.PER_SCAN, credits=1, customer_id="cus_1") is True
    assert repo.get("u1").credits_remaining == 2


def test_subscription_gives_unlimited_full_scans_without_spending_credits(repo: EntitlementRepository) -> None:
    repo.grant_checkout("evt_1", COMPLETED, "u1", Tier.PER_SCAN, credits=3, customer_id="cus_1")
    repo.grant_checkout("evt_2", COMPLETED, "u1", Tier.PRO_MONTHLY, credits=0, customer_id="cus_1", subscription_id="sub_1")
    for _ in range(5):
        assert repo.authorize_scan("u1").access is ScanAccess.FULL
    entitlement = repo.get("u1")
    assert entitlement.tier is Tier.PRO_MONTHLY
    assert entitlement.subscription_active is True
    assert entitlement.credits_remaining == 3
    assert entitlement.stripe_customer_id == "cus_1"


def test_cancelling_a_subscription_downgrades_but_keeps_credits(repo: EntitlementRepository) -> None:
    repo.grant_checkout("evt_1", COMPLETED, "u1", Tier.PER_SCAN, credits=2, customer_id="cus_1")
    repo.grant_checkout("evt_2", COMPLETED, "u1", Tier.ENTERPRISE, credits=0, customer_id="cus_1", subscription_id="sub_1")
    assert repo.cancel_subscription("evt_3", DELETED, subscription_id="sub_1") is True
    entitlement = repo.get("u1")
    assert entitlement.tier is Tier.PER_SCAN
    assert entitlement.subscription_active is False
    assert entitlement.credits_remaining == 2


def test_cancelling_a_stale_subscription_does_not_downgrade(repo: EntitlementRepository) -> None:
    repo.grant_checkout("evt_1", COMPLETED, "u1", Tier.PRO_MONTHLY, credits=0, customer_id="cus_1", subscription_id="sub_new")
    repo.cancel_subscription("evt_2", DELETED, subscription_id="sub_old")
    assert repo.get("u1").tier is Tier.PRO_MONTHLY


# --- Webhook ----------------------------------------------------------------

def test_webhook_rejects_missing_or_invalid_signature(client: TestClient, live_billing: None) -> None:
    event = checkout_completed_event(USER_A, "per_scan")
    assert client.post(WEBHOOK_URL, json=event).status_code == 400
    assert client.post(WEBHOOK_URL, json=event, headers={"Stripe-Signature": "t=1,v1=deadbeef"}).status_code == 400
    assert post_webhook(client, event, secret="whsec_some_other_secret_000000000000").status_code == 400
    # A correctly signed but stale payload is a replay.
    assert post_webhook(client, event, timestamp=int(time.time()) - 3600).status_code == 400


def test_webhook_rejects_a_tampered_payload(client: TestClient, paid_env: None) -> None:
    original = json.dumps(checkout_completed_event(USER_A, "per_scan")).encode()
    tampered = original.replace(USER_A.encode(), USER_B.encode())
    response = client.post(WEBHOOK_URL, content=tampered, headers={"Stripe-Signature": stripe_signature(original)})
    assert response.status_code == 400
    assert _status(client, USER_B)["credits_remaining"] == 0


def test_checkout_completed_grants_a_scan_credit_once(client: TestClient, paid_env: None) -> None:
    event = checkout_completed_event(USER_A, "per_scan", event_id="evt_credit")
    assert post_webhook(client, event).status_code == 200
    status = _status(client, USER_A)
    assert status["tier"] == "per_scan"
    assert status["credits_remaining"] == 1
    assert status["can_run_full_scan"] is True
    assert status["is_mock"] is False

    # Stripe retries deliveries: the same event must not grant twice.
    replay = post_webhook(client, event)
    assert replay.status_code == 200
    assert _status(client, USER_A)["credits_remaining"] == 1
    assert _status(client, USER_B)["credits_remaining"] == 0


def test_checkout_completed_activates_subscription(client: TestClient, paid_env: None) -> None:
    event = checkout_completed_event(USER_A, "pro_monthly", event_id="evt_sub", subscription="sub_123")
    assert post_webhook(client, event).status_code == 200
    status = _status(client, USER_A)
    assert status["tier"] == "pro_monthly"
    assert status["subscription_active"] is True

    enterprise = checkout_completed_event(
        USER_B, "enterprise_monthly", event_id="evt_ent", subscription="sub_456", customer="cus_b"
    )
    assert post_webhook(client, enterprise).status_code == 200
    assert _status(client, USER_B)["tier"] == "enterprise"


def test_subscription_deleted_downgrades_to_free(client: TestClient, paid_env: None) -> None:
    post_webhook(client, checkout_completed_event(USER_A, "pro_monthly", event_id="evt_sub", subscription="sub_123"))
    assert post_webhook(client, _subscription_deleted("sub_123", "cus_test_1")).status_code == 200
    status = _status(client, USER_A)
    assert status["tier"] == "free"
    assert status["subscription_active"] is False
    assert status["can_run_full_scan"] is False


def test_unpaid_checkout_grants_nothing_until_payment_succeeds(client: TestClient, paid_env: None) -> None:
    unpaid = checkout_completed_event(USER_A, "per_scan", event_id="evt_unpaid", payment_status="unpaid")
    assert post_webhook(client, unpaid).status_code == 200
    assert _status(client, USER_A)["credits_remaining"] == 0

    paid_later = checkout_completed_event(
        USER_A, "per_scan", event_id="evt_async", event_type="checkout.session.async_payment_succeeded"
    )
    assert post_webhook(client, paid_later).status_code == 200
    assert _status(client, USER_A)["credits_remaining"] == 1


def _unknown_tier(session: Dict[str, Any]) -> None:
    session["metadata"]["tier"] = "platinum"


def _mode_mismatch(session: Dict[str, Any]) -> None:
    session["mode"] = "subscription"  # per_scan must be a one-off payment


def _no_user(session: Dict[str, Any]) -> None:
    session["client_reference_id"] = None
    session["metadata"].pop("user_id")


@pytest.mark.parametrize("mutate", [_unknown_tier, _mode_mismatch, _no_user])
def test_malformed_checkout_events_grant_nothing(client: TestClient, paid_env: None, mutate: Any) -> None:
    event = checkout_completed_event(USER_A, "per_scan", event_id="evt_bad")
    mutate(event["data"]["object"])
    assert post_webhook(client, event).status_code == 200
    assert _status(client, USER_A)["credits_remaining"] == 0


def test_unrelated_events_are_acknowledged(client: TestClient, live_billing: None) -> None:
    response = post_webhook(client, {"id": "evt_other", "type": "invoice.paid", "data": {"object": {}}})
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


def test_webhook_never_grants_in_mock_mode(client: TestClient, auth_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MOCK_BILLING", "true")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET)
    response = post_webhook(client, checkout_completed_event(USER_A, "per_scan"))
    assert response.status_code == 200
    assert response.json()["status"] == "ignored"
    monkeypatch.setenv("MOCK_BILLING", "false")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_unit0123456789abcdefghijklmnop")
    assert _status(client, USER_A)["credits_remaining"] == 0


# --- Checkout ---------------------------------------------------------------

def test_live_checkout_requires_sign_in(client: TestClient, paid_env: None) -> None:
    assert client.post(CHECKOUT_URL, json={"tier": "pro_monthly"}).status_code == 401


def test_live_checkout_creates_a_session_bound_to_the_user(
    client: TestClient, paid_env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: Dict[str, Any] = {}

    def fake_create(self: billing.BillingService, params: Dict[str, Any], api_key: str) -> billing.CheckoutSession:
        captured.update(params)
        return billing.CheckoutSession(id="cs_live_1", url="https://checkout.stripe.com/c/pay/cs_live_1")

    monkeypatch.setattr(billing.BillingService, "_create_stripe_session", fake_create)
    monkeypatch.setenv("CORS_ORIGINS", "https://app.trustcore.test")
    response = client.post(
        CHECKOUT_URL,
        json={"tier": "pro_monthly", "success_url": "https://app.trustcore.test/?billing=success"},
        headers=bearer(USER_A),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["checkout_url"] == "https://checkout.stripe.com/c/pay/cs_live_1"
    assert body["session_id"] == "cs_live_1"
    assert body["is_mock"] is False
    assert captured["mode"] == "subscription"
    assert captured["client_reference_id"] == USER_A
    assert captured["metadata"] == {"user_id": USER_A, "tier": "pro_monthly"}
    assert captured["subscription_data"] == {"metadata": {"user_id": USER_A}}
    assert captured["success_url"] == "https://app.trustcore.test/?billing=success&session_id={CHECKOUT_SESSION_ID}"
    assert captured["cancel_url"].startswith("https://app.trustcore.test/")


@pytest.mark.parametrize("field", ["success_url", "cancel_url"])
def test_checkout_rejects_redirects_to_foreign_origins(
    client: TestClient, paid_env: None, monkeypatch: pytest.MonkeyPatch, field: str
) -> None:
    def must_not_run(self: billing.BillingService, params: Dict[str, Any], api_key: str) -> billing.CheckoutSession:
        raise AssertionError("checkout must be rejected before reaching Stripe")

    monkeypatch.setenv("CORS_ORIGINS", "https://app.trustcore.test")
    monkeypatch.setattr(billing.BillingService, "_create_stripe_session", must_not_run)
    response = client.post(
        CHECKOUT_URL, json={"tier": "per_scan", field: "https://evil.example/phish"}, headers=bearer(USER_A)
    )
    assert response.status_code == 400


def test_stripe_failure_is_reported_not_faked(client: TestClient, paid_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    def failing(self: billing.BillingService, params: Dict[str, Any], api_key: str) -> billing.CheckoutSession:
        raise stripe.APIConnectionError("network down")

    monkeypatch.setattr(billing.BillingService, "_create_stripe_session", failing)
    response = client.post(CHECKOUT_URL, json={"tier": "per_scan"}, headers=bearer(USER_A))
    assert response.status_code == 503
    assert "mock" not in response.text.lower()
    assert _status(client, USER_A)["credits_remaining"] == 0


def test_status_for_signed_out_visitor_is_free_tier(client: TestClient, paid_env: None) -> None:
    response = client.get(STATUS_URL)
    assert response.status_code == 200
    assert response.json() == {
        "tier": "free",
        "credits_remaining": 0,
        "is_mock": False,
        "subscription_active": False,
        "free_preview_available": True,
        "can_run_full_scan": False,
    }


# --- Configuration ----------------------------------------------------------

def test_mock_billing_is_refused_outside_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("MOCK_BILLING", "true")
    with pytest.raises(RuntimeError, match="MOCK_BILLING"):
        billing.validate_billing_config()


def test_production_defaults_to_live_billing_and_requires_stripe_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("MOCK_BILLING", raising=False)
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    assert billing.load_billing_settings().mock is False
    with pytest.raises(RuntimeError, match="STRIPE"):
        billing.validate_billing_config()
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_mock_secret_key_12345")  # the .env.example placeholder
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET)
    with pytest.raises(RuntimeError, match="STRIPE"):
        billing.validate_billing_config()
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_live_" + "unit0123456789abcdefghijklmnop")
    billing.validate_billing_config()


def test_development_defaults_to_mock_billing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.delenv("MOCK_BILLING", raising=False)
    assert billing.load_billing_settings().mock is True


def test_placeholder_webhook_secret_is_never_trusted(client: TestClient, paid_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    placeholder = "whsec_mock_webhook_secret_67890"  # shipped in .env.example, therefore public
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", placeholder)
    forged = post_webhook(client, checkout_completed_event(USER_A, "pro_monthly", subscription="sub_x"), secret=placeholder)
    assert forged.status_code == 503
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET)
    assert _status(client, USER_A)["tier"] == "free"

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_live_" + "unit0123456789abcdefghijklmnop")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", placeholder)
    with pytest.raises(RuntimeError, match="STRIPE"):
        billing.validate_billing_config()


def test_stripe_test_keys_need_explicit_opt_in_outside_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("MOCK_BILLING", raising=False)
    monkeypatch.delenv("STRIPE_ALLOW_TEST_MODE", raising=False)
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET)
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_unit0123456789abcdefghijklmnop")
    with pytest.raises(RuntimeError, match="test"):
        billing.validate_billing_config()
    monkeypatch.setenv("STRIPE_ALLOW_TEST_MODE", "true")  # e.g. a staging environment
    billing.validate_billing_config()
    monkeypatch.delenv("STRIPE_ALLOW_TEST_MODE")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_live_" + "unit0123456789abcdefghijklmnop")
    billing.validate_billing_config()
