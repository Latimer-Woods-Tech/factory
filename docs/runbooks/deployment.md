# Deployment Runbook

This runbook covers staging and production deployments for a Factory app Worker.

## Environment overview

| Environment | Wrangler env | Domain |
|---|---|---|
| Local dev | (none) | `localhost:8787` |
| Staging | `staging` | `{app}-staging.{account}.workers.dev` |
| Production | `production` | `{app}.thefactory.dev` |

For the Factory Cloudflare account, `{account}` is always `adrper79`, so staging-style Worker URLs use `{app}-staging.adrper79.workers.dev` and direct production Worker URLs use `{app}.adrper79.workers.dev` unless a custom domain is documented in [Service Registry](../service-registry.yml).

Secrets are managed per-environment via Wrangler secrets and are **never stored in source**.

## Prerequisites

- `CF_API_TOKEN` with Workers Deploy permission (this is the canonical name used by all Factory workflows)
- `CLOUDFLARE_ACCOUNT_ID` for the target account
- GitHub Actions: both secrets must be set at the repo level

> **⚠️ Token naming note**: Factory workflows use `CF_API_TOKEN` (not `CLOUDFLARE_API_TOKEN`). Both are set as GitHub secrets on every app repo so tools that look for either name will work. When writing new workflows, always reference `secrets.CF_API_TOKEN`. See [GitHub Secrets Runbook](./github-secrets-and-tokens.md) for full details.

## 1. Deploy to staging

### Ready-to-deploy checklist

- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run lint` passes with `--max-warnings 0`.
- [ ] `npm test` passes for touched packages/apps.
- [ ] `npm run build` passes when the package/app defines a build script.
- [ ] Required Wrangler secrets are set for the target Worker.
- [ ] [Service Registry](../service-registry.yml) has the canonical Worker name, URL, critical endpoints, consumers, bindings, and secrets.
- [ ] Any Worker rename followed the rename protocol before deployment.
- [ ] Rollback path is known before production deploy begins.

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

### Per-app smoke tests

After every staging or production deploy, test the Worker-specific `critical_endpoints` listed in [Service Registry](../service-registry.yml), not only `/health`.

Minimum smoke set:

1. `GET /health` returns `200`.
2. Public read endpoints return the documented status.
3. Protected endpoints return `401` or `403` without credentials, not `5xx`.
4. Authenticated operator endpoints return the expected status with valid credentials.
5. Mutating endpoints reject invalid payloads with structured `4xx` errors.

For the shared video Workers, the Phase 0 smoke set is:

- `schedule-worker`: `/health`, `/jobs/pending`, `/jobs/:id`, `/jobs`, `/migrate`.
- `video-cron`: `/health`, `/trigger`.

Do not mark deployment complete until the expected HTTP status codes are observed directly.

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

Before rollback, confirm whether rollback is safe:

1. **Schema changed?** Prefer a forward fix if rollback would strand new rows or break migrated data.
2. **Consumers changed?** Roll back consumers first if the Worker URL or response contract changed.
3. **Secrets changed?** Verify the previous deployment can still read required Wrangler secrets.
4. **Money movement involved?** Pause payouts/webhooks before rollback and reconcile after recovery.
5. **Telemetry changed?** Keep correlation IDs stable so incident review remains traceable.

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
