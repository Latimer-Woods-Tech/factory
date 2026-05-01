# CI/CD Architecture

This document is the canonical reference for how CI/CD works in the Latimer-Woods-Tech org. Every app inherits from this. If you're changing how CI works for a single app, you're probably doing it wrong — change it here.

---

## TL;DR

```
                       ┌──────────────────┐
                       │ Latimer-Woods-Tech│
                       │  (org-level       │
                       │  secrets vault)   │
                       └─────────┬────────┘
                                 │ secrets: inherit
                                 ▼
   ┌──────────────────────────────────────────────────┐
   │  factory (public repo)                           │
   │                                                  │
   │  .github/workflows/                              │
   │    _app-ci.yml             ←── consumed by ──┐   │
   │    _app-deploy.yml         ←── consumed by ──┤   │
   │    _post-deploy-verify.yml ←── consumed by ──┤   │
   └──────────────────────────────────────────────│───┘
                                                  │
              ┌───────────────────────────────────┴───┐
              │                                       │
              ▼                                       ▼
   ┌─────────────────────┐                 ┌─────────────────────┐
   │ Public app repos     │                 │ Private app repos    │
   │ - HumanDesign         │                │ - wordis-bond         │
   │ - videoking           │                │ - cypher-healing      │
   │ - ijustus             │                │ - the-calling         │
   │ - xpelevator          │                │ - neighbor-aid        │
   │                       │                │ - xico-city           │
   │ ci.yml — 5 lines      │                │ - factory-admin       │
   │ deploy.yml — 8 lines  │                │                       │
   └───────────────────────┘                └───────────────────────┘
```

Every app's CI is a thin caller of factory's reusable workflow. **Drift is not allowed** — if you need a different CI shape, propose a change to factory's reusable, don't fork the workflow into your app.

---

## Why factory is public

GitHub Team plan rule: **a private repo's reusable workflows are accessible only to other private repos**. Since 4 of our apps are public (HumanDesign, videoking, ijustus, xpelevator), factory must be public for them to consume reusable workflows. There are no secrets in factory's code — all secrets live in the GitHub Secrets vault. Verified safe.

---

## The three reusable workflows

### `_app-ci.yml`
Run on every push and PR. Authenticates to GitHub Packages so private `@latimer-woods-tech/*` deps install. Runs `typecheck`, `lint`, `test`, `build` from the app's package.json (skipping any that don't exist).

**Caller:**
```yaml
jobs:
  ci:
    uses: Latimer-Woods-Tech/factory/.github/workflows/_app-ci.yml@main
    secrets: inherit
```

Full input/secret reference is in the workflow's header comment.

### `_app-deploy.yml`
Targets a GitHub Environment (`staging` or `production`) and deploys to Cloudflare Workers via `wrangler-action@v3`. Optional inline health check.

**Caller:**
```yaml
jobs:
  deploy:
    uses: Latimer-Woods-Tech/factory/.github/workflows/_app-deploy.yml@main
    with:
      environment: production
      health_url: https://app.example.com/healthz
    secrets: inherit
```

### `_post-deploy-verify.yml`
Stronger post-deploy check with retry/backoff plus optional auto-rollback to a captured prior version ID. Use this for production-grade deploys; the inline health check in `_app-deploy.yml` is fine for staging.

**Caller (chained):**
```yaml
jobs:
  deploy:
    uses: Latimer-Woods-Tech/factory/.github/workflows/_app-deploy.yml@main
    secrets: inherit
  verify:
    needs: deploy
    uses: Latimer-Woods-Tech/factory/.github/workflows/_post-deploy-verify.yml@main
    with:
      health_url: https://app.example.com/healthz
      rollback_on_failure: true
      worker_name: app-production
      previous_version_id: ${{ needs.deploy.outputs.previous_version_id }}
    secrets: inherit
```

---

## Authentication chain

How a deploy authenticates, end to end:

