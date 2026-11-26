#!/usr/bin/env bash
# Deploy the TrustCore API to Google Cloud Run.
#
#   PROJECT_ID=my-gcp-project REGION=us-central1 bash deploy/cloudrun.sh
#
# Before the first run:
#   1. gcloud auth login && gcloud services enable run.googleapis.com \
#        cloudbuild.googleapis.com secretmanager.googleapis.com --project "$PROJECT_ID"
#   2. Create the secrets (values are read from stdin, never from this repo):
#        printf '%s' "$VALUE" | gcloud secrets create trustcore-database-url --data-file=- --project "$PROJECT_ID"
#      Names: trustcore-database-url, trustcore-stripe-secret-key,
#             trustcore-stripe-webhook-secret, trustcore-anon-id-salt,
#             trustcore-gemini-api-key (only with WITH_GEMINI=1)
#      and grant the Cloud Run service account roles/secretmanager.secretAccessor.
#   3. cp deploy/cloud-run.env.example.yaml deploy/cloud-run.env.yaml and fill it in.
#   4. Apply services/api/migrations/*.sql to the database.
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to the Google Cloud project id}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-trustcore-api}"
ENV_FILE="${ENV_FILE:-deploy/cloud-run.env.yaml}"

cd "$(dirname "$0")/.."

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy deploy/cloud-run.env.example.yaml and fill it in." >&2
  exit 1
fi
if grep -qE 'YOUR-|REPLACE' "$ENV_FILE"; then
  echo "$ENV_FILE still contains placeholder values." >&2
  exit 1
fi

SECRETS="DATABASE_URL=trustcore-database-url:latest"
SECRETS+=",STRIPE_SECRET_KEY=trustcore-stripe-secret-key:latest"
SECRETS+=",STRIPE_WEBHOOK_SECRET=trustcore-stripe-webhook-secret:latest"
SECRETS+=",ANON_ID_SALT=trustcore-anon-id-salt:latest"
if [[ "${WITH_GEMINI:-0}" == "1" ]]; then
  # Also set LLM_EXPLAINER_PROVIDER: "gemini" in the env file.
  SECRETS+=",GEMINI_API_KEY=trustcore-gemini-api-key:latest"
fi

# --source builds services/api/Dockerfile with Cloud Build. The image listens on
# $PORT (8000) and sets ENVIRONMENT=production, so the API refuses to start if
# auth, Stripe, CORS, or the database is not configured.
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source services/api \
  --port 8000 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 20 \
  --timeout 120 \
  --min-instances 0 \
  --max-instances 4 \
  --env-vars-file "$ENV_FILE" \
  --set-secrets "$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format 'value(status.url)')"
echo "Deployed: $URL"
echo "Verify:   curl -s $URL/health"
echo "          forwarded_for_entries in that response must equal TRUSTED_PROXY_HOPS in $ENV_FILE."
echo "Stripe:   point the webhook endpoint at $URL/api/v1/billing/webhook"
