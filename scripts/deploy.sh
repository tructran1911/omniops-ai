#!/usr/bin/env bash
# Deploy OmniOps AI to Cloud Run — the bash twin of scripts/deploy.ps1, for Cloud Shell or any Linux/macOS shell.
# Usage (from the omniops-ai folder):  ./scripts/deploy.sh -p <PROJECT_ID>
#   -p <id>      Google Cloud project id (required)
#   -r <region>  Cloud Run region (default us-central1)
#   -m <model>   Gemini model (default gemini-3.8-flash)
#   -b <bucket>  Cloud Storage bucket (default <PROJECT_ID>-docs)
#   -t <tag>     Revision tag, e.g. -t final for the submission build
#   -v           Use Gemini on Vertex AI instead of the Developer API
# TODO(setup): before the first deploy, complete README → Setup on Google Cloud, steps 1–6.
set -euo pipefail

PROJECT_ID=""; REGION="us-central1"; MODEL="gemini-3.8-flash"; BUCKET=""; TAG=""; VERTEX=0
while getopts "p:r:m:b:t:v" opt; do
  case "$opt" in
    p) PROJECT_ID="$OPTARG" ;;
    r) REGION="$OPTARG" ;;
    m) MODEL="$OPTARG" ;;
    b) BUCKET="$OPTARG" ;;
    t) TAG="$OPTARG" ;;
    v) VERTEX=1 ;;
    *) echo "Usage: ./scripts/deploy.sh -p <PROJECT_ID> [-r region] [-m model] [-b bucket] [-t tag] [-v]" >&2; exit 2 ;;
  esac
done
[ -n "$PROJECT_ID" ] || { echo "ERROR: -p <PROJECT_ID> is required" >&2; exit 2; }

BUCKET_NAME="${BUCKET:-${PROJECT_ID}-docs}"
ENV_VARS="GEMINI_MODEL=${MODEL},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCS_BUCKET=${BUCKET_NAME}"
if [ "$VERTEX" -eq 1 ]; then ENV_VARS="${ENV_VARS},GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_LOCATION=${REGION}"; fi

ARGS=(run deploy omniops --source . --project "$PROJECT_ID" --region "$REGION"
      --allow-unauthenticated --timeout 300 --memory 1Gi --cpu 1
      --min-instances 0 --max-instances 2 --set-env-vars "$ENV_VARS")
if [ "$VERTEX" -eq 0 ]; then ARGS+=(--set-secrets "GEMINI_API_KEY=gemini-api-key:latest"); fi
if [ -n "$TAG" ]; then ARGS+=(--tag "$TAG"); fi

echo "gcloud ${ARGS[*]}"
if ! gcloud "${ARGS[@]}"; then
  echo "Deploy failed. Logs: gcloud run services logs read omniops --region $REGION --limit 50" >&2
  exit 1
fi

URL=$(gcloud run services describe omniops --project "$PROJECT_ID" --region "$REGION" --format "value(status.url)")
echo
echo "Deployed: $URL"
echo "Warm up:  curl -s $URL/api/health"
