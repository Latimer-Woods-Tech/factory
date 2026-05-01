# World Class 360 — Discipline Breakdown

**Date:** April 29, 2026  
**Status:** Active categorization layer for the World Class 360 task dashboard  
**Parent dashboard:** `docs/operations/WORLD_CLASS_360_TASK_DASHBOARD.md`

---

## 1. Why this exists

World Class 360 is too broad to manage as one flat task list. Work should be routed by discipline so each agent/team can own a clear category, avoid collisions, and close tasks with the right evidence.

This document turns the W360 queue into a discipline-based operating model.

---

## 2. Discipline taxonomy

| Code | Discipline | Owns | Does not own |
|---|---|---|---|
| D01 | Program coordination | Scope, sequencing, OWR/W360 status, path ownership, dependency management | Implementing product code directly unless assigned |
| D02 | Product and revenue | Offers, pricing, funnels, entitlement rules, launch packaging, user outcomes | Low-level infra, DB migrations without engineering owner |
| D03 | UX, design, and brand | Journey quality, design tokens, components, accessibility UX, brand packs, templates | Backend route behavior |
| D04 | Frontend and PWA | Pages apps, dashboards, onboarding, client state, PWA/offline shell, web vitals | Worker internals except API contract feedback |
| D05 | Backend/API and Workers | Hono routes, middleware, service boundaries, health/ready, manifests, auth integration | UI implementation |
| D06 | Data and migrations | Drizzle schema, migrations, RLS, seed/demo data, query safety, data lifecycle | Product copy or launch pages |
| D07 | Payments and commerce | Stripe Checkout/Billing/Connect, webhooks, credits, bookings, refunds, payouts, reconciliation | General UI polish outside money flows |
| D08 | AI, video, and media | Render pipeline, Remotion templates, LLM prompts, ElevenLabs, R2/Stream, output validation | Stripe finance ledgers except credit hooks |
| D09 | Platform, DevOps, and config | GitHub Actions, Wrangler, secrets, env examples, deploy gates, lockfiles, Renovate, release train | Product prioritization |
| D10 | Observability and reliability | Sentry, PostHog, factory_events, synthetic monitor, SLOs, incident drills, rollback proof | Feature design decisions |
| D11 | Security, privacy, and compliance | RBAC, JWT policy, service tokens, GDPR, DMCA, consent, AUP, audit requirements | Visual design unless trust/legal UX |
| D12 | QA and test engineering | Unit/integration/e2e/smoke/a11y/contract tests, coverage, test fixtures, quality gates | Production deploy ownership |
| D13 | Documentation and enablement | Canonical docs, templates, runbooks, status index, historical/archive labeling | Runtime implementation |
| D14 | Growth, launch, and support ops | SEO, demo data narrative, support scripts, refunds workflow, onboarding docs, affiliate/referral | Core platform packages |

---

## 3. W360 queue by discipline

| Discipline | Primary W360 items | Supporting W360 items |
|---|---|---|
| D01 Program coordination | W360-001, W360-029, W360-031 | W360-030, W360-038 |
| D02 Product and revenue | W360-005, W360-007, W360-008, W360-027, W360-028 | W360-023, W360-026, W360-036 |
| D03 UX, design, and brand | W360-020, W360-037 | W360-008, W360-013, W360-027, W360-028 |
| D04 Frontend and PWA | W360-008, W360-013, W360-018, W360-020 | W360-027, W360-028 |
| D05 Backend/API and Workers | W360-004, W360-010, W360-011, W360-012, W360-014, W360-024 | W360-006, W360-007 |
| D06 Data and migrations | W360-003, W360-010, W360-012, W360-014, W360-019 | W360-031, W360-034 |
| D07 Payments and commerce | W360-005, W360-014, W360-016, W360-017 | W360-009, W360-023, W360-036 |
| D08 AI, video, and media | W360-007, W360-009, W360-023, W360-037 | W360-005, W360-027, W360-028 |
| D09 Platform, DevOps, and config | W360-002, W360-003, W360-004, W360-025, W360-034, W360-035 | W360-021, W360-022 |
| D10 Observability and reliability | W360-021, W360-022, W360-023 | W360-002, W360-009, W360-036 |
| D11 Security, privacy, and compliance | W360-006, W360-019, W360-026 | W360-010, W360-011, W360-036 |
| D12 QA and test engineering | W360-003, W360-021, W360-022, W360-035 | All launch-critical feature items |
| D13 Documentation and enablement | W360-030, W360-032, W360-033 | W360-029, W360-036 |
| D14 Growth, launch, and support ops | W360-027, W360-028, W360-036 | W360-029, W360-037 |

---

## 4. App and repo coverage by discipline

