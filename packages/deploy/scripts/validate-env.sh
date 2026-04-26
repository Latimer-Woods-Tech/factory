#!/usr/bin/env bash
# validate-env.sh — Check that all required Factory env vars are present.
# Usage: ./scripts/validate-env.sh [env-file]
# If env-file is provided, it is sourced before validation.

set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

REQUIRED_VARS=(
  "DATABASE_URL"
  "SENTRY_DSN"
  "POSTHOG_KEY"
  "JWT_SECRET"
  "ANTHROPIC_API_KEY"
  "RESEND_API_KEY"
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING+=("$var")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "❌ Missing required environment variables:"
  for var in "${MISSING[@]}"; do
    echo "   - $var"
  done
  exit 1
fi

echo "✅ All required environment variables are set."
