import os
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.formparsers import MultiPartParser

from slowapi.errors import RateLimitExceeded

from app.core import ingestion
from app.core.auth import validate_auth_config
from app.core.billing import get_billing_service, load_billing_settings, validate_billing_config
from app.core.config import environment_name, resolve_cors_origins
from app.core.middleware import BodySizeLimitMiddleware
from app.core.ratelimit import limiter, rate_limit_exceeded_handler, validate_rate_limit_config
from app.core.storage import StorageError, get_storage
from app.routers import scans, billing, ingest

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("trustcore.api")

# Request body limits
UPLOAD_ROUTE_PREFIX = "/api/v1/ingest/upload"
MULTIPART_OVERHEAD_BYTES = 1 * ingestion.MB  # multipart boundaries and part headers
UPLOAD_MAX_BODY_BYTES = ingestion.MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES
DEFAULT_MAX_BODY_BYTES = 32 * ingestion.MB  # JSON scan requests carrying ingested text
WEBHOOK_ROUTE_PREFIX = "/api/v1/billing/webhook"
WEBHOOK_MAX_BODY_BYTES = 1 * ingestion.MB  # Stripe events are a few KB

# Keep uploads entirely in memory: an uploaded file is never spooled to a temp file on disk.
MultiPartParser.spool_max_size = UPLOAD_MAX_BODY_BYTES


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Fail fast on unsafe configuration (auth, billing, limits, storage) before serving traffic."""
    validate_auth_config()
    validate_billing_config()
    validate_rate_limit_config()
    get_storage()
    get_billing_service().entitlements  # verifies the billing tables exist
    yield


app = FastAPI(
    title="TrustCore — Shared AI Security & Readiness API",
    description="Dual-Engine Security Core for LaunchGate, AgentScope, Evidence-to-Answer, and EvalKit.",
    version="1.0.0",
    lifespan=lifespan
)

# Body size limits. Added before CORS so CORS stays outermost and 413 responses carry CORS headers.
app.add_middleware(
    BodySizeLimitMiddleware,
    default_limit=DEFAULT_MAX_BODY_BYTES,
    route_limits={UPLOAD_ROUTE_PREFIX: UPLOAD_MAX_BODY_BYTES, WEBHOOK_ROUTE_PREFIX: WEBHOOK_MAX_BODY_BYTES},
)

# CORS Middleware Configuration: exact origins from CORS_ORIGINS only. No wildcard, nothing
# added implicitly, and no credentialed (cookie) requests: the API authenticates with a
# bearer token. Startup fails outside development when CORS_ORIGINS is missing or invalid.
app.add_middleware(
    CORSMiddleware,
    allow_origins=resolve_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Retry-After"],
)

# Rate limiting (slowapi): limits are declared on the scan and ingest routes.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Mount Routers
app.include_router(scans.router)
app.include_router(ingest.router)
app.include_router(billing.router)


@app.exception_handler(StorageError)
async def storage_error_handler(request: Request, exc: StorageError) -> JSONResponse:
    """Report-store failures surface as 503 without leaking query details."""
    logger.error("Report storage failure on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=503, content={"detail": "Report storage is temporarily unavailable."})


@app.get("/health", tags=["health"])
@app.get("/api/v1/health", tags=["health"])
def healthcheck(request: Request):
    """Service health and capability status."""
    forwarded = ",".join(request.headers.getlist("x-forwarded-for"))
    return {
        # How many X-Forwarded-For entries reached the app. Called from a client that sends
        # no such header, this is the proxy count to configure as TRUSTED_PROXY_HOPS.
        "forwarded_for_entries": len([entry for entry in forwarded.split(",") if entry.strip()]),
        "status": "healthy",
        "service": "TrustCore Engine",
        "version": "1.0.0",
        "environment": environment_name(),
        "architecture": "Dual-Engine (Deterministic Engine 1 + LLM Explainer Engine 2)",
        "mock_billing": load_billing_settings().mock,
        "llm_provider": os.getenv("LLM_EXPLAINER_PROVIDER", "mock")
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
