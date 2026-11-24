"""Stripe billing: persisted entitlements, Checkout, and signed webhooks.

Entitlements (tier, scan credits, the free preview) live in Postgres and are
granted only by verified Stripe webhook events. ``MOCK_BILLING=true`` is a local
development convenience and is refused outside development.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urlsplit

import stripe

from app.core.auth import AuthenticatedUser
from app.core.config import LOCAL_DEV_HINT, env_flag, is_development, resolve_cors_origins
from app.core.db import auto_create_requested, get_engine
from app.core.entitlements import EntitlementRepository, ScanAccess, ScanGrant, Tier
from app.core.schemas import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingStatusResponse,
    BillingTier,
)

logger = logging.getLogger(__name__)

_PLACEHOLDER_KEY_PREFIX = "sk_test_mock"
_PLACEHOLDER_WEBHOOK_PREFIX = "whsec_mock"
_PAID_EVENTS = ("checkout.session.completed", "checkout.session.async_payment_succeeded")
_SUBSCRIPTION_DELETED = "customer.subscription.deleted"
_SETTLED_PAYMENT_STATUSES = ("paid", "no_payment_required")
_TIER_FOR_PURCHASE: Dict[BillingTier, Tier] = {
    BillingTier.PER_SCAN: Tier.PER_SCAN,
    BillingTier.PRO_MONTHLY: Tier.PRO_MONTHLY,
    BillingTier.ENTERPRISE_MONTHLY: Tier.ENTERPRISE,
}


class BillingError(Exception):
    """A billing failure that maps to an HTTP status and a client-safe message."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class CheckoutSession:
    """The parts of a Stripe Checkout Session the API returns."""

    id: str
    url: str


@dataclass(frozen=True)
class BillingSettings:
    """Billing configuration resolved from the environment."""

    mock: bool
    stripe_secret_key: Optional[str]
    webhook_secret: Optional[str]
    price_ids: Dict[BillingTier, str]
    per_scan_credits: int

    @property
    def stripe_configured(self) -> bool:
        """True when a real (non-placeholder) Stripe secret key is present."""
        key = self.stripe_secret_key
        return bool(key) and not key.startswith(_PLACEHOLDER_KEY_PREFIX)

    @property
    def webhook_configured(self) -> bool:
        """True when a real webhook signing secret is present.

        The ``whsec_mock…`` value shipped in ``.env.example`` is public, so anyone
        could sign events with it; it is treated as not configured.
        """
        secret = self.webhook_secret
        return bool(secret) and not secret.startswith(_PLACEHOLDER_WEBHOOK_PREFIX)

    @property
    def test_mode(self) -> bool:
        """True for Stripe test-mode keys, where test cards complete checkouts for free."""
        return bool(self.stripe_secret_key) and self.stripe_secret_key.startswith(("sk_test_", "rk_test_"))


def load_billing_settings() -> BillingSettings:
    """Read billing configuration from the environment (evaluated per call)."""
    try:
        per_scan_credits = max(1, int(os.getenv("STRIPE_PER_SCAN_CREDITS", "1")))
    except ValueError:
        per_scan_credits = 1
    return BillingSettings(
        mock=env_flag("MOCK_BILLING", default=is_development()),
        stripe_secret_key=(os.getenv("STRIPE_SECRET_KEY") or "").strip() or None,
        webhook_secret=(os.getenv("STRIPE_WEBHOOK_SECRET") or "").strip() or None,
        price_ids={
            BillingTier.PER_SCAN: os.getenv("STRIPE_PRICE_ID_PER_SCAN", ""),
            BillingTier.PRO_MONTHLY: os.getenv("STRIPE_PRICE_ID_PRO", ""),
            BillingTier.ENTERPRISE_MONTHLY: os.getenv("STRIPE_PRICE_ID_ENTERPRISE", ""),
        },
        per_scan_credits=per_scan_credits,
    )


def validate_billing_config() -> None:
    """Fail fast at startup on a billing configuration that must not serve the public.

    Raises:
        RuntimeError: if ``MOCK_BILLING`` is on outside development, or live billing
            lacks a real ``STRIPE_SECRET_KEY`` or a ``STRIPE_WEBHOOK_SECRET``.
    """
    settings = load_billing_settings()
    if settings.mock:
        if not is_development():
            raise RuntimeError("MOCK_BILLING is for local development only; unset it outside development.")
        logger.warning("Billing is in MOCK mode: every scan is unlocked and no payment is taken.")
        return
    if is_development():
        return
    if not (settings.stripe_configured and settings.webhook_configured):
        raise RuntimeError(
            "Live billing needs a real STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET "
            f"(the sk_test_mock / whsec_mock placeholders are not accepted). {LOCAL_DEV_HINT}"
        )
    if settings.test_mode and not env_flag("STRIPE_ALLOW_TEST_MODE", default=False):
        raise RuntimeError(
            "STRIPE_SECRET_KEY is a test-mode key: test cards would unlock paid scans. Use a live key, "
            "or set STRIPE_ALLOW_TEST_MODE=true for a non-public staging environment."
        )


