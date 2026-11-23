import os
import uuid
import logging
from typing import Dict, Any, Optional
from app.core.schemas import (
    BillingTier,
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingStatusResponse
)

logger = logging.getLogger(__name__)

# Mock in-memory account credits for local development
_mock_billing_state = {
    "tier": "per_scan",
    "credits_remaining": 10,
    "subscription_active": False
}


class BillingService:
    """Stripe billing integration with local mock fallback."""

    def __init__(self):
        self.mock_billing = os.getenv("MOCK_BILLING", "true").lower() in ("true", "1", "yes")
        self.stripe_secret_key = os.getenv("STRIPE_SECRET_KEY")
        self.stripe_webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        self.stripe_price_per_scan = os.getenv("STRIPE_PRICE_ID_PER_SCAN", "price_per_scan_999")
        self.stripe_price_pro = os.getenv("STRIPE_PRICE_ID_PRO", "price_pro_monthly_4900")
        self.stripe_price_enterprise = os.getenv("STRIPE_PRICE_ID_ENTERPRISE", "price_enterprise_monthly_19900")

    def create_checkout_session(self, req: BillingCheckoutRequest) -> BillingCheckoutResponse:
        """Create a Stripe Checkout Session or return a simulated mock URL."""
        success_url = req.success_url or "http://localhost:3000/?billing=success"
        cancel_url = req.cancel_url or "http://localhost:3000/?billing=cancelled"

        # Mock Billing Mode (Default for local layout & testing)
        if self.mock_billing or not self.stripe_secret_key or self.stripe_secret_key.startswith("sk_test_mock"):
            session_id = f"cs_mock_{uuid.uuid4().hex[:16]}"
            logger.info(f"[Billing] Mock Checkout initiated for {req.tier}. Session ID: {session_id}")
            
            # Simulate upgrading the user state
            if req.tier == BillingTier.PRO_MONTHLY:
                _mock_billing_state["tier"] = "pro_monthly"
                _mock_billing_state["credits_remaining"] = 999
                _mock_billing_state["subscription_active"] = True
            elif req.tier == BillingTier.ENTERPRISE_MONTHLY:
                _mock_billing_state["tier"] = "enterprise_monthly"
                _mock_billing_state["credits_remaining"] = 9999
                _mock_billing_state["subscription_active"] = True
            else:
                _mock_billing_state["credits_remaining"] += 5

            return BillingCheckoutResponse(
                checkout_url=f"{success_url}&session_id={session_id}&mock=true",
                session_id=session_id,
                is_mock=True,
                message=f"Mock checkout simulated for {req.tier.value}. Account upgraded successfully."
            )

        # Real Stripe Integration
        try:
            import stripe
            stripe.api_key = self.stripe_secret_key

            price_map = {
                BillingTier.PER_SCAN: self.stripe_price_per_scan,
                BillingTier.PRO_MONTHLY: self.stripe_price_pro,
                BillingTier.ENTERPRISE_MONTHLY: self.stripe_price_enterprise,
            }
            price_id = price_map.get(req.tier, self.stripe_price_per_scan)
            mode = "subscription" if req.tier != BillingTier.PER_SCAN else "payment"

            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode=mode,
                success_url=f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=cancel_url,
                metadata={"tier": req.tier.value}
            )

            return BillingCheckoutResponse(
                checkout_url=session.url,
                session_id=session.id,
                is_mock=False,
                message=f"Live Stripe checkout session created for {req.tier.value}."
            )
        except Exception as e:
            logger.error(f"[Billing] Stripe checkout creation failed: {e}")
            # Gracefully fall back to mock response on configuration error
            return BillingCheckoutResponse(
                checkout_url=f"{success_url}&mock_fallback=true",
                session_id=f"cs_fallback_{uuid.uuid4().hex[:12]}",
                is_mock=True,
                message=f"Fell back to simulated checkout: {str(e)}"
            )

    def verify_webhook(self, payload: bytes, sig_header: str) -> Dict[str, Any]:
        """Verify and process incoming Stripe webhook events."""
        if self.mock_billing or not self.stripe_webhook_secret:
            logger.info("[Billing] Mock Webhook received and verified successfully.")
            return {"status": "success", "event": "mock_event", "verified": True}

        try:
            import stripe
            stripe.api_key = self.stripe_secret_key
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.stripe_webhook_secret
            )
            return {"status": "success", "event": event["type"], "data": event["data"]}
        except Exception as e:
            logger.error(f"[Billing] Webhook signature verification failed: {e}")
            raise ValueError(f"Invalid webhook signature: {e}")

    def get_status(self) -> BillingStatusResponse:
        """Return current user credits and active tier."""
        return BillingStatusResponse(
            tier=_mock_billing_state["tier"],
            credits_remaining=_mock_billing_state["credits_remaining"],
            is_mock=self.mock_billing,
            subscription_active=_mock_billing_state["subscription_active"]
        )


_billing_service: Optional[BillingService] = None


def get_billing_service() -> BillingService:
    global _billing_service
    if _billing_service is None:
        _billing_service = BillingService()
    return _billing_service
