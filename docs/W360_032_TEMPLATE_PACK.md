# W360-032 Template Buildout Pack

**Purpose:** Establish reusable templates for spinning up Factory apps and supporting infrastructure quickly and correctly.

**Status:** IN PROGRESS — Creating template inventory

**Date:** 2026-04-29

**Depends On:** W360-031 ✅ (app scope registry complete)

**Unblocks:** W360-033 (standards), W360-035 (app graduation)

---

## Template Categories & Status

### 1. Worker Templates (Cloudflare Workers)

#### 1.1 — Basic Hono Worker
**Template:** `docs/templates/worker-basic.wrangler.jsonc`

**Scope:** Minimal Hono-based Worker with health/ready endpoints

**Files:**
- `wrangler.jsonc` (normalized config per W360-034)
- `src/index.ts` (basic Hono scaffold + error handling)
- `.dev.vars.example` (env template)
- `package.json` (boilerplate deps)
- `src/index.test.ts` (single health check test)

**Used By:** New single-route workers

**Status:** 📋 PENDING — Create after W360-034 Phase 1 (normalized wrangler.jsonc)

---

#### 1.2 — Worker with Database Access
**Template:** `docs/templates/worker-database.wrangler.jsonc`

**Scope:** Hono Worker + Neon Hyperdrive binding + @latimer-woods-tech/neon package

**Files:**
- `wrangler.jsonc` (with Hyperdrive, env-based DB switching)
- `src/db/schema.ts` (Drizzle schema boilerplate)
- `src/routes/` (example CRUD route)
- Sentry + PostHog wiring

**Used By:** admin-studio, schedule-worker (evolution)

**Status:** 🔵 READY — Implement after admin-studio cleanup

---

#### 1.3 — Scheduled Worker (Cron)
**Template:** `docs/templates/worker-scheduled.wrangler.jsonc`

**Scope:** Hono Worker with `triggers.crons` for scheduled tasks

**Files:**
- `wrangler.jsonc` (with cron trigger config)
- `src/index.ts` (cron handler + queue dispatch pattern)
- `src/jobs/` (job type interfaces)
- Error retry logic + dlq (dead-letter queue)

**Used By:** video-cron, schedule-worker (reference)

**Status:** 🔵 READY — Already implemented (video-cron, schedule-worker)

---

### 2. Pages/SSR App Templates

#### 2.1 — React + Vite Single-Page App (SPA)
**Template:** `docs/templates/app-spa-react-vite.package.json`

**Scope:** Client-side React app, typically paired with API worker

**Files:**
- `vite.config.ts` (React + TS config)
- `tsconfig.json` (frontend-specific settings)
- `src/App.tsx` (root component)
- `src/index.css` (design-tokens integration)
- GitHub Actions deploy to Cloudflare Pages

**Used By:** admin-studio-ui, video-studio, future frontend apps

**Status:** 🔵 READY — admin-studio-ui, video-studio already implemented

---

#### 2.2 — Astro Hybrid (Static + SSR)
**Template:** `docs/templates/app-hybrid-astro.astro`

**Scope:** Astro project with static generation + optional SSR (not currently used)

**Files:**
- `astro.config.mjs`
- `src/layouts/`
- `src/pages/`
- Pre-rendering config

**Used By:** Marketing pages, documentation sites

**Status:** 📋 PENDING — Create if future marketing site planned

---

### 3. RFC & Architecture Templates

#### 3.1 — Architecture Decision Record (ADR)
**Template:** `docs/templates/ADR_TEMPLATE.md`

**Scope:** Standardized format for documenting significant technical decisions

**Sections:**
- Context
- Decision
- Consequences
- Alternatives Considered
- Status (proposed/accepted/deprecated)

**Used By:** Any major architectural change

**Status:** 📋 PENDING — Create standardized ADR template

---

#### 3.2 — API Specification (OpenAPI)
**Template:** `docs/templates/api-spec.openapi.yaml`

**Scope:** Standardized OpenAPI 3.1 spec for new APIs

**Sections:**
- Paths (routes)
- Schemas (request/response types)
- Security (JWT auth)
- Error responses (standard error codes)

**Used By:** Any public API route

**Status:** 📋 PENDING — Create OpenAPI template with Factory error standards

---

### 4. Webhook & Event Templates

#### 4.1 — Stripe Webhook Handler
**Template:** `docs/templates/webhook-stripe.ts`

