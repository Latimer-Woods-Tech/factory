# Deployment Runbook

This runbook covers staging and production deployments for a Factory app Worker.

## Environment overview

| Environment | Wrangler env | Domain |
|---|---|---|
| Local dev | (none) | `localhost:8787` |
| Staging | `staging` | `{app}-staging.{account}.workers.dev` |
| Production | `production` | `{app}.thefactory.dev` |

Secrets are managed per-environment via Wrangler secrets and are **never stored in source**.

## Prerequisites

- `CF_API_TOKEN` with Workers Deploy permission (this is the canonical name used by all Factory workflows)
- `CLOUDFLARE_ACCOUNT_ID` for the target account
- GitHub Actions: both secrets must be set at the repo level

> **⚠️ Token naming note**: Factory workflows use `CF_API_TOKEN` (not `CLOUDFLARE_API_TOKEN`). Both are set as GitHub secrets on every app repo so tools that look for either name will work. When writing new workflows, always reference `secrets.CF_API_TOKEN`. See [GitHub Secrets Runbook](./github-secrets-and-tokens.md) for full details.

## 1. Deploy to staging

```bash
wrangler deploy --env staging
```

### Via GitHub Actions

Push to the `staging` branch, or trigger the `deploy-staging` workflow manually:

```bash
gh workflow run deploy.yml -f environment=staging
```

## 2. Smoke-test staging

```bash
BASE=https://{app}-staging.{account}.workers.dev

# Health check
curl -s $BASE/health | jq .

# Auth round-trip (requires a valid JWT_SECRET to be set on staging)
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"..."}' | jq -r .token)

curl -s $BASE/api/me -H "Authorization: Bearer $TOKEN" | jq .
```

## 3. Deploy to production

```bash
wrangler deploy --env production
```

### Via GitHub Actions

Merge to `main`. The `deploy.yml` workflow runs automatically:

1. `typecheck` job must pass.
2. `deploy` job runs `wrangler deploy`.
3. Cloudflare returns a deployment URL — verify `/health`.

## 4. Rollback

### Instant rollback (last deployment)

```bash
wrangler rollback --env production
```

### Rollback to a specific deployment

```bash
# List recent deployments
wrangler deployments list --env production

# Rollback to a specific ID
wrangler rollback <deployment-id> --env production
```

## 5. Check deployment status

```bash
wrangler deployments list --env production
```

Or view in the Cloudflare dashboard: **Workers & Pages → {app} → Deployments**.

## 6. Monitor after deploy

- Check Sentry for new error spikes (first 15 minutes are critical).
- Check PostHog for any drop in key events (page views, conversions).
- Check Cloudflare Analytics for error rate; alert threshold is > 1% 5xx.

## Rollout strategy

Factory Workers are instant-deploy (no canary by default). If the change is high-risk, use a Cloudflare Workers **gradual rollout** via the dashboard, splitting traffic 10% → 50% → 100% over 30-minute windows.

## CI/CD pipeline overview

```
push to main
  └─ typecheck (tsc --noEmit)
       └─ passes ──► deploy (wrangler deploy --env production)
                          └─ Cloudflare returns deployment ID
```