| Surface | Lead disciplines | Required proof |
|---|---|---|
| `apps/admin-studio` | D05, D09, D10, D11, D12 | RBAC tests, audit events, dry-run evidence, health verification |
| `apps/admin-studio-ui` | D03, D04, D11, D12 | Protected UI flows, accessibility, environment safety, audit viewer proof |
| `apps/prime-self-reference` | D03, D04, D13 | Decision record: reference-only vs reusable template source |
| `apps/prime-self-smoke` | D12, D10, D13 | Reusable smoke/a11y template extracted or documented |
| `apps/schedule-worker` | D05, D08, D10, D09 | Replay/failure tests, app tenancy evidence, manifest, health proof |
| `apps/synthetic-monitor` | D10, D09 | Expanded target schema and W360 journey probes |
| `apps/video-cron` | D08, D09, D10 | Retry/recovery evidence, dispatch metrics, health proof |
| `apps/video-studio` | D08, D03, D14 | Practitioner/Xico media templates, brand packs, validation gates |
| `apps/videoking` / `_external_reviews/videoking` | D02, D07, D08, D13 | Reference-only status preserved; patterns extracted where reusable |
| `Latimer-Woods-Tech/prime-self` | D05, D10, D11 | Live health/auth/practitioner route verification |
| `Latimer-Woods-Tech/prime-self-ui` | D03, D04, D12, D14 | Live smoke/a11y/auth, pricing/legal/studio entry if used for launch |
| `xico-city` | D01-D14 as needed | S-00 through S-11 proof gates and launch package |
| `wordis-bond` | D09, D12, D13 | Scaffold/CI/env/docs readiness, defer product scope unless approved |
| `cypher-healing` | D09, D12, D13 | Scaffold/CI/env/docs readiness, defer product scope unless approved |
| `ijustus` | D09, D12, D13 | Scaffold/CI/env/docs readiness, defer product scope unless approved |
| `the-calling` | D09, D12, D13 | Scaffold/CI/env/docs readiness, defer product scope unless approved |
| `neighbor-aid` | D09, D12, D13 | Scaffold/CI/env/docs readiness, defer product scope unless approved |

---

## 5. Template and standards ownership

| Asset to build | Discipline owner | Secondary owner | Target home |
|---|---|---|---|
| Worker scaffold template | D09 | D05, D12 | `packages/deploy/templates/` |
| Pages/PWA scaffold template | D04 | D03, D09, D12 | `packages/deploy/templates/` or `docs/templates/` |
| Feature-slice RFC template | D13 | D01, D02 | `docs/templates/` |
| Function manifest template | D05 | D09, D10, D11 | `packages/studio-core` and `docs/templates/` |
| Stripe checkout/webhook template | D07 | D12, D11 | `docs/templates/` and `packages/testing` |
| Credit ledger template | D07 | D06, D10 | `docs/templates/` |
| Booking/payout template | D07 | D06, D12 | `docs/templates/` |
| Analytics event contract template | D10 | D12, D02 | `docs/templates/` and `packages/analytics` |
| Smoke/a11y template | D12 | D04, D10 | `packages/testing` and `docs/templates/` |
| Synthetic monitor template | D10 | D09 | `apps/synthetic-monitor` and `docs/templates/` |
| Support/refund runbook template | D14 | D07, D11, D13 | `docs/templates/` |
| Launch package template | D14 | D02, D03, D13 | `docs/templates/` |
| Seed/demo data template | D06 | D14, D12 | `docs/templates/` |
| Historical banner template | D13 | D01 | `docs/templates/` |
| Standards catalog | D13 | all discipline leads | `docs/operations/` |
| Config normalization checklist | D09 | D12, D10 | `docs/operations/` |

---

## 6. Completion evidence by discipline

| Discipline | Done means |
|---|---|
| D01 | Dashboard/OWR updated, dependencies clear, path ownership assigned, no hidden blockers |
| D02 | User outcome, offer, pricing, funnel, and entitlement behavior documented and tested |
| D03 | Journey and brand quality pass accessibility and design review gates |
| D04 | UI works on target devices, has error/empty/loading states, and passes smoke/a11y/performance gates |
| D05 | Routes are typed, authenticated where needed, observable, tested, and Worker-compatible |
| D06 | Migrations apply cleanly, data lifecycle is explicit, seed/demo data is deterministic |
| D07 | Webhooks are signed/idempotent, ledgers are append-only, replay/refund/reconciliation pass |
| D08 | Render/output path is validated, cost-bounded, recoverable, and safe for public use |
| D09 | Clean checkout works, workflows pass, deploy gates verify endpoints, configs are normalized |
| D10 | Events/logs/errors/SLOs/synthetic probes prove the journey and recovery path |
| D11 | RBAC/privacy/compliance/legal gates pass with audit evidence |
| D12 | Tests fail on regressions and cover unit/integration/e2e/smoke/a11y/contract paths as applicable |
| D13 | Docs are canonical, indexed, linked, and stale docs cannot mislead agents |
| D14 | Launch/support package makes the product understandable, sellable, supportable, and reversible |

---

## 7. Recommended execution routing

1. Route every W360 item to one lead discipline and at least one reviewer discipline.
2. Do not open implementation on a W360 item until its lead discipline has an exit proof plan.
3. For money-moving, auth, compliance, deploy, and AI/video work, require D12 QA and D10 observability review.
4. For public UI work, require D03 design and D12 a11y/smoke review.
5. For external app repos, require D09 config and D13 docs readiness before feature work.
