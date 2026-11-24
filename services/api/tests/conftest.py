"""Shared pytest configuration: isolated in-memory database and auth helpers."""
import os
import time
from typing import Any, Callable, Dict, Iterator, Optional

# Must be set before the app (and its lazily-built storage) is first used, so
# the suite never writes reports to disk.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("ENVIRONMENT", "test")
# Most tests fire many requests from one client; rate limiting has its own tests.
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")

import hashlib  # noqa: E402
import hmac  # noqa: E402
import json  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from app.core import db  # noqa: E402
from app.main import app  # noqa: E402

TEST_JWT_SECRET = "unit-test-jwt-secret-0123456789-abcdefghijklmnopqrstuvwxyz"
TEST_WEBHOOK_SECRET = "whsec_unit_test_0123456789abcdefghijklmnop"
USER_A = "11111111-1111-4111-8111-111111111111"
USER_B = "22222222-2222-4222-8222-222222222222"


@pytest.fixture(autouse=True)
def _clean_billing_tables() -> Iterator[None]:
    """Entitlements are keyed by user and by client IP; start every test from a clean slate."""
    engine = db.get_engine()
    db.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(delete(db.entitlements_table))
        connection.execute(delete(db.stripe_events_table))
    yield


def stripe_signature(payload: bytes, secret: str = TEST_WEBHOOK_SECRET, timestamp: Optional[int] = None) -> str:
    """Build a ``Stripe-Signature`` header exactly as Stripe signs webhook payloads."""
    signed_at = int(time.time()) if timestamp is None else timestamp
    digest = hmac.new(secret.encode(), f"{signed_at}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={signed_at},v1={digest}"


def post_webhook(client: TestClient, event: Dict[str, Any], **signature_kwargs: Any) -> Any:
    """POST a signed Stripe event to the webhook endpoint."""
    payload = json.dumps(event).encode()
    return client.post(
        "/api/v1/billing/webhook",
        content=payload,
        headers={"Stripe-Signature": stripe_signature(payload, **signature_kwargs), "Content-Type": "application/json"},
    )


def checkout_completed_event(
    user_id: str,
    tier: str,
    *,
    event_id: str = "evt_test_1",
    payment_status: str = "paid",
    customer: str = "cus_test_1",
    subscription: Optional[str] = None,
    event_type: str = "checkout.session.completed",
) -> Dict[str, Any]:
    """A minimal ``checkout.session.completed`` event as Stripe would send it."""
    mode = "payment" if tier == "per_scan" else "subscription"
    return {
        "id": event_id,
        "object": "event",
        "type": event_type,
        "data": {
            "object": {
                "id": f"cs_test_{event_id}",
                "object": "checkout.session",
                "mode": mode,
                "payment_status": payment_status,
                "client_reference_id": user_id,
                "customer": customer,
                "subscription": subscription if mode == "subscription" else None,
                "metadata": {"user_id": user_id, "tier": tier},
            }
        },
    }


@pytest.fixture
def live_billing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Real (non-mock) billing with test Stripe credentials; no network is used."""
    monkeypatch.setenv("MOCK_BILLING", "false")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_unit0123456789abcdefghijklmnop")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", TEST_WEBHOOK_SECRET)
    monkeypatch.setenv("STRIPE_PRICE_ID_PER_SCAN", "price_unit_per_scan")
    monkeypatch.setenv("STRIPE_PRICE_ID_PRO", "price_unit_pro")
    monkeypatch.setenv("STRIPE_PRICE_ID_ENTERPRISE", "price_unit_enterprise")


def make_token(sub: Optional[str] = USER_A, secret: str = TEST_JWT_SECRET, **overrides: Any) -> str:
    """Mint an HS256 token shaped like a Supabase Auth access token (``sub=None`` omits the subject)."""
    now = int(time.time())
    claims: Dict[str, Any] = {
        "sub": sub,
        "aud": "authenticated",
        "role": "authenticated",
        "email": f"{sub[:8]}@example.test" if sub else None,
        "iat": now,
        "exp": now + 3600,
    }
    claims.update(overrides)
    claims = {key: value for key, value in claims.items() if value is not None}
    return jwt.encode(claims, secret, algorithm="HS256")


def bearer(sub: str = USER_A, **overrides: Any) -> Dict[str, str]:
    """Authorization header for a synthetic user."""
    return {"Authorization": f"Bearer {make_token(sub, **overrides)}"}


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Test client with dependency overrides cleared after each test."""
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def auth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make authentication mandatory, verified with the legacy HS256 secret."""
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.delenv("SUPABASE_URL", raising=False)


@pytest.fixture
def paid_env(auth_env: None, live_billing: None) -> None:
    """Production-like setup: mandatory auth for accounts and live (non-mock) billing."""


@pytest.fixture
def token_factory() -> Callable[..., str]:
    """Expose the token minting helper to tests."""
    return make_token