**Scope:** Reusable Stripe webhook handler pattern (per W360-005)

**Files:**
- HMAC signature verification
- Event type routing
- Idempotency tracking
- Error handling + DLQ pattern

**Example Event Types:**
- `customer.subscription.created/updated/deleted`
- `charge.failed`
- `invoice.payment_failed`

**Used By:** admin-studio, future billing workers

**Status:** 🔵 READY — Implemented in packages/neon/src/entitlements/webhook.ts

---

#### 4.2 — Generic Event Handler Pattern
**Template:** `docs/templates/event-handler.ts`

**Scope:** Generic event processor for any event source (Stripe, Twilio, etc.)

**Pattern:**
1. Verify source (HMAC/JWT)
2. Extract payload
3. Check idempotency
4. Route by event type
5. Log outcome
6. Return ack (200) regardless of processing result

**Status:** 📋 PENDING — Generalize from Stripe pattern

---

### 5. Test Templates

#### 5.1 — Unit Test Scaffold (Vitest)
**Template:** `docs/templates/example.test.ts`

**Scope:** Standardized unit test structure for Factory code

**Patterns:**
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('function name', () => {
  let mockDep: any
  beforeEach(() => { mockDep = vi.fn() })
  
  it('should do X when Y', () => {
    const result = functionUnderTest(mockDep)
    expect(result).toBe(expected)
  })
})
```

**Used By:** All packages and apps

**Status:** 🔵 READY — Existing tests follow this pattern

---

#### 5.2 — Integration Test (Hono + Hyperdrive)
**Template:** `docs/templates/integration.test.ts`

**Scope:** Testing Hono routes + database access

**Patterns:**
- Mock Hyperdrive for deterministic testing
- Mock HTTP requests to other services
- Verify response schema + status codes
- Check database state after route execution

**Used By:** Worker apps (admin-studio, schedule-worker)

**Status:** 📋 PENDING — Create after @cloudflare/vitest-pool-workers setup

---

#### 5.3 — E2E Smoke Test (Cypress/Playwright)
**Template:** `docs/templates/smoke.e2e.ts`

**Scope:** End-to-end smoke tests for critical user journeys

**Patterns:**
```ts
describe('Admin Studio Login', () => {
  it('should log in with valid credentials', async () => {
    await page.goto(BASE_URL)
    await page.fill('[name=email]', 'test@factory.dev')
    await page.fill('[name=password]', 'password')
    await page.click('button[type=submit]')
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
```

**Used By:** critical user journeys (prime-self-smoke pattern)

**Status:** 🔵 READY — prime-self-smoke already exists

---

### 6. Manifest & Deployment Templates

#### 6.1 — Wrangler Environment Config Template
**Template:** `docs/templates/wrangler-env-config.jsonc`

**Scope:** Multi-environment configuration scaffold

**Environments:**
- `development` (local, localhost URLs)
- `staging` (staging.* URLs)
- `production` (live URLs)

**Bindings:**
- Database (Hyperdrive)
- Services (Worker-to-Worker calls)
- KV store (if needed)
- R2 bucket (if needed)

**Status:** 🔵 READY — Per W360-034 standards

---

#### 6.2 — GitHub Actions Deploy Workflow
**Template:** `.github/workflows/deploy-worker.yml.template`

**Scope:** Standardized Worker deployment CI/CD

**Stages:**
1. Validate config with `wrangler publish --dry-run`
2. Run tests + build
3. Deploy to staging (on PR/push to main)
4. Smoke test staging
5. Optional manual promotion to production

**Status:** 📋 PENDING — Consolidate from existing workflows

---

### 7. Database & Migration Templates

#### 7.1 — Drizzle Schema Template
**Template:** `docs/templates/schema.drizzle.ts`

**Scope:** Standardized Drizzle ORM schema structure

**Includes:**
- Table definitions with proper types
- Relationships (foreign keys)
- Indexes (performance optimization)
- Soft deletes pattern
- Audit columns (created_at, updated_at)

**Status:** 🔵 READY — See packages/neon/src/entitlements/schema.ts

---

#### 7.2 — Migration Script Template
**Template:** `docs/templates/migration-zero-downtime.sql`

**Scope:** Zero-downtime migration patterns for PostgreSQL

**Patterns:**
- Adding columns with defaults (no-lock)
- Creating indexes CONCURRENTLY
- Constraint validation in two phases (NOT VALID + VALIDATE)
- Avoiding long-running table rewrites

**Status:** 🔵 READY — See docs/runbooks/database.md

---

### 8. CI/CD Infrastructure Templates

#### 8.1 — Package Release Workflow
**Template:** `.github/workflows/publish-package.yml.template`

**Scope:** Automated package versioning, tagging, and npm publish

**Triggers:**
- Git tag matching `@latimer-woods-tech/*/v*` (via bump-and-tag.mjs)
- Automatic npm publish on tag
- Reference: scripts/bump-and-tag.mjs (W360-025)

**Status:** 🔵 READY — See scripts/bump-and-tag.mjs

---

#### 8.2 — Health Check & Smoke Test Workflow
**Template:** `.github/workflows/smoke-test.yml.template`

**Scope:** Scheduled health checks + active monitoring

**Targets:**
- `/health` endpoint for all production workers
- Critical user journeys (prime-self login, video upload, booking)
- Database connectivity
- External service health (Stripe, Sentry, PostHog)

**Cadence:** Every 5 minutes (synthetic-monitor pattern)

**Status:** 🔵 READY — See apps/synthetic-monitor

---

### 9. Support & Ops Templates

#### 9.1 — Operator Runbook Template
**Template:** `docs/templates/runbook-INCIDENT.md`

**Scope:** Standardized response playbook for production incidents

**Sections:**
- Symptoms (what's broken)
- Root causes (most likely culprits)
- Investigation steps
- Mitigation steps (before fix)
- Resolution steps (fix)
- Verification (confirm restored)
- Retrospective (prevent recurrence)

**Runbooks Needed:**
- Failed payment flows (billing)
- Failed renders (video pipeline)
- Failed bookings (marketplace)
- Database connection loss
- High error rate alerts (Sentry)

**Status:** 📋 PENDING — See W360-036 (operator/support runbook pack)

---

#### 9.2 — Data Deletion Compliance Script
**Template:** `scripts/gdpr-delete-user.mjs`

**Scope:** GDPR/compliance-compliant user data deletion

**Pattern:**
1. Find user across all tables
2. Soft-delete or cascade-delete per schema
3. Audit log deletion with timestamp + operator
4. Notify external services (Sentry, PostHog, Stripe)

**Status:** 📋 PENDING — Create before privacy audit

---

### 10. Documentation Templates

#### 10.1 — App README Template
**Template:** `docs/APP_README_TEMPLATE.md`

**Scope:** Standardized README for each Factory app

**Sections:**
- Purpose & scope
- Architecture diagram
- Quick start (local, staging, prod)
- Environment variables
- Deployment procedures
- Troubleshooting
- Support contact

**Status:** 🔵 READY — See docs/APP_README_TEMPLATE.md

---

#### 10.2 — Package Documentation Template
**Template:** `docs/PACKAGE_DOCS_TEMPLATE.md`

**Scope:** Standardized docs for @latimer-woods-tech/* packages

**Sections:**
- API reference
- Usage examples
- Configuration
- Dependency tree
- Testing & coverage
- Changelog/versioning

**Status:** 📋 PENDING — Create standardized package docs template

---

## Template Inventory Summary

| Category | Template | Status | Created | Used By |
|---|---|---|---|---|
| **Worker** | Basic Hono | 📋 PENDING | W360-032 | Future apps |
| **Worker** | Database + Hono | 🔵 READY | admin-studio | admin-studio (ref) |
| **Worker** | Scheduled/Cron | 🔵 READY | video-cron | video-cron (ref) |
| **Pages** | React + Vite | 🔵 READY | admin-studio-ui | admin-studio-ui, video-studio |
| **Pages** | Astro Hybrid | 📋 PENDING | W360-032 | Future SSR apps |
| **RFC** | Architecture Decision | 📋 PENDING | W360-032 | Any major decision |
| **RFC** | OpenAPI Spec | 📋 PENDING | W360-032 | Future APIs |
| **Webhook** | Stripe Handler | 🔵 READY | admin-studio | admin-studio (ref) |
| **Webhook** | Generic Event Handler | 📋 PENDING | W360-032 | Future webhooks |
| **Test** | Unit Test (Vitest) | 🔵 READY | All packages | All packages |
| **Test** | Integration Test | 📋 PENDING | W360-032 | Worker apps |
| **Test** | E2E / Smoke | 🔵 READY | prime-self-smoke | Critical journeys |
| **Deployment** | Wrangler Env Config | 🔵 READY | All workers | All workers |
| **Deployment** | GH Actions Deploy | 📋 PENDING | W360-032 | All apps |
| **Database** | Drizzle Schema | 🔵 READY | neon package | neon package |
| **Database** | Zero-downtime Migration | 🔵 READY | DB migrations | DB migrations |
| **CI/CD** | Package Release | 🔵 READY | bump-and-tag.mjs | @latimer-woods-tech/* packages |
| **CI/CD** | Health Check / Smoke | 🔵 READY | synthetic-monitor | All prod services |
| **Support** | Operator Runbook | 📋 PENDING | W360-036 | Ops team |
| **Support** | GDPR Delete Script | 📋 PENDING | W360-036 | Compliance |
| **Docs** | App README | 🔵 READY | docs/APP_README_TEMPLATE.md | All apps |
| **Docs** | Package Docs | 📋 PENDING | W360-032 | @latimer-woods-tech/* |

---

## Phase 1: Immediate Readiness (Scaffolding)

### Templates Already Ready (No Action Needed)

These templates are already implemented in Factory and ready to reference:

1. ✅ Hono Worker with Database (`admin-studio` is reference)
2. ✅ Scheduled Worker / Cron (`video-cron`, `schedule-worker` are references)
3. ✅ React + Vite SPA (`admin-studio-ui`, `video-studio` are references)
4. ✅ Stripe Webhook Handler (`packages/neon/src/entitlements/webhook.ts`)
5. ✅ Unit Tests / Vitest (`all packages`)
6. ✅ E2E Smoke Tests (`prime-self-smoke`)
7. ✅ Drizzle ORM Schema (`packages/neon/src/entitlements/schema.ts`)
8. ✅ App README Template (`docs/APP_README_TEMPLATE.md`)

### Templates to Create (W360-032 Deliverables)

These need to be created for templates/scaffolding:

1. 📋 **docs/templates/worker-basic.wrangler.jsonc**
   - Minimal Hono worker scaffold
   - Estimated effort: 2 hours

2. 📋 **docs/templates/ADR_TEMPLATE.md**
   - Architecture Decision Record format
   - Estimated effort: 1 hour

3. 📋 **docs/templates/api-spec.openapi.yaml**
   - Factory API standard (JWT auth, error codes)
   - Estimated effort: 3 hours

4. 📋 **docs/templates/schema-audit-template.sql**
   - Zero-downtime migration patterns
   - Estimated effort: 2 hours

5. 📋 **.github/workflows/deploy-worker.yml.template**
   - Consolidated deployment workflow
   - Estimated effort: 2 hours

6. 📋 **docs/templates/runbook-INCIDENT.md**
   - Standardized incident response
   - Estimated effort: 3 hours (first runbook; others follow pattern)

---

## Phase 2: Guidance & Documentation

Create consolidated guidance documents:

1. 📋 **docs/CREATING_NEW_WORKER.md**
   - Step-by-step: clone → scaffold → wire → deploy

2. 📋 **docs/CREATING_NEW_PAGES_APP.md**
   - Step-by-step: Vite + React + design-tokens integration

3. 📋 **docs/templates/USING_TEMPLATES.md**
   - How to use each template, when to use which

---

## Phase 3: Platform Tooling

Optional automation to accelerate app creation:

1. 📋 **scripts/create-worker.mjs**
   - Interactive scaffolding: asks name → generates boilerplate

2. 📋 **scripts/create-pages-app.mjs**
   - Interactive scaffolding for Pages apps

---

## Next Steps

1. ✅ **Audit existing implementations** (done)
   - admin-studio (Worker + DB reference)
   - admin-studio-ui (React+Vite reference)
   - video-cron (Cron reference)

2. 📋 **Create Phase 1 templates** (prioritized by usage frequency):
   - worker-basic.wrangler.jsonc
   - ADR_TEMPLATE.md
   - deploy-worker.yml.template

3. 📋 **Consolidate guidance docs**
   - CREATING_NEW_WORKER.md
   - CREATING_NEW_PAGES_APP.md

4. 📋 **Create support runbooks** (defer to W360-036):
   - runbook-FAILED_BILLING.md
   - runbook-FAILED_RENDER.md
   - runbook-DATABASE_CONNECTION_LOSS.md

---

## Document History

- **2026-04-29:** Initial W360-032 template inventory created
- **Next:** Phase 1 template creation (4-5 hours of work)
