from fastapi import APIRouter, Request, Header, HTTPException, Depends
from app.core.schemas import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingStatusResponse
)
from app.core.billing import get_billing_service, BillingService

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


@router.post("/checkout", response_model=BillingCheckoutResponse)
def create_checkout(
    req: BillingCheckoutRequest,
    billing_service: BillingService = Depends(get_billing_service)
):
    """
    Initiate Stripe Checkout for per-scan credits or Pro/Enterprise subscriptions.
    Supports MOCK_BILLING=true for instant local testing without live Stripe API keys.
    """
    return billing_service.create_checkout_session(req)


@router.post("/webhook")
async def handle_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    billing_service: BillingService = Depends(get_billing_service)
):
    """Stripe webhook receiver verifying signatures and updating customer entitlements."""
    body = await request.body()
    try:
        res = billing_service.verify_webhook(body, stripe_signature or "")
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status", response_model=BillingStatusResponse)
def get_billing_status(
    billing_service: BillingService = Depends(get_billing_service)
):
    """Get active subscription plan, remaining scan credits, and mock billing status."""
    return billing_service.get_status()