def _append_query(url: str, query: str) -> str:
    return f"{url}{'&' if '?' in url else '?'}{query}"


def _return_url(requested: Optional[str], default_query: str) -> str:
    """Validate a post-checkout redirect: it must stay on an allowed web origin."""
    origins = resolve_cors_origins()
    if not requested:
        return f"{origins[0]}/?{default_query}"
    parts = urlsplit(requested)
    if f"{parts.scheme}://{parts.netloc}" not in origins:
        raise BillingError(400, "success_url and cancel_url must point at the TrustCore web app.")
    return requested


class BillingService:
    """Entitlement checks, Stripe Checkout, and webhook processing."""

    def __init__(self, entitlements: Optional[EntitlementRepository] = None) -> None:
        self._entitlements = entitlements

    @property
    def entitlements(self) -> EntitlementRepository:
        """The entitlement store, created on first use (shares the application engine)."""
        if self._entitlements is None:
            self._entitlements = EntitlementRepository(engine=get_engine(), auto_create=auto_create_requested())
        return self._entitlements

    # --- scans ---------------------------------------------------------------

    def authorize_scan(self, user: AuthenticatedUser) -> ScanGrant:
        """Decide whether ``user`` gets a full report, a preview, or must pay.

        Raises:
            PaymentRequired: the free preview is used and there is no credit or subscription.
        """
        if load_billing_settings().mock:
            return ScanGrant(user.id, ScanAccess.FULL)
        return self.entitlements.authorize_scan(user.id)

    def refund(self, grant: ScanGrant) -> None:
        """Return what a failed scan spent."""
        self.entitlements.refund(grant)

    def get_status(self, user: AuthenticatedUser) -> BillingStatusResponse:
        """Return the caller's tier, credits, and what they can run."""
        settings = load_billing_settings()
        entitlement = self.entitlements.get(user.id)
        return BillingStatusResponse(
            tier=entitlement.tier.value,
            credits_remaining=entitlement.credits_remaining,
            is_mock=settings.mock,
            subscription_active=entitlement.subscription_active,
            free_preview_available=entitlement.free_preview_available,
            can_run_full_scan=settings.mock or entitlement.can_run_full_scan,
        )

    # --- checkout ------------------------------------------------------------

    def create_checkout_session(self, req: BillingCheckoutRequest, user: AuthenticatedUser) -> BillingCheckoutResponse:
        """Start a Stripe Checkout for ``user``.

        The session carries the user id, so the webhook can credit the right
        account. Nothing is granted here: entitlements change only when Stripe
        confirms payment.

        Raises:
            BillingError: 400 for a foreign redirect URL, 401 when signed out,
                503 when Stripe is not configured or unreachable.
        """
        settings = load_billing_settings()
        success_url = _return_url(req.success_url, "billing=success")
        cancel_url = _return_url(req.cancel_url, "billing=cancelled")
        tier = _TIER_FOR_PURCHASE[req.tier]

        if settings.mock:
            # Local development only: simulate the webhook so the UI can be exercised.
            session_id = f"cs_mock_{uuid.uuid4().hex[:16]}"
            self.entitlements.grant_checkout(
                f"mock_{session_id}", "mock.checkout", user.id, tier,
                credits=settings.per_scan_credits, customer_id=None,
                subscription_id=f"sub_mock_{session_id}" if req.tier != BillingTier.PER_SCAN else None,
            )
            logger.info("[Billing] Mock checkout applied for tier %s", req.tier.value)
            return BillingCheckoutResponse(
                checkout_url=_append_query(success_url, f"session_id={session_id}&mock=true"),
                session_id=session_id,
                is_mock=True,
                message=f"Mock checkout simulated for {req.tier.value}. Account upgraded successfully.",
            )

        if user.is_anonymous:
            raise BillingError(401, "Sign in to purchase scans.")
        price_id = settings.price_ids.get(req.tier)
        if not settings.stripe_configured or not price_id:
            raise BillingError(503, "Payments are not configured.")

        subscription = req.tier != BillingTier.PER_SCAN
        params: Dict[str, Any] = {
            "mode": "subscription" if subscription else "payment",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": _append_query(success_url, "session_id={CHECKOUT_SESSION_ID}"),
            "cancel_url": cancel_url,
            "client_reference_id": user.id,
            "metadata": {"user_id": user.id, "tier": req.tier.value},
        }
        if subscription:
            params["subscription_data"] = {"metadata": {"user_id": user.id}}
        customer_id = self.entitlements.get(user.id).stripe_customer_id
        if customer_id:
            params["customer"] = customer_id
        elif user.email:
            params["customer_email"] = user.email

        try:
            session = self._create_stripe_session(params, settings.stripe_secret_key or "")
        except stripe.StripeError as exc:
            logger.error("[Billing] Stripe checkout creation failed: %s", type(exc).__name__)
            raise BillingError(503, "The payment provider is unavailable. You have not been charged.") from exc
        return BillingCheckoutResponse(
            checkout_url=session.url,
            session_id=session.id,
            is_mock=False,
            message=f"Stripe checkout session created for {req.tier.value}.",
        )

    def _create_stripe_session(self, params: Dict[str, Any], api_key: str) -> CheckoutSession:
        """Call Stripe. Isolated so tests can replace the network call."""
        session = stripe.StripeClient(api_key).checkout.sessions.create(params=params)  # type: ignore[arg-type]
        return CheckoutSession(id=session.id, url=session.url or "")

    # --- webhooks ------------------------------------------------------------

    def handle_webhook(self, payload: bytes, signature: Optional[str]) -> Dict[str, Any]:
        """Verify a Stripe webhook and apply it.

        The ``Stripe-Signature`` header is checked against ``STRIPE_WEBHOOK_SECRET``
        (HMAC over the raw body, 5 minute tolerance) before the payload is trusted.
        Grants are idempotent per Stripe event id.

        Raises:
            BillingError: 400 for a missing/invalid signature or payload, 503 when
                the webhook secret is not configured.
        """
        settings = load_billing_settings()
        if settings.mock:
            # Without a verified signature nothing may be granted.
            return {"status": "ignored", "reason": "mock billing is enabled"}
        if not settings.webhook_configured:
            raise BillingError(503, "Webhook secret is not configured.")
        if not signature:
            raise BillingError(400, "Missing Stripe-Signature header.")
        try:
            stripe.Webhook.construct_event(payload, signature, settings.webhook_secret)
            event = json.loads(payload)
        except (stripe.SignatureVerificationError, ValueError) as exc:
            logger.warning("[Billing] Rejected webhook: %s", type(exc).__name__)
            raise BillingError(400, "Invalid webhook signature or payload.") from exc

        event_id, event_type = event.get("id"), event.get("type")
        data = event.get("data")
        obj = data.get("object") if isinstance(data, dict) else None
        if not isinstance(event_id, str) or not isinstance(event_type, str) or not isinstance(obj, dict):
            raise BillingError(400, "Invalid webhook signature or payload.")

        if event_type in _PAID_EVENTS:
            status = self._on_checkout_paid(event_id, event_type, obj, settings)
        elif event_type == _SUBSCRIPTION_DELETED:
            status = self._on_subscription_deleted(event_id, event_type, obj)
        else:
            status = "ignored"
        logger.info("[Billing] Webhook %s (%s): %s", event_id, event_type, status)
        return {"status": status, "event": event_type}

    def _on_checkout_paid(self, event_id: str, event_type: str, session: Dict[str, Any], settings: BillingSettings) -> str:
        """Grant credits or activate a subscription for a paid Checkout Session."""
        if event_type == "checkout.session.completed" and session.get("payment_status") not in _SETTLED_PAYMENT_STATUSES:
            return "ignored"  # delayed payment method: wait for async_payment_succeeded

        metadata = session.get("metadata") if isinstance(session.get("metadata"), dict) else {}
        reference, metadata_user = session.get("client_reference_id"), metadata.get("user_id")
        user_id = reference or metadata_user
        if not isinstance(user_id, str) or not user_id or len(user_id) > 255:
            return "ignored"
        if reference and metadata_user and reference != metadata_user:
            return "ignored"
        try:
            purchase = BillingTier(metadata.get("tier"))
        except ValueError:
            return "ignored"
        expected_mode = "payment" if purchase == BillingTier.PER_SCAN else "subscription"
        if session.get("mode") != expected_mode:
            return "ignored"

        customer, subscription = session.get("customer"), session.get("subscription")
        granted = self.entitlements.grant_checkout(
            event_id, event_type, user_id, _TIER_FOR_PURCHASE[purchase],
            credits=settings.per_scan_credits,
            customer_id=customer if isinstance(customer, str) else None,
            subscription_id=subscription if isinstance(subscription, str) else None,
        )
        return "processed" if granted else "duplicate"

    def _on_subscription_deleted(self, event_id: str, event_type: str, subscription: Dict[str, Any]) -> str:
        """Downgrade the account whose subscription ended."""
        subscription_id = subscription.get("id")
        if not isinstance(subscription_id, str) or not subscription_id:
            return "ignored"
        applied = self.entitlements.cancel_subscription(event_id, event_type, subscription_id=subscription_id)
        return "processed" if applied else "duplicate"


_billing_service: Optional[BillingService] = None


def get_billing_service() -> BillingService:
    """Return the process-wide billing service."""
    global _billing_service
    if _billing_service is None:
        _billing_service = BillingService()
    return _billing_service
