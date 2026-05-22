#!/usr/bin/env bash
# Deploy Otto Roadside to Cloud Run.
#
# Usage:
#   ./deploy.sh                  # uses defaults below / env overrides
#   PROJECT_ID=my-proj ./deploy.sh
#   SERVICE=otto REGION=us-central1 ./deploy.sh
#
# Requires: gcloud CLI authenticated (`gcloud auth login`) with permission to
# enable services and deploy Cloud Run revisions in $PROJECT_ID.

set -euo pipefail

# --- Config (override via env) -----------------------------------------------
PROJECT_ID="${PROJECT_ID:-io-chmuseum25mtv-1807}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-otto-roadside}"
MODEL="${DEMO_AGENT_MODEL:-gemini-live-2.5-flash-native-audio}"

# Cloud Run sizing — WebSocket + Gemini Live needs generous timeout and a warm
# instance so the first caller doesn't pay a cold-start on the audio stream.
MEMORY="${MEMORY:-2Gi}"
CPU="${CPU:-2}"
TIMEOUT="${TIMEOUT:-3600}"          # 60 min — max Cloud Run request timeout
CONCURRENCY="${CONCURRENCY:-20}"
MIN_INSTANCES="${MIN_INSTANCES:-1}"
MAX_INSTANCES="${MAX_INSTANCES:-5}"

# --- Preflight ---------------------------------------------------------------
command -v gcloud >/dev/null 2>&1 || {
  echo "error: gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install" >&2
  exit 1
}

echo "==> Project: $PROJECT_ID"
echo "==> Region:  $REGION"
echo "==> Service: $SERVICE"
echo "==> Model:   $MODEL"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Enabling required APIs (run.googleapis.com, cloudbuild.googleapis.com, aiplatform.googleapis.com)..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  aiplatform.googleapis.com \
  --project="$PROJECT_ID"

# --- Deploy ------------------------------------------------------------------
# `--source .` uploads the repo, has Cloud Build build the Dockerfile, pushes
# the image to Artifact Registry, and rolls out a new Cloud Run revision.
#
# WebSocket-specific flags:
#   --timeout=3600         long-lived audio sessions
#   --session-affinity     route a given client back to the same instance
#   --cpu-boost            faster cold start
#   --min-instances=1      keep one warm so the first call isn't cold
echo "==> Deploying to Cloud Run (this builds the image via Cloud Build)..."
gcloud run deploy "$SERVICE" \
  --source . \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory="$MEMORY" \
  --cpu="$CPU" \
  --timeout="$TIMEOUT" \
  --concurrency="$CONCURRENCY" \
  --min-instances="$MIN_INSTANCES" \
  --max-instances="$MAX_INSTANCES" \
  --cpu-boost \
  --session-affinity \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION,DEMO_AGENT_MODEL=$MODEL"

# --- Done --------------------------------------------------------------------
URL="$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" \
  --format='value(status.url)')"

echo
echo "==> Deployed."
echo "    Service URL: $URL"
echo "    WebSocket:   ${URL/https:/wss:}/ws/<user_id>/<session_id>"
