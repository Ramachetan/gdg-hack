#!/usr/bin/env pwsh
# Deploy Otto Roadside to Cloud Run (PowerShell port of deploy.sh).
#
# Usage:
#   ./deploy.ps1
#   $env:PROJECT_ID = "my-proj"; ./deploy.ps1
#   $env:SERVICE = "otto"; $env:REGION = "us-central1"; ./deploy.ps1
#
# Requires: gcloud CLI authenticated (`gcloud auth login`) with permission to
# enable services and deploy Cloud Run revisions in $env:PROJECT_ID.

$ErrorActionPreference = "Stop"

# --- Config (override via env) -----------------------------------------------
$ProjectId    = $env:PROJECT_ID       ?? "io-chmuseum25mtv-1807"
$Region       = $env:REGION           ?? "us-central1"
$Service      = $env:SERVICE          ?? "otto-roadside"
$Model        = $env:DEMO_AGENT_MODEL ?? "gemini-live-2.5-flash-native-audio"

# Cloud Run sizing — WebSocket + Gemini Live needs generous timeout and a warm
# instance so the first caller doesn't pay a cold-start on the audio stream.
$Memory       = $env:MEMORY           ?? "2Gi"
$Cpu          = $env:CPU              ?? "2"
$Timeout      = $env:TIMEOUT          ?? "3600"
$Concurrency  = $env:CONCURRENCY      ?? "20"
$MinInstances = $env:MIN_INSTANCES    ?? "1"
$MaxInstances = $env:MAX_INSTANCES    ?? "5"

# --- Preflight ---------------------------------------------------------------
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
    exit 1
}

Write-Host "==> Project: $ProjectId"
Write-Host "==> Region:  $Region"
Write-Host "==> Service: $Service"
Write-Host "==> Model:   $Model"

gcloud config set project $ProjectId | Out-Null

Write-Host "==> Enabling required APIs (run, cloudbuild, artifactregistry, aiplatform)..."
gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    aiplatform.googleapis.com `
    --project=$ProjectId
if ($LASTEXITCODE -ne 0) { throw "gcloud services enable failed (exit $LASTEXITCODE)" }

# --- Deploy ------------------------------------------------------------------
# `--source .` uploads the repo, has Cloud Build build the Dockerfile, pushes
# the image to Artifact Registry, and rolls out a new Cloud Run revision.
#
# WebSocket-specific flags:
#   --timeout=3600         long-lived audio sessions
#   --session-affinity     route a given client back to the same instance
#   --cpu-boost            faster cold start
#   --min-instances=1      keep one warm so the first call isn't cold
Write-Host "==> Deploying to Cloud Run (this builds the image via Cloud Build)..."
gcloud run deploy $Service `
    --source . `
    --project=$ProjectId `
    --region=$Region `
    --platform=managed `
    --allow-unauthenticated `
    --port=8080 `
    --memory=$Memory `
    --cpu=$Cpu `
    --timeout=$Timeout `
    --concurrency=$Concurrency `
    --min-instances=$MinInstances `
    --max-instances=$MaxInstances `
    --cpu-boost `
    --session-affinity `
    --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=$ProjectId,GOOGLE_CLOUD_LOCATION=$Region,DEMO_AGENT_MODEL=$Model"
if ($LASTEXITCODE -ne 0) { throw "gcloud run deploy failed (exit $LASTEXITCODE)" }

# --- Done --------------------------------------------------------------------
$Url = gcloud run services describe $Service `
    --project=$ProjectId --region=$Region `
    --format="value(status.url)"
if ($LASTEXITCODE -ne 0) { throw "gcloud run services describe failed (exit $LASTEXITCODE)" }

$Wss = $Url -replace '^https:', 'wss:'

Write-Host ""
Write-Host "==> Deployed."
Write-Host "    Service URL: $Url"
Write-Host "    WebSocket:   $Wss/ws/<user_id>/<session_id>"
