#!/usr/bin/env bash
# deploy.sh — Deploy a Factory Worker to Cloudflare with env validation and Sentry release tagging.
# Usage: ./scripts/deploy.sh <worker-name> [environment]
#
# Environment defaults to "production".
# Requires SENTRY_AUTH_TOKEN and SENTRY_ORG env vars for release tagging (optional).

set -euo pipefail

WORKER="${1:-}"
ENVIRONMENT="${2:-production}"

if [[ -z "$WORKER" ]]; then
  echo "Usage: $0 <worker-name> [environment]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Deploying $WORKER to $ENVIRONMENT..."

# Step 1: Validate required env vars
echo "→ Validating environment variables..."
bash "$SCRIPT_DIR/validate-env.sh"

# Step 2: Wrangler deploy
echo "→ Running wrangler deploy..."
wrangler deploy --name "$WORKER" --env "$ENVIRONMENT"

# Step 3: Tag Sentry release (optional — skip if auth token not set)
RELEASE_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
RELEASE_TAG="${WORKER}@${RELEASE_SHA}"

if [[ -n "${SENTRY_AUTH_TOKEN:-}" && -n "${SENTRY_ORG:-}" ]]; then
  echo "→ Tagging Sentry release: $RELEASE_TAG..."
  sentry-cli releases new "$RELEASE_TAG"
  sentry-cli releases set-commits "$RELEASE_TAG" --auto
  sentry-cli releases finalize "$RELEASE_TAG"
  sentry-cli releases deploys "$RELEASE_TAG" new --env "$ENVIRONMENT"
  echo "✅ Sentry release tagged: $RELEASE_TAG"
else
  echo "⏭  Sentry release tagging skipped (SENTRY_AUTH_TOKEN / SENTRY_ORG not set)."
fi

echo ""
echo "✅ Deployment complete: $WORKER → $ENVIRONMENT"
