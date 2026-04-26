#!/usr/bin/env bash
# setup-secrets.sh — Interactive Wrangler secret configuration for a new Factory app.
# Usage: ./scripts/setup-secrets.sh <worker-name>

set -euo pipefail

WORKER="${1:-}"
if [[ -z "$WORKER" ]]; then
  echo "Usage: $0 <worker-name>"
  exit 1
fi

SECRETS=(
  "DATABASE_URL"
  "SENTRY_DSN"
  "POSTHOG_KEY"
  "JWT_SECRET"
  "ANTHROPIC_API_KEY"
  "GROK_API_KEY"
  "GROQ_API_KEY"
  "RESEND_API_KEY"
  "TELNYX_API_KEY"
  "TELNYX_WEBHOOK_SECRET"
  "DEEPGRAM_API_KEY"
  "ELEVENLABS_API_KEY"
)

echo "🔐 Configuring secrets for Worker: $WORKER"
echo ""

for secret in "${SECRETS[@]}"; do
  read -rsp "Enter value for $secret (leave blank to skip): " value
  echo ""
  if [[ -n "$value" ]]; then
    echo "$value" | wrangler secret put "$secret" --name "$WORKER"
    echo "✅ $secret set."
  else
    echo "⏭  $secret skipped."
  fi
done

echo ""
echo "✅ Secret configuration complete for $WORKER."
