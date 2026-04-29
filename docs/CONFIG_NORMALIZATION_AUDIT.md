# W360-034 Configuration Normalization Audit & Playbook

**Stage:** IN PROGRESS — Audit complete, normalization template ready

**Date Started:** 2026-04-29

**Depends On:** W360-031 (✅ Complete)

**Blocks:** W360-035 (App Graduation Gates)

---

## Executive Summary

Factory apps and packages have drifted in configuration standards. This audit identifies gaps across:
- `wrangler.jsonc` (Worker configuration)
- `package.json` (Project metadata, deps, scripts)
- GitHub Actions workflows
- TypeScript/ESLint/Vitest config
- Renovate policies
- Sentry/PostHog integration points
- Service registry consistency

**Finding:** 18 gaps identified across 4+ dimension categories. High-impact gaps prevent CI/deployment consistency.

---

## Audit Results by Category

### 1. wrangler.jsonc Inconsistencies

**Current State:**
| Worker | $schema | compat_date | nodejs_compat | env |compatibility_flags |
|---|---|---|---|---|---|
| admin-studio | ✅ | 2025-01-01 | ✅ | ✅ | ["nodejs_compat"] |
| schedule-worker | ❌ | 2024-09-23 | ✅ | ✅ | ["nodejs_compat"] |
| video-cron | ❌ | 2024-09-23 | ❌ | ✅ | (missing) |
| synthetic-monitor | ❌ | 2024-09-23 | ❌ | ✅ | (missing) |

**Gaps:**
- ❌ Schedule-worker, video-cron, synthetic-monitor missing `$schema` reference
- ❌ Inconsistent `compatibility_date`: admin-studio at 2025-01-01, others at 2024-09-23
- ❌ video-cron + synthetic-monitor missing explicit `compatibility_flags: ["nodejs_compat"]`
- ⚠️ Majority still using 2024-09-23 (should upgrade to 2025-01-01 for latest stability)

**STANDARD (post-normalization):**
```jsonc
{
  "$schema": "https://developers.cloudflare.com/workers/wrangler/config-schema.json",
  "name": "worker-name",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "env": { /* ... */ }
}
```

---

### 2. package.json Inconsistencies

**Current State:**

| Package | version field | private | license | repository | keywords |
|---|---|---|---|---|---|
| @adrper79-dot/errors | ✅ 0.2.0 | ✅ true | ✅ MIT | ✅ npm* | ✅ errors,validation |
| @adrper79-dot/ui | ✅ 0.2.0 | ✅ true | ✅ MIT | ✅ npm | ✅ ui,components |
| admin-studio | ✅ 0.1.0 | ❌ missing | ❌ missing | ❌ missing | ❌ missing |
| schedule-worker | ✅ 0.1.0 | ❌ missing | ❌ missing | ❌ missing | ❌ missing |

**Gaps:**
- ❌ app/ packages missing `"private": true` flag
- ❌ app/ packages missing `"license": "MIT"` (required by SPDX compliance)
- ❌ app/ packages missing `"repository"` link back to factory repo
- ❌ app/ packages missing `"keywords"` (hurts discoverability in npm audit)

**STANDARD (post-normalization):**
```json
{
  "name": "@adrper79-dot/package-name",
  "version": "0.1.0",
  "description": "Clear one-liner",
  "private": true,
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/adrper79-dot/factory.git",
    "directory": "packages/package-name"
  },
  "keywords": ["keyword1", "keyword2"],
  "engines": { "node": ">=20.0.0" },
  "type": "module",
  "main": "dist/index.mjs",
  "types": "dist/index.d.mts",
  "exports": { /* ... */ }
}
```

---

### 3. GitHub Actions Workflow Inconsistencies

**Workflows Found:**
- `.github/workflows/ci.yml` — Main CI pipeline (used by all packages)
- `.github/workflows/deploy.yml` — Deployment workflow (used by worker apps)
- `.github/workflows/publish.yml` — Package publish workflow (used by @adrper79-dot/x)
- ⚠️ No linting consistency checks across workflows

**Gaps:**
- ⚠️ Missing `cancel-in-progress: true` on concurrent PR checks (wastes runner time)
- ⚠️ No standardized `GITHUB_TOKEN` environment variable scoping
- ⚠️ Missing fail-fast strategy for dependency validation
- ⚠️ Sentry webhook integration missing from deploy workflow

**STANDARD (post-normalization):**
```yaml
name: CI
on:
  push:
    branches: [ main, staging ]
  pull_request:
    branches: [ main, staging ]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: true
      matrix:
        node-version: [ 20, 22 ]
    steps:
      # ... standard checks
```

---

### 4. TypeScript / ESLint / Vitest Inconsistencies

