# SYN-6 Migration Guide — HumanDesign Workflow Rollout (18 → 3)

**Factory issue:** `factory#77`  
**Parent:** `factory#68` (SYN-0 cross-repo synergies)  
**Target repo:** `Latimer-Woods-Tech/HumanDesign`

---

## What this does

Replaces 18 bespoke workflow files in the HumanDesign repo with 3 thin callers of
factory's reusable workflows. Every CI, deploy, and canary concern is consolidated.

## Deletions (18 files)

| File | Absorbed into |
|---|---|
| `analytics-smoke.yml` | `canary.yml` (scheduled health probe) |
| `audit-cron.yml` | dropped — HumanDesign-specific audit loop, not CI |
| `auto-add-to-project.yml` | dropped — factory handles project board sync |
| `check-module-mismatch.yml` | `ci.yml` via `_app-ci.yml` lint step |
| `codeql.yml` | dropped — org-level GitHub Advanced Security |
| `data-action-check.yml` | `ci.yml` via `_app-ci.yml` test step |
| `deploy-frontend.yml` | `deploy.yml` via `_app-deploy-pages.yml` |
| `deploy-recovery.yml` | `deploy.yml` auto-rollback via `_post-deploy-verify.yml` |
| `deploy-workers.yml` | `deploy.yml` via `_app-deploy.yml` |
| `e2e-credential-tests.yml` | `deploy.yml` post-deploy health gate |
| `generate-library-sample.yml` | dropped — phase 4 work complete |
| `migration-drift-guard.yml` | `ci.yml` via workers `_app-ci.yml` test step |
| `phase4-canary.yml` | dropped — phase 4 complete; covered by `canary.yml` |
| `playwright-smoke.yml` | `canary.yml` via `_app-prod-canary.yml` canary script |
| `playwright-visual.yml` | dropped — handled in `ci.yml` test suite |
| `prod-canary.yml` | `canary.yml` via `_app-prod-canary.yml` |
| `project-status-sync.yml` | dropped — factory manages status sync |
| `run-db-checks.yml` | `ci.yml` via workers `_app-ci.yml` test step |
| `sync-worker-secrets.yml` | dropped — factory `setup-app-secrets.yml` handles |

> **`run-migrations.yml`** is kept as-is (manual trigger only, not regular CI/CD).

## Additions (3 files)

The files below are the exact YAML to create in HumanDesign's
`.github/workflows/` directory. They are thin callers — do not add extra
inline steps without proposing a change to factory's reusable first.

### 1. `ci.yml`

See [ci.yml](./ci.yml).

### 2. `deploy.yml`

See [deploy.yml](./deploy.yml).

### 3. `canary.yml`

See [canary.yml](./canary.yml).

---

## Applying the migration

```bash
# 1. Clone HumanDesign
git clone git@github.com:Latimer-Woods-Tech/HumanDesign.git
cd HumanDesign
git checkout -b chore/syn-6-workflow-consolidation

# 2. Remove the 18 old workflows
git rm .github/workflows/analytics-smoke.yml
git rm .github/workflows/audit-cron.yml
git rm .github/workflows/auto-add-to-project.yml
git rm .github/workflows/check-module-mismatch.yml
git rm .github/workflows/codeql.yml
git rm .github/workflows/data-action-check.yml
git rm .github/workflows/deploy-frontend.yml
git rm .github/workflows/deploy-recovery.yml
git rm .github/workflows/deploy-workers.yml
git rm .github/workflows/e2e-credential-tests.yml
git rm .github/workflows/generate-library-sample.yml
git rm .github/workflows/migration-drift-guard.yml
git rm .github/workflows/phase4-canary.yml
git rm .github/workflows/playwright-smoke.yml
git rm .github/workflows/playwright-visual.yml
git rm .github/workflows/prod-canary.yml
git rm .github/workflows/project-status-sync.yml
git rm .github/workflows/run-db-checks.yml
git rm .github/workflows/sync-worker-secrets.yml

# 3. Copy the 3 new workflows from this migration bundle
cp path/to/syn-6-humandesign-workflow-rollout/ci.yml      .github/workflows/ci.yml
cp path/to/syn-6-humandesign-workflow-rollout/deploy.yml  .github/workflows/deploy.yml
cp path/to/syn-6-humandesign-workflow-rollout/canary.yml  .github/workflows/canary.yml

# 4. Commit and push
git add .
git commit -m "chore(workflows): consolidate 18 → 3 via factory reusable (SYN-6)"
git push -u origin chore/syn-6-workflow-consolidation
# 5. Open PR — target main
# Checklist: CI passes, CODEOWNERS approve, Adrian merges
```

---

## Acceptance gates

- [ ] `ci.yml` passes on PR
- [ ] `deploy.yml` deploys Workers (`api.selfprime.net/health` → 200) on push to `main`
- [ ] `deploy.yml` deploys Pages (`selfprime.net` → 200) on push to `main`
- [ ] `canary.yml` scheduled run passes
- [ ] Old 18 workflow files absent from `main`
