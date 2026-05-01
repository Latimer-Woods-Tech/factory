# New App Checklist

Use this when adding a new app to the Latimer-Woods-Tech ecosystem. The whole flow takes 30–60 minutes if nothing breaks.

> If you are an agent: read [`AGENTS.md`](AGENTS.md) first. Do not skip steps. Do not invent steps.

---

## 1. Decide on identity

| Field | Notes |
|---|---|
| App name (kebab-case) | Used for repo, Worker, package paths |
| Visibility | Public if customer-facing, private if internal/IP-sensitive |
| Domain | Cloudflare zone + subdomain |
| Stripe required? | Yes if it takes money |
| AI required? | Yes if it uses `@latimer-woods-tech/llm` |

Check no name collision: `gh api /orgs/Latimer-Woods-Tech/repos | jq -r '.[].name'`.

---

## 2. Create the repo

```bash
gh repo create Latimer-Woods-Tech/<app-name> \
  --description "<one line>" \
  --public-or-private \
  --add-readme
```

Then apply the standard ruleset (force-push block, deletion block, linear history) by running factory's `setup-app-secrets.yml` workflow with input `app_name=<app-name>`.

---

## 3. Scaffold the source

Decide structure:
- **Single-purpose Worker:** `wrangler.toml` + `src/` at root
- **Monorepo:** `apps/<app-name>/` plus `packages/`

Required files at the working directory:
- `package.json` with scripts: `typecheck`, `lint`, `test`, `build`
- `tsconfig.json` extending `@latimer-woods-tech/configs/tsconfig` (when published)
- `wrangler.toml` with `[env.production]` and `[env.staging]` blocks
- `.gitignore`, `.npmrc` (registry config)
- `README.md` — what the app is, how to run locally
- `CODEOWNERS` (`* @adrper79-dot` is fine for now)

The `factory-admin-ui` repo is a clean reference; copy from there.

---

## 4. Wire CI/CD

Replace the auto-generated `.github/workflows/ci.yml` with:

```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  ci:
    uses: Latimer-Woods-Tech/factory/.github/workflows/_app-ci.yml@main
    secrets: inherit
```

Replace `.github/workflows/deploy.yml` with:

```yaml
name: deploy
on:
  push: { branches: [main] }
  workflow_dispatch:
jobs:
  deploy:
    uses: Latimer-Woods-Tech/factory/.github/workflows/_app-deploy.yml@main
    with:
      environment: production
      health_url: https://<app>.<domain>/healthz
    secrets: inherit
```

For staging, add a separate workflow triggered on `staging/*` branches with `environment: staging`.

---

## 5. Create GitHub Environments

```bash
gh api -X PUT /repos/Latimer-Woods-Tech/<app>/environments/production
gh api -X PUT /repos/Latimer-Woods-Tech/<app>/environments/staging
```

For public repos, add required-reviewer rules:
```bash
gh api -X PUT /repos/Latimer-Woods-Tech/<app>/environments/production \
  -f wait_timer=0 \
  -F reviewers='[{"type":"User","id":<user-id>}]'
```

Required-reviewer protection on private repos requires GitHub Enterprise.

---

## 6. Provision Cloudflare resources

Run factory's matching provisioning workflow:

| Resource | Workflow |
|---|---|
| Worker | First deploy via `_app-deploy.yml` creates it |
| R2 bucket | `provision-r2.yml` with `app_name=<app>` |
| Hyperdrive | `create-hyperdrive.yml` (manual ID capture) |
| Neon project | Manual via Neon dashboard, then add `HYPERDRIVE_<APP>_URL` to org secrets |
| KV namespace | Add to `wrangler.toml` and run `wrangler kv:namespace create` |
| Custom domain | Cloudflare DNS + Worker Routes |

Add resulting IDs to org-level secrets if shared, or repo-level if app-specific.

---

## 7. Wire observability

- **Sentry:** Run `create-sentry-projects.yml` with input `app_name=<app>`. Adds `SENTRY_DSN_<APP>` to org secrets. Wire into your app's error boundary.
- **PostHog:** Use `POSTHOG_PROJECT_TOKEN` from org secrets. One project shared across apps.
- **Synthetic monitor:** Add a probe to `synthetic-monitor` Worker for the new health URL.

---

## 8. (If applicable) Stripe wiring

Only if the app takes payments:

1. Create products + prices in Stripe (live mode).
2. Add price IDs as `STRIPE_PRICE_<APP>_<SKU>` org secrets (visibility: this app's repo only, or `all` if shared).
3. Configure webhook endpoint pointing at the app's `/api/webhook/stripe`.
4. Add `STRIPE_WEBHOOK_SECRET_<APP>` to repo secrets.
5. Test in test mode first. Always.

See `docs/PLAYBOOKS/STRIPE_WIRING.md` (TODO) for the full playbook.

---

## 9. Wire shared packages

If the app uses any of these, add to `package.json`:

```json
{
  "dependencies": {
    "@latimer-woods-tech/ui": "*",
    "@latimer-woods-tech/validation": "*",
    "@latimer-woods-tech/monitoring": "*",
    "@latimer-woods-tech/stripe": "*",
    "@latimer-woods-tech/llm": "*"
  }
}
```

Remember: these install from GitHub Packages, not npm. The reusable CI workflow handles auth automatically.

---

## 10. First deploy

```bash
git push origin main
```

Watch the Actions tab. The deploy workflow will:
1. Mint a fresh App token
2. `npm ci`
3. `wrangler deploy` to staging or production
4. Probe `/healthz`

If the health check fails, check Sentry. If Sentry has nothing, check `wrangler tail <app>`.

---

## 11. Verify

Final smoke test:
```bash
curl -fsSL https://<app>.<domain>/healthz
# → 2xx + small JSON body
```

Manual verification:
- [ ] App responds at the production URL
- [ ] CI on main is green
- [ ] PR template auto-runs CI on PRs
- [ ] Sentry receives a test error
- [ ] PostHog receives a pageview
- [ ] (If money) Stripe test charge → webhook → DB row

---

## 12. Document

Update factory:
- Add the new app to [`README.md`](../README.md) "Consumers" table
- Add an entry to `docs/APP_SCOPE_REGISTRY.md`
- If it introduced a novel pattern, write it down in `docs/PLAYBOOKS/`

Open a PR titled `chore(factory): onboard <app-name>`.

---

## Common mistakes

- ❌ Adding inline CI steps "just for this app" — use factory's reusable. If it can't, fix factory.
- ❌ Hardcoding production URLs in source — use env vars from `wrangler.toml [env.production.vars]`.
- ❌ Skipping `staging` environment — staging is your emergency exit.
- ❌ Using a personal API key — the App is the source of truth.
- ❌ Forgetting to add the app to the status dashboard's repo list.