1. **App repo's workflow** is triggered by a push.
2. **`secrets: inherit`** passes org-level secrets into factory's reusable workflow.
3. **`actions/create-github-app-token@v2`** mints a short-lived (~1h) GitHub App installation token from `FACTORY_APP_ID` + `FACTORY_APP_PRIVATE_KEY`. This token has scoped access only to the Latimer-Woods-Tech org.
4. **GitHub Packages** uses that token to authenticate `npm ci` for `@latimer-woods-tech/*` deps.
5. **Cloudflare** is authenticated via `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (org-level secrets).

No long-lived PATs in CI. The GitHub App is the source of truth.

---

## Required secrets (org-level)

These live at https://github.com/organizations/Latimer-Woods-Tech/settings/secrets/actions, visibility `all repositories`:

| Name | Source | Used by |
|---|---|---|
| `FACTORY_APP_ID` | GitHub App `factory-cross-repo` | Every CI/deploy workflow |
| `FACTORY_APP_PRIVATE_KEY` | GitHub App PEM | Every CI/deploy workflow |
| `FACTORY_APP_INSTALLATION_ID` | GitHub App install on org | Maintenance scripts |
| `FACTORY_APP_CLIENT_ID` | GitHub App OAuth ID | Reserved |
| `CLOUDFLARE_API_TOKEN` | CF dashboard | Deploy workflows |
| `CLOUDFLARE_ACCOUNT_ID` | CF dashboard | Deploy workflows |
| `CF_API_TOKEN` | Legacy alias of above | Deprecated, will be removed |
| `STRIPE_SECRET_KEY` | Stripe dashboard | HumanDesign + payment-touching apps |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard | Same |
| `STRIPE_PRICE_*` | Stripe price objects | HumanDesign (10 prices) |
| `NPM_TOKEN` | npm.com automation token | Future public publishes |
| `SENTRY_DSN_*` | Sentry project DSNs | Per-app observability |
| `HYPERDRIVE_*` | CF Hyperdrive config IDs | Per-app DB connection |
| `POSTHOG_PROJECT_TOKEN` | PostHog | Analytics |

To add a new org secret programmatically: see `docs/runbooks/secret-rotation.md`.

---

## Required repo state

Every consuming app repo must have:

1. **Default branch** named `main`.
2. **Repository ruleset** blocking force-push, deletion, non-linear history (already provisioned by factory's setup workflows).
3. **GitHub Environments** named `staging` and `production`.
   - Public repos: full required-reviewer protection on `production`.
   - Private repos on Team plan: bare environments only (Enterprise needed for required reviewers on private).
4. **CODEOWNERS** at `.github/CODEOWNERS`.
5. **A `package.json` at the working directory** the workflow targets (root by default).

If any of these are missing on a repo, run `factory/.github/workflows/setup-app-secrets.yml` and `scaffold-all-apps.yml` to bring it into compliance.

---

## Verifying cross-repo access

If `uses: Latimer-Woods-Tech/factory/...` returns `workflow was not found` from a consumer:

1. Check factory's repo Settings → Actions → General → "Access" is set to **"Accessible from repositories in the 'Latimer-Woods-Tech' organization."** (Public→public works automatically; private→private needs this toggle.)
2. Check the org's Actions policy at https://github.com/organizations/Latimer-Woods-Tech/settings/actions allows external actions (set to "Allow all actions and reusable workflows" by default).
3. If both are correct and it still fails: the consumer is private and the source is private — that combination requires the source to flip the access toggle in the UI even when the API says it's set. Toggle to "Not accessible" → Save → toggle back → Save.

Quick programmatic check:
```bash
gh api /repos/Latimer-Woods-Tech/factory/actions/permissions/access
# expected: {"access_level":"organization"}
```

Quick smoke test:
```yaml
# In any consumer repo, push this to a test branch:
name: smoke
on: { push: { branches: [smoke-test] } }
jobs:
  call:
    uses: Latimer-Woods-Tech/factory/.github/workflows/_app-ci.yml@main
    secrets: inherit
```

If that runs successfully, cross-repo access is healthy.

---

## Environment + ruleset matrix

| Env | Trigger | Reviewer required (public repo) | Reviewer required (private repo, Team) |
|---|---|---|---|
| `staging` | push to `staging/*` or `dev` branches | no | no |
| `production` | push to `main` | yes | no (bare env only) |

To upgrade private repos to required-reviewer protection on production, the org needs to be on GitHub Enterprise.

---

## Adding a new app

See [`NEW_APP_CHECKLIST.md`](NEW_APP_CHECKLIST.md).

---

## Adding a new reusable workflow

1. Create `factory/.github/workflows/_my-thing.yml`.
2. Top of file must be a header comment matching the format in the existing three (purpose, inputs, secrets, conventions, related workflows).
3. Test the workflow with a smoke caller in any private app repo before merging.
4. Update this doc + `README.md`'s repo map.
5. Open a PR.

The underscore prefix (`_*.yml`) is convention for "consumed-by-other-workflows-only, never run directly."

---

## Rollback playbook

If a deploy goes wrong:

1. **Automatic** — if the deploy workflow chained `_post-deploy-verify.yml` with `rollback_on_failure: true`, it already rolled back. Check the run logs.
2. **Manual** — `wrangler versions list --name <worker>` to see versions, then `wrangler versions rollback --name <worker> --version-id <id>`.
3. **Nuclear** — `git revert` the offending commit on `main`, push, let the deploy workflow run forward to the previous good state.

For DB-touching changes, see `docs/runbooks/incident-response.md`.

---

## Drift watch

The `factory-status-dashboard.yml` cron job checks every consumer repo's CI is using the reusable. Any inline CI gets flagged in `docs/STATUS.md` and should be migrated.

---

## Anti-patterns (don't do these)

- ❌ Forking factory's reusable workflow into an app and editing it locally
- ❌ Adding `secrets:` to a caller and hardcoding values; always use `secrets: inherit`
- ❌ Hardcoding secret names in app code; reference org secrets by name only
- ❌ Using long-lived PATs in CI; use the GitHub App
- ❌ Skipping `_post-deploy-verify.yml` for production deploys with money or user data
- ❌ Pushing to `main` without going through CI; rulesets should prevent this anyway
- ❌ Adding workflow files to factory that aren't documented in this file or `README.md`
