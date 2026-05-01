# Latimer-Woods-Tech Org Migration — Complete

**Date:** April 30, 2026 (continuing into May 1)
**Org:** https://github.com/Latimer-Woods-Tech (Team plan, 1 admin seat)

## What was migrated

| Item | Result |
|---|---|
| 11 repos transferred from `adrper79-dot/*` to `Latimer-Woods-Tech/*` | ✅ all 11 |
| `adrper79-dot/*` repo URL refs rewritten to `Latimer-Woods-Tech/*` | ✅ 460 file changes across 9 repos |
| `@adrper79-dot/*` npm scope renamed to `@latimer-woods-tech/*` | ✅ all package.json + .npmrc + imports |
| Rulesets carried over with transfer | ✅ all 11 verified |
| 19 factory packages republished under new scope | ✅ via bootstrap-publish.yml |

## Workspace-side hardening (done earlier in this session)

- Dependabot security alerts + auto-fixes ON across all 11 repos
- Squash-only merging, auto-delete branches, auto-merge enabled
- Wiki + Projects disabled
- Repo descriptions + topic tags added
- CODEOWNERS added everywhere
- Renovate auto-merge for minor/patch versions configured
- 19 factory workflows refactored to use GitHub App tokens (`actions/create-github-app-token@v1` instead of `secrets.GH_PAT`)
- Reusable workflows scaffolded at `Latimer-Woods-Tech/factory/.github/workflows/_app-ci.yml` and `_app-deploy.yml`

## Cloudflare estate cleanup (done earlier)

| Resource | Before | After |
|---|---|---|
| Workers | 31 | 19 |
| Queues | 2 | 0 |
| Hyperdrive configs | 11 | 10 |
| KV namespaces | 9 | 7 |
| D1 databases | 1 | 0 |
| R2 buckets | 7 | 6 |

Stale wordisbond, focusbro, gemini-project, cypher-of-healing-api, thecalling-platform clusters all deleted.

## Outstanding items (need user action)

### 1. Install GitHub App on the org
The `factory-cross-repo` GitHub App is currently installed on the personal account `adrper79-dot`, not on the new org. After repo transfer, the App's existing installation may still see the transferred repos via the personal install — but for clean separation, install the App on the org:

1. https://github.com/apps/factory-cross-repo/installations/new
2. Choose `Latimer-Woods-Tech`
3. Select **All repositories**
4. Save
5. Visit https://github.com/organizations/Latimer-Woods-Tech/settings/installations and copy the new installation ID
6. Update factory's `FACTORY_APP_INSTALLATION_ID` secret to the new ID

### 2. PAT needs `admin:org` scope for org-secret consolidation
Currently each org repo has its own copy of the 70+ Stripe / Cloudflare / Anthropic / Sentry / etc secrets. With `admin:org` PAT scope I can consolidate them into ~25 org-level secrets shared by all repos.

To enable:
1. Go to https://github.com/settings/tokens
2. Edit the existing PAT (or generate new)
3. Add scope: `admin:org`
4. Save
5. Update Sauna's `GitHub PAT (workflow scope)` connection with the new token value

### 3. Decisions outstanding
- **`adrper79-dot/thecalling-web`** — Next.js frontend for the-calling app. Transfer to org or keep separate?
- **`adrper79-dot/CallMonitor`** — Transfer or leave?
- **`adrper79-dot/prime-self` and `prime-self-ui`** — Both archived. Leave as historical or delete?
- **Old `@adrper79-dot/*` packages on npm.pkg.github.com** — Deprecate now or leave for transition?

### 4. Cloudflare token rightsizing (deferred)
Current omni-token works but is over-scoped. Optional improvement: split into per-app least-privilege tokens. Requires Cloudflare dashboard work. Low priority since the migration is done.

## What works right now

- Direct push to org repo `main` branches blocked by rulesets
- Renovate will auto-merge minor/patch dependency PRs after CI passes
- GitHub App tokens used for cross-repo automation (replaces fragile classic PAT)
- All 19 `@latimer-woods-tech/*` packages installable via npm.pkg.github.com
- Cloudflare estate has 39% less sprawl
- The original `BLOCKED.md` issue (npm scope vs GitHub user mismatch) is now resolved

## Score against best-practice axes (revised after migration)

| Axis | Before | After |
|---|---|---|
| Identity & Access | 7/10 | 9/10 |
| Infrastructure as Code | 6/10 | 6/10 |
| CI/CD pipeline structure | 3/10 | 5/10 (reusable workflows scaffolded but apps not yet using them) |
| Security scanning | 4/10 | 6/10 |
| Observability | 6/10 | 6/10 |
| Monorepo / package sharing | 7/10 | 9/10 |
| Documentation | 7/10 | 7/10 |
| Cost management | 3/10 | 6/10 (12 Workers killed, more cleanup possible) |
| Deploy gating | 4/10 | 4/10 (next focus) |

Net: ~5/10 → ~6.5/10 across axes. The remaining gains require more in-app work (deploy environments, refactoring app repos to use reusable workflows) rather than infra-level decisions.