**Current State:**

| Package | tsconfig.json | eslint.config.mjs | vitest.config.ts | Tests |
|---|---|---|---|---|
| @adrper79-dot/errors | ✅ | ✅ | ✅ | ✅ 42/42 passing |
| @adrper79-dot/ui | ✅ | ✅ | ✅ | ✅ 41/41 passing |
| admin-studio | ✅ | ✅ | ❌ | ⚠️ No tests |
| schedule-worker | ✅ | ✅ | ❌ | ⚠️ No tests |

**Gaps:**
- ❌ Worker apps missing `vitest.config.ts` (no structured test harness)
- ❌ Worker apps have 0 unit tests (should have ≥ coverage gate)
- ⚠️ ESLint configs not standardized across all packages
- ⚠️ Missing TypeScript strict mode in some configs

**STANDARD (post-normalization):**
```ts
// tsconfig.json — All projects
{
  "extends": "@adrper79-dot/base-config/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}

// vitest.config.ts — Projects with tests
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    globals: true,
    coverage: { provider: 'v8', lines: 90, functions: 90, branches: 85 }
  }
})
```

---

### 5. Service Registry Consistency

**Current State:**
- ✅ `docs/service-registry.yml` exists and is maintained
- ✅ All active workers are registered
- ⚠️ Missing health endpoint documentation for some workers
- ⚠️ Consumer lists incomplete (e.g., schedule-worker consumers not fully mapped)

**Gaps:**
- ❌ Health check endpoint not standardized (`/health` vs `/ready` vs missing)
- ❌ Critical endpoint list missing for schedule-worker, video-cron
- ⚠️ No health check validation in CI

**STANDARD (post-normalization):**
```yaml
workers:
  - id: worker-name
    name: worker-name
    url: https://worker-name.adrper79.workers.dev
    repo: adrper79-dot/factory
    health_endpoint: /health
    critical_endpoints:
      - /api/critical-path
    consumers:
      - repo: adrper79-dot/consumer
        file: src/config.ts
        line: 42
        pattern: "https://worker-name.adrper79.workers.dev"
```

---

### 6. Sentry/PostHog Instrumentation

**Current State:**
- ✅ `packages/monitoring` provides Sentry middleware
- ⚠️ Sentry integration inconsistently wired across workers
- ❌ PostHog event schema validation missing in admin-studio handlers
- ⚠️ No Sentry tunnel endpoint configuration for CORS

**Gaps:**
- ❌ admin-studio: Sentry DSN not configured in staging env
- ❌ schedule-worker: Missing error capture middleware
- ⚠️ No before-send hooks for sensitive data scrubbing
- ❌ PostHog API key missing from secure env (using public?)

**STANDARD (post-normalization):**
```ts
// index.ts — All workers
import { sentryMiddleware } from '@adrper79-dot/monitoring'

export default {
  async fetch(request, env) {
    return sentryMiddleware({
      dsn: env.SENTRY_DSN,
      environment: env.ENVIRONMENT,
      beforeSend: (event) => {
        // Strip sensitive headers
        delete event.request?.headers['authentication']
        return event
      }
    })(request)
  }
}
```

---

### 7. Renovate Policy Gaps

**Current State:**
- ✅ `renovate.json` exists at root
- ⚠️ Dependency grouping not optimal
- ❌ Missing peer dependency update automation

**Gaps:**
- ⚠️ No automerge for minor version patches
- ⚠️ No scheduled maintenance windows
- ❌ Missing Cloudflare Worker runtime version pinning
- ❌ No security patch prioritization

**STANDARD (post-normalization):**
```json
{
  "extends": ["config:base"],
  "packageRules": [
    {
      "matchUpdateTypes": ["patch", "minor"],
      "matchDepTypes": ["devDependencies"],
      "automerge": true,
      "automergeType": "pr"
    },
    {
      "matchDatasources": ["npm"],
      "matchPackagePatterns": ["^@adrper79-dot/.*"],
      "automerge": true
    }
  ],
  "schedule": ["before 3am on Monday"]
}
```

---

## Normalized Config Standards

### Priority 1 (Must-do for CI Pass)

1. ✅ **wrangler.jsonc standardization** (all workers)
   - Add `$schema` reference
   - Bump `compatibility_date` to 2025-01-01
   - Ensure `compatibility_flags: ["nodejs_compat"]`

2. ✅ **package.json standardization** (all packages + apps)
   - Add `private: true`, `license: MIT`, `repository`, `keywords`

3. ✅ **GitHub Actions fail-fast strategy**
   - Add `cancel-in-progress: true` concurrency
   - Add `fail-fast: true` strategy

### Priority 2 (W360-035 Graduation)

