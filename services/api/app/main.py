import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import scans, billing

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("trustcore.api")

app = FastAPI(
    title="TrustCore — Shared AI Security & Readiness API",
    description="Dual-Engine Security Core for LaunchGate, AgentScope, Evidence-to-Answer, and EvalKit.",
    version="1.0.0"
)

# CORS Middleware Configuration
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
if "*" not in origins and "http://localhost:3000" not in origins:
    origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(scans.router)
app.include_router(billing.router)


@app.get("/health", tags=["health"])
@app.get("/api/v1/health", tags=["health"])
def healthcheck():
    """Service health and capability status."""
    return {
        "status": "healthy",
        "service": "TrustCore Engine",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "architecture": "Dual-Engine (Deterministic Engine 1 + LLM Explainer Engine 2)",
        "mock_billing": os.getenv("MOCK_BILLING", "true").lower() in ("true", "1", "yes"),
        "llm_provider": os.getenv("LLM_EXPLAINER_PROVIDER", "mock")
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
