# Latimer-Woods-Tech Factory — Naming Conventions

> **Status:** Canonical · **Owner:** factory/CODEOWNERS
> **Source:** [factory#72](https://github.com/Latimer-Woods-Tech/factory/issues/72), [factory#92](https://github.com/Latimer-Woods-Tech/factory/issues/92)
> **Enforcement:** `scripts/check-naming-conventions.mjs` + `policy-drift-guard.yml` (wired separately per factory#92 Red-tier items)

This document is the single enforced naming reference for all cross-repo consumers of the factory reusable workflow library and Cloudflare resource conventions.

---

## 1. Reusable workflow file / `name:` pairing

Every reusable workflow file in `.github/workflows/` **must** satisfy:

| Rule | Required pattern | Example |
|---|---|---|
| Filename | `_*.yml` (underscore prefix) | `_app-deploy.yml` |
| `name:` field | Matches filename without extension | `name: _app-deploy` |
| Header banner | 5-line block (see §6) | — |

```yaml
# ✅ Correct
# File: .github/workflows/_app-deploy.yml
name: _app-deploy
```

```yaml
# ❌ Wrong
# File: .github/workflows/deploy.yml
name: Deploy to Cloudflare
```

Downstream callers reference by GitHub path:
```yaml
uses: Latimer-Woods-Tech/factory/.github/workflows/_app-deploy.yml@main
```

---

## 2. Deployment environment names

All workflows and `wrangler.jsonc` environment stanzas **must** use exactly:

| Environment | Canonical name |
|---|---|
| Pre-production / preview | `staging` |
| Live traffic | `production` |

**Never use:** `prod`, `preview`, `preprod`, `dev`, `development`, `live`.

---

## 3. Canonical Cloudflare secret names

Reusable workflows and app callers **must** use:

| Secret | Purpose |
|---|---|
| `CF_API_TOKEN` | Cloudflare API token (Wrangler deploys) |
| `CF_ACCOUNT_ID` | Cloudflare account ID |

**Deprecated (do not introduce):** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_KEY`.

Where tooling requires the legacy `CLOUDFLARE_*` form, reusable workflows translate via `env:` mapping — callers always pass `CF_*`.

```yaml
# Correct caller usage
secrets:
  CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
  CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
```

---

## 4. Account-scoped Workers URL convention

All Cloudflare Workers preview URLs use the `adrper79` account subdomain:

```
https://<worker-name>.adrper79.workers.dev
```

**Not:** `<worker>.workers.dev` (ambiguous), `<worker>.latimer-woods-tech.workers.dev` (invalid subdomain).

Production custom domains are documented per-app in `docs/service-registry.yml`.

---

## 5. Smoke-test credential naming

GitHub Actions secrets for smoke/integration testing:

| Pattern | Tier | Example |
|---|---|---|
| `SMOKE_USER_*` | Individual tier | `SMOKE_USER_EMAIL`, `SMOKE_USER_PASSWORD` |
| `SMOKE_PRACTITIONER_*` | Practitioner tier | `SMOKE_PRACTITIONER_EMAIL`, `SMOKE_PRACTITIONER_PASSWORD` |

Smoke secrets **must never** use production user credentials.

---

## 6. Reusable workflow header banner

Every reusable workflow file must begin with this 5-line block:

```yaml
# =============================================================================
# <one-line description>
# Org: Latimer-Woods-Tech/factory  ·  Caller: <consuming repo(s)>
# Trigger: workflow_call
# =============================================================================
```

---

## 7. Enforcement status

> ⚠️ The enforcement automation below is **not yet wired** and requires a separate Red-tier human PR (tracked in factory#92):
> - `scripts/check-naming-conventions.mjs` — lints reusable workflows on push/PR
> - `.github/workflows/ci.yml` extension — runs check on PRs
> - `.github/workflows/policy-drift-guard.yml` extension — nightly drift detection

Until that PR lands, this document is the authoritative reference. Violations found during manual review should be filed as issues labeled `hardening`.

---

*Maintained by factory CODEOWNERS. Open an issue labeled `hardening` to propose changes.*
