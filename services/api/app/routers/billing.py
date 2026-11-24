from typing import Any, Dict, Optional

from fastapi import APIRouter, Request, Header, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool

from app.core.auth import AuthenticatedUser, get_caller
from app.core.schemas import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingStatusResponse
)
from app.core.billing import BillingError, get_billing_service, BillingService

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


@router.post("/checkout", response_model=BillingCheckoutResponse)
def create_checkout(
    req: BillingCheckoutRequest,
    user: AuthenticatedUser = Depends(get_caller),
    billing_service: BillingService = Depends(get_billing_service)
):
    """
    Initiate Stripe Checkout for per-scan credits or Pro/Enterprise subscriptions.

    Requires sign-in with live billing. The purchase is credited to the caller only
    after Stripe confirms payment through the webhook. `MOCK_BILLING=true` (local
    development only) simulates the purchase instantly.
    """
    try:
        return billing_service.create_checkout_session(req, user)
    except BillingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.post("/webhook")
async def handle_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
    billing_service: BillingService = Depends(get_billing_service)
) -> Dict[str, Any]:
    """Stripe webhook receiver: verifies the signature, then grants credits or updates subscriptions."""
    body = await request.body()
    try:
        return await run_in_threadpool(billing_service.handle_webhook, body, stripe_signature)
    except BillingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@router.get("/status", response_model=BillingStatusResponse)
def get_billing_status(
    user: AuthenticatedUser = Depends(get_caller),
    billing_service: BillingService = Depends(get_billing_service)
):
    """Get the caller's tier, remaining scan credits, and whether a free preview is still available."""
    return billing_service.get_status(user)
