# Cross-Repo Release Train

**Owner:** DevOps + package team  
**Last updated:** 2026-04-29  
**W360:** W360-025  
**Status:** ✅ documented and automatable

---

## Purpose

A single Factory package bump must propagate reliably across all consumer apps
(internal in `apps/`, external repos such as `prime-self`, `xico-city`, etc.) via
a deterministic, auditable, and CI-gated sequence.

This document covers the full path: **package bump → lockfile update → staging deploy
→ smoke → production**.

---

## 1. Release Train Topology

```
Factory repo
└── packages/{name}/
    ├── package.json  (version bumped + tagged)
    └── dist/         (tsup ESM build)
          │  published to GitHub Package Registry
          ▼
Consumer lockfiles
├── apps/{app}/package-lock.json   (internal, same repo)
├── prime-self/package-lock.json   (external repo)
├── xico-city/package-lock.json    (external repo)
└── …
          │  updated via npm install / Renovate PR
          ▼
Staging deploy → smoke → production
```

### Dependency order for incremental builds (publish.yml respects this)

1. errors → 2. monitoring → 3. logger → 4. auth → 5. neon → 6. stripe
7. llm → 8. telephony → 9. analytics → 10. deploy → 11. testing
12. email → 13. copy → 14. content → 15. social → 16. seo
17. crm → 18. compliance → 19. admin → 20. video → 21. schedule → 22. validation

---

## 2. Triggering a Release

### 2a. Manual: script-assisted

```sh
# Bump version and tag in one command
node scripts/bump-and-tag.mjs <package-short-name> <patch|minor|major>

# Examples
node scripts/bump-and-tag.mjs auth patch     # auth/v1.0.1
node scripts/bump-and-tag.mjs neon minor     # neon/v1.1.0
node scripts/bump-and-tag.mjs errors major   # errors/v2.0.0
```

This script:
1. Runs `npm version <bump>` inside `packages/{name}/`
2. Creates git tag `{name}/v{new-version}`
3. Pushes tag to `origin`, triggering `publish.yml`

### 2b. Renovate (automated dependency PRs in consumers)

Renovate watches the GitHub Package Registry for new `@latimer-woods-tech/*` versions.
Consumer repos receive a Renovate PR with a lockfile update automatically.
No further action is required in most cases — merge the PR after CI passes.

---

## 3. step-by-step procedure

### Step 1: pre-release checks (in Factory repo)

```sh
cd packages/<name>

# TypeScript strict — zero errors
npm run typecheck

# ESLint — zero warnings
npm run lint

# Tests — ≥ 90% line/function, ≥ 85% branch coverage
npm test -- --coverage

# Build succeeds and dist/ is clean
npm run build
```

All four must pass before tagging.

### Step 2: bump and tag

```sh
node scripts/bump-and-tag.mjs <name> <bump>
```

GitHub Actions `publish.yml` triggers automatically on the new tag and publishes to
`https://npm.pkg.github.com`.

### Step 3: update internal consumer lockfiles

Internal apps in `apps/` that depend on the package:

```sh
# From the Factory repo root
cd apps/<app>
npm install @latimer-woods-tech/<name>@<new-version>
# Commits package-lock.json
git add package-lock.json package.json
git commit -m "chore(<app>): bump @latimer-woods-tech/<name> to <new-version>"
```

Then push and let CI run (`validate` workflow) before continuing.

### Step 4: update external consumer lockfiles

For external repos (prime-self, xico-city, etc.):

```sh
# In external repo root
npm install @latimer-woods-tech/<name>@<new-version>
git add package-lock.json package.json
git commit -m "chore: bump @latimer-woods-tech/<name> to <new-version>"
git push origin main
```

Alternatively, merge the Renovate PR if it already targets the correct version.

### Step 5: staging deploy

```sh
# For each affected Worker / Pages app (internal or external)
npm run deploy:staging
```

Expected CI outcome: all package-integration and typecheck jobs green.

### Step 6: staging smoke

```sh
# Verify health endpoint
curl https://<name>.adrper79.workers.dev/health   # → 200

# For external apps verify their deployed staging URL
curl https://<app-staging-url>/health             # → 200
```

Record the curl output with timestamp and run ID.

### Step 7: production deploy

Only after staging smoke is observed (not just CI green):

```sh
npm run deploy:production
```

Verify:

```sh
curl https://<app>.adrper79.workers.dev/health   # → 200
```

### Step 8: post-release

- Update `CHANGELOG.md` with what changed and which apps were consumers.
- If the bump includes a breaking change, post a note in the shared Slack/channel.
- Close the W360 / OWR item that triggered the release.

---

## 4. Package integration CI gate

The `package-integration.yml` workflow runs on every PR touching `packages/` and
verifies that the full dependency chain still builds.  
A PR may not be merged if this job fails.

Relevant workflow: `.github/workflows/package-integration.yml`

---

## 5. Verification evidence template

Copy into PR description or runbook entry after each release:

```
Package: @latimer-woods-tech/<name>
Old version: <old>
New version: <new>
Tag: <name>/v<new>
Publish run: https://github.com/Latimer-Woods-Tech/factory/actions/runs/<id>

Internal consumers updated:
- apps/<app>: lockfile updated, CI run <id>, ✅ green
- (list all)

External consumers updated:
- <repo>: lockfile updated, CI run <id>, ✅ green / Renovate PR #<n>

Staging smoke:
- <url>/health → 200 @ <UTC timestamp>

Production smoke:
- <url>/health → 200 @ <UTC timestamp>
```

---

## 6. Breaking changes protocol

If the package exports change in a breaking way:

1. Bump the major version.
2. Open a codemod PR to each consumer before releasing.
3. Land consumer PRs first, merge the new package version after.
4. Never leave a consumer broken in `main`.

---

## 7. Emergency rollback

```sh
# Re-publish the previous version tag (do NOT delete tags)
git checkout <name>/v<prev-version>
cd packages/<name> && npm publish
# Then revert consumer lockfiles to the previous version
```

Rollback must also be smoke-tested:

```sh
curl https://<app>.adrper79.workers.dev/health   # → 200
```