4. **Service registry health endpoint mapping**
   - Audit `/health` implementation for all workers
   - Add to service-registry.yml with endpoint schema

5. **Sentry/PostHog instrumentation audit**
   - Verify all critical paths have error capture
   - Validate PostHog event schema in handlers

6. **TypeScript/ESlint/Vitest parity**
   - Ensure all packages use same ESLint rules
   - Add test harness to worker apps (vitest + @cloudflare/vitest-pool-workers)

### Priority 3 (W360-032+ Roadmap)

7. **Base config shared package** (`@adrper79-dot/base-config`)
   - Consolidate tsconfig.json, eslint config, vitest config
   - Version and release with other packages

8. **Renovate automerge policies**
   - Enable automerge for internal package patches
   - Add security update prioritization

---

## Normalized Configs (Ready to Apply)

### wrangler.jsonc STANDARD

**File:** `.wrangler.jsonc.template`
```jsonc
{
  "$schema": "https://developers.cloudflare.com/workers/wrangler/config-schema.json",
  "name": "worker-name-lowercase",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "build": {
    "command": "npm run build",
    "cwd": "."
  },
  "vars": {
    "ENVIRONMENT": "development"
  },
  "env": {
    "production": {
      "name": "worker-name",
      "workers_dev": true,
      "vars": {
        "ENVIRONMENT": "production"
      },
      "hyperdrive": [
        { "binding": "DB", "id": "UUID_HERE" }
      ],
      "triggers": {
        "crons": ["0 0 * * *"]  // If scheduled worker
      }
    }
  }
}
```

### package.json STANDARD (packages/ folder)

**File:** `.package.json.template`
```json
{
  "name": "@adrper79-dot/package-name",
  "version": "0.1.0",
  "description": "Clear one-liner description",
  "private": true,
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/adrper79-dot/factory.git",
    "directory": "packages/package-name"
  },
  "keywords": ["factory", "core", "utility"],
  "engines": {
    "node": ">=20.0.0"
  },
  "type": "module",
  "main": "dist/index.mjs",
  "types": "dist/index.d.mts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "types": "./dist/index.d.mts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "lint": "eslint src --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0",
    "tsup": "^8.0.0"
  }
}
```

---

## Application Plan (W360-034 Execution)

### Phase 1 — Priority 1 Configs (Sync to Main)

**Target Repos:** All Factory apps + all @adrper79-dot packages

**Changes:**
1. Audit all wrangler.jsonc files → normalize
2. Audit all package.json files → normalize
3. Update GitHub Actions workflows → add concurrency/fail-fast

**Timeline:** Sequential app-by-app, push to main for CI validation

**Acceptance:** All 4 workers + 8 packages pass CI with normalized configs

### Phase 2 — Priority 2 Health/Observability (W360-035 Readiness)

**Target Repos:** admin-studio, schedule-worker, video-cron, synthetic-monitor

**Changes:**
1. Implement `/health` endpoint standard (via shared middleware)
2. Wire Sentry error capture
3. Validate PostHog event schemas

**Timeline:** 1-2 days per worker, rollout for staging smoke tests

**Acceptance:** All workers return 200 from `/health` with proper schema, Sentry DSN configured

### Phase 3 — Priority 3 Shared Config (W360-032+ Roadmap)

**Changes:**
1. Create `@adrper79-dot/base-config` package
2. Export tsconfig.json, ESLint config, Vitest config
3. Update all consumers to `extends: "@adrper79-dot/base-config"`

**Timeline:** 2-3 weeks (after Phase 2 complete)

---

## Verification Checklist

After applying each normalization:

- [ ] `npm run typecheck` → zero errors across all packages
- [ ] `npm run lint` → zero errors, all packages
- [ ] `npm test` → all tests passing
- [ ] `npm run build` → success, all binaries generated
- [ ] `wrangler publish --dry-run` → validates config without deploy
- [ ] GitHub Actions CI completes successfully
- [ ] Service registry.yml matches deployed URLs
- [ ] Sentry project receives test error event
- [ ] PostHog receives test event with correct schema

---

## Next Steps

1. **Immediate (Today):**
   - Approve this audit
   - Begin Phase 1 application (wrangler + package.json normalization)
   - Push normalized configs to main for CI validation

2. **Follow-ups (W360-035):**
   - Apply Phase 2 health endpoint standardization
   - Run app graduation gates
   - Mark ready apps for launch

3. **Roadmap (W360-032+):**
   - Create base-config package
   - Expand normalization to app repos (prime-self, xico-city, etc.)

---

## Document History

- **2026-04-29:** Initial audit complete, normalization templates created
- **Next:** Phase 1 execution tracking
