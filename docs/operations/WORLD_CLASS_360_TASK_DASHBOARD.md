# World Class 360 — Active Task Dashboard

**Date:** 2026-04-29  
**Status:** Active execution dashboard for this iteration  
**North star:** build the full World Class 360 tranche, including complete Xico City, Practitioner Video Studio, SelfPrime video/product proof, Admin Studio control plane, and Factory platform hardening.  
**Canonical parent:** `../../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md`  
**Standing orders:** `../../CLAUDE.md`
**Discipline breakdown:** `WORLD_CLASS_360_DISCIPLINE_BREAKDOWN.md`
**Scope gap review:** `WORLD_CLASS_360_SCOPE_GAP_REVIEW.md`

---

## 1. Executive intent

The current iteration is no longer “MVP only.” The north star is **World Class 360**:

> Build a complete, credible tranche of Factory-backed applications that proves the platform can ship real products across AI media, practitioner/personalization, marketplace commerce, operations, release governance, and reusable infrastructure.

This means:

- Xico City is completed as a full app, not only a transaction demo.
- Practitioner Video Studio is the fastest revenue engine and must become self-serve.
- SelfPrime remains the proof surface for video, auth, UX, and practitioner positioning.
- Admin Studio becomes the safe operator/control plane.
- Factory package and workflow systems become release-train ready.
- Stale docs are marked, archived, or merged so agents do not execute outdated plans.

---

## 2. Current state snapshot

| Area | State | Success signal | Main gap |
|---|---|---|---|
| Video pipeline | Verified happy path | R2 + Stream + render workflow succeeded | Revenue entitlement/credit bridge missing |
| SelfPrime | Live public proof | Stream embed, smoke, a11y, auth e2e green | Productized paid video studio not built |
| Xico City | Plan strong, repo unstable | Build plan/orchestrator exists | CI/deps/schema/routes/deploy need repair before full build |
| Admin Studio | Security hardening in progress | Recent auth/smoke hardening commits | Full command-plane safety, RBAC, audit, dry-run, UI tabs incomplete |
| Packages | Published and integration-smoke protected | Package integration workflow passed | Release-train coordination and app lockfile drift not centralized |
| Docs | Rich but sprawling | Dashboard is canonical | Historical docs still compete for attention |
| Workflows | Many powerful automations | Video + package workflows prove value | No central workflow matrix/recovery register yet |

---

## 3. Priority model

| Priority | Meaning | Rule |
|---|---|---|
| P0 | Blocks parallel work or money-moving safety | Fix before starting dependent feature work |
| P1 | Required for World Class 360 ready state | Queue immediately after P0 |
| P2 | Important scale/polish work | Build once core loops prove green |
| P3 | Cleanup or future leverage | Schedule, do not interrupt core path |

---

## 3.1 Discipline model

World Class 360 work is no longer managed as one flat backlog. Every item should be categorized by discipline so specialist agents can own a coherent body of work and reviewers can be assigned by risk.

| Code | Discipline | Primary responsibility |
|---|---|---|
| D01 | Program coordination | Scope, sequencing, OWR/W360 status, dependencies, path ownership |
| D02 | Product and revenue | Offers, pricing, funnels, entitlements, product outcomes |
| D03 | UX, design, and brand | Journeys, accessibility UX, design tokens, brand packs, templates |
| D04 | Frontend and PWA | Pages apps, dashboards, onboarding, client state, PWA shell |
| D05 | Backend/API and Workers | Hono routes, middleware, manifests, health/ready, service boundaries |
| D06 | Data and migrations | Drizzle schema, migrations, RLS, seed/demo data, data lifecycle |
| D07 | Payments and commerce | Stripe, credits, bookings, refunds, payouts, reconciliation |
| D08 | AI, video, and media | Render pipeline, Remotion, LLM prompts, R2/Stream, validation |
| D09 | Platform, DevOps, and config | Workflows, Wrangler, secrets, env examples, deploy gates, Renovate |
| D10 | Observability and reliability | Sentry, PostHog, events, synthetic monitor, SLOs, rollback proof |
| D11 | Security, privacy, and compliance | RBAC, JWT policy, service tokens, GDPR, DMCA, audit requirements |
| D12 | QA and test engineering | Unit/integration/e2e/smoke/a11y/contract tests and quality gates |
| D13 | Documentation and enablement | Canonical docs, templates, runbooks, status index, archival policy |
| D14 | Growth, launch, and support ops | SEO, demo narrative, support scripts, refunds workflow, onboarding docs |

Detailed ownership and app/repo mapping lives in `docs/operations/WORLD_CLASS_360_DISCIPLINE_BREAKDOWN.md`.

---

## 4. Master queue

### P0 — Coordination, repo stability, and safety

| ID | Workstream | Owner team | Scope / paths | Dependencies | Exit criteria |
|---|---|---|---|---|---|
| W360-001 | Resolve agent collision risk | Coordinator | Factory working tree, path ownership table | None | All active paths assigned; unrelated uncommitted changes are committed, stashed, or explicitly preserved |
| W360-002 | Create workflow coordination matrix | DevOps | `.github/workflows/`, `docs/runbooks/`, `docs/operations/` | W360-001 | **Created:** `docs/operations/WORKFLOW_COORDINATION_MATRIX.md`; next add shared deploy-gate implementation and run evidence |
| W360-003 | Xico City repo stabilization | Xico platform team | `C:/Users/Ultimate Warrior/Documents/GitHub/xico-city` | none | `npm ci`, typecheck, lint, test, build, registry validation, forbidden API check all pass locally and in Actions |
| W360-004 | Xico City Worker health deploy | Xico platform team | Xico `wrangler.jsonc`, deploy workflow, service registry | W360-003 | `/health` and `/ready` return correct status via direct HTTP; service registry updated if public URL exists |
| W360-005 | Practitioner Studio entitlement bridge | Revenue API team | product API, entitlement tables, Stripe webhook, credit ledger | video pipeline baseline | ⚡ IN PROGRESS — Drizzle schema (5 tables: plans, customers, subscriptions, entitlements, credit_ledger) in `packages/neon/src/entitlements/schema.ts` + HMAC-SHA256 signed webhook handler (`packages/neon/src/entitlements/webhook.ts`: handleSubscriptionCreated/Updated/Deleted, refreshEntitlements, credit grant/refund) + `apps/admin-studio/src/routes/webhooks-studio-subscriptions.ts` (POST /webhooks/studio-subscriptions, signature verify, 400/401/200 handling, idempotent); live Stripe test-card integration with test event still needed |
| W360-006 | Admin Studio production safety gate | Admin Studio team | `apps/admin-studio`, `apps/admin-studio-ui`, `packages/studio-core` | W360-001 | RBAC, audit logging, protected smoke runner, dry-run previews, negative auth tests pass |

### P1 — Product loops

| ID | Workstream | Owner team | Scope / paths | Dependencies | Exit criteria |
|---|---|---|---|---|---|
| W360-007 | Practitioner Studio self-serve render | Revenue + video teams | video request endpoint, onboarding, dashboard projection | W360-005 | Paid user creates video, sees status, receives playable Stream UID, credit policy applied |
| W360-008 | Practitioner Studio dashboard MVP | UI + revenue teams | user dashboard, billing, credits, videos | W360-007 | User can manage plan, credits, generated videos, embed/share links without support |
| W360-009 | Practitioner Studio operator recovery | Admin Studio + video teams | failed jobs, replay, credit reversal, audit | W360-007 | Platform failure refunds/replays with deterministic audit trail |
| W360-010 | Xico identity and profiles | Xico auth team | Xico auth/profile routes/tests | W360-004 | register → login → refresh → logout → `/v1/me` smoke passes |
| W360-011 | Xico host onboarding | Xico marketplace team | host profile, Stripe Connect, KYC state | W360-010 | host completes Stripe Connect test onboarding and status updates idempotently |
| W360-012 | Xico catalog and moderation | Xico marketplace + ops teams | experiences, versions, media, schedules, admin review | W360-011 | host creates listing; admin approves; public listing appears |
| W360-013 | Xico discovery and map | Xico product team | search, category filters, neighborhood pages, MapLibre | W360-012 | public search/map returns relevant results; p95 target defined and tested with seed data |
| W360-014 | Xico booking checkout | Xico commerce team | bookings, checkout sessions, Stripe webhook, email | W360-013 | visitor books with Stripe test card; duplicate webhook does not double-confirm |
| W360-015 | Xico reviews and trust | Xico trust team | reviews, reports, moderation actions, strikes | W360-014 | only attended bookings can review; reports enter moderation queue |
| W360-016 | Xico subscriptions | Xico commerce team | Explorer/Local tiers, Billing portal, member gates | W360-014 | paid tier unlocks member benefits and blocks free users where expected |
| W360-017 | Xico payouts | Xico commerce + ops teams | Connect transfers, payout reports, DLQ/retry | W360-014, W360-011 | completed booking generates host payout record and test transfer path |
| W360-018 | Xico curator tooling | Xico product team | collections, share links, public collection pages | W360-013 | curator publishes 5-experience collection |
| W360-019 | Xico compliance suite | Xico compliance team | GDPR export/delete, DMCA, consent logs | W360-010, W360-012 | export/delete/takedown flows pass tests and audit events exist |
| W360-020 | Xico PWA polish | Xico UI team | Pages/PWA app, offline shell, install manifest, a11y | W360-013 | Lighthouse PWA/a11y ≥ 95; mobile smoke passes |

### P1 — Platform/product observability

| ID | Workstream | Owner team | Scope / paths | Dependencies | Exit criteria |
|---|---|---|---|---|---|
| W360-021 | Analytics event verification gate | Observability team | analytics tests, PostHog/factory_events schemas | W360-005, W360-014 | ✅ DONE 2026-04-29 — `packages/analytics/src/event-schemas.ts` defines `CRITICAL_EVENT_SCHEMAS` for 22 events (render/sub/revenue/auth/booking/webhook); `assertEventShape()` throws on missing fields or wrong types; 50+ tests in `event-schemas.test.ts`; exported from index.ts for consumer tests |
| W360-022 | User-journey SLOs | Observability team | docs/runbooks/slo, synthetic monitor | W360-007, W360-014 | ⚡ IN PROGRESS 2026-04-29 — `docs/operations/USER_JOURNEY_SLOS.md` defines 9 journeys (J01–J09) with SLO targets (99.9–99.5%), burn-rate thresholds, and p50/p95/error-rate budgets. Active proxies in `apps/synthetic-monitor`: 3 manifest probes (schedule-worker, video-cron, admin-studio) + 4 journey proxies (render-ingest, video-dispatch, auth-api, operator-plane). Journey-specific probes (checkout, first-render, booking, webhook, dashboard — J05-J09) pending W360-005/007/008/014 route readiness |
| W360-023 | Cost guardrails | Revenue + observability | credit quotas, render estimates, budget alerts | W360-005 | ✅ DONE 2026-04-29 — `packages/neon/src/entitlements/guardrails.ts`: `checkRenderGuardrails()` (5-stage: kill switch → entitlement → duration → quota → credits), `estimateRenderCost()` (ceil to 0.01), `isKillSwitchActive()` (global config + customer suspension), `emitBudgetAlert()` (fire-and-forget, 20% threshold); constants: DEFAULT_CREDIT_RATE_PER_SECOND=0.1, PLATFORM_MAX_VIDEO_SECONDS=1800; 35 tests passing |
| W360-024 | Function manifest adoption | Platform + Admin Studio | `packages/studio-core`, Workers | W360-006 | ✅ DONE 2026-04-29 — `GET /manifest` added to admin-studio (typed, studio-core), schedule-worker (inline, 6ε2f17a), and video-cron (inline, 04b106d); all three return `{ manifestVersion:1, app, env, entries[] }` with auth/reversibility/SLO/smoke per route |
| W360-025 | Cross-repo release train | DevOps + package team | package publish, app lockfile updates, Studio view | W360-002 | package bump → app lockfiles → staging deploy → smoke → production path is documented and automatable |

### P2 — Growth, launch, and tranche packaging

| ID | Workstream | Owner team | Scope / paths | Dependencies | Exit criteria |
|---|---|---|---|---|---|
| W360-026 | Practitioner Studio legal/trust package | Legal/compliance | ToS, privacy, AI disclosure, refund, AUP | W360-005 | legal pages linked from checkout and footer |
| W360-027 | Practitioner Studio launch system | Launch team | landing, pricing, demos, SEO, emails, affiliate/referral | W360-008, W360-026 | stranger can understand, pay, onboard, render, and share without support |
| W360-028 | Xico City launch package | Launch + Xico teams | landing, seed listings, demo data, SEO, host docs | W360-020 | public launch demo supports full traveler/host/admin narrative |
| W360-029 | Tranche investor/operator narrative | Coordinator + docs | portfolio deck/docs, architecture map, service map | W360-027, W360-028 | tranche story explains each app’s proof point, revenue path, and shared Factory leverage |
| W360-030 | Archive/mark stale docs | Docs coordinator | root docs, docs/archive, canonical index | W360-001 | **Index created:** `docs/DOCUMENT_STATUS_INDEX.md`; next add historical banners or archive folders after coordinator review |

### P0/P1 — Full-scope, templates, standards, and config refinement

| ID | Workstream | Lead disciplines | Scope / paths | Dependencies | Exit criteria |
|---|---|---|---|---|---|
| W360-031 | Full portfolio app scope registry | D01, D09, D13 | Factory apps, external app repos, service registry, Admin Studio registry | W360-001 | Every Factory app/repo is listed with status, owner, gates, W360 disposition, and next verification |
| W360-032 | Template buildout pack | D13 + discipline leads | `docs/templates/`, `packages/deploy/templates/`, `packages/testing`, `packages/studio-core` | W360-031 | Worker, Pages/PWA, RFC, manifest, webhook, credit ledger, booking/payout, event, smoke/a11y, synthetic monitor, support, launch, seed-data, and historical-banner templates exist or are explicitly deferred |
| W360-033 | Standards catalog and enforcement | D13, D09, D12 | frontend/design/API/runtime/auth/money/AI/analytics/observability/config/docs/release standards | W360-032 | Each standard has owner, required gate, check mechanism, and reference path |
| W360-034 | Config normalization pass | D09, D12, D10 | `wrangler.jsonc`, GitHub Actions, `package.json`, lockfiles, TS/ESLint/Vitest, Renovate, Sentry/PostHog, service registry | W360-031 | Audit completed; gaps filed; normalized configs applied first to W360-critical repos |
| W360-035 | App repo graduation gates | D09, D12, D13 | `wordis-bond`, `cypher-healing`, `ijustus`, `the-calling`, `neighbor-aid`, `prime-self`, `xico-city` | W360-034 | No app is called ready until clean checkout, env verification, CI, deploy, smoke, docs, and owner gates pass |
| W360-036 | Operator/support runbook pack | D14, D07, D11, D13 | refund, failed render, failed booking, login, data deletion, moderation, rollback | W360-032 | Support scripts exist for every public money/auth/compliance failure mode |
| W360-037 | Design and brand asset system | D03, D04, D08, D14 | logos, tokens, brand packs, video templates, app-specific design boundaries | W360-031 | Brand/design assets are inventoried, reusable where appropriate, and tied to app launch templates |
| W360-038 | Discipline routing and review gates | D01 + all leads | W360 dashboard, discipline breakdown, PR/review policy | W360-031 | Every W360 item has lead discipline, reviewer discipline, risk tier, and evidence requirements |

### P1 — UI/UX excellence system

| ID | Workstream | Lead disciplines | Scope / paths | Dependencies | Exit criteria |
|---|---|---|---|---|---|
| W360-039 | Create shared design tokens package | D03, D04, D09, D12, D13 | `packages/design-tokens`, frontend standards, usage docs | W360-033, W360-037 | Semantic color, type, spacing, motion, focus, density, and breakpoint tokens exist with tests and usage guidance |
| W360-040 | Create shared UI primitives package | D03, D04, D09, D12, D13 | `packages/ui`, component docs, test harness | W360-039 | Button, Input, Label, Alert, Dialog, Toast, Card, EmptyState, LoadingState, Tabs, FormField exist with a11y defaults and tests |
| W360-041 | Baseline critical journeys and scorecards | D02, D03, D04, D10, D12, D14 | SelfPrime, Admin Studio, Xico route inventory and journey specs | W360-038 | Every critical route has a journey owner, KPI target, current baseline, failure states, and proof checklist |
| W360-042 | Add UI regression gates | D04, D09, D10, D12 | Playwright, axe, Lighthouse, screenshot diff, mobile matrix | W360-039, W360-040, W360-041 | CI blocks regressions on selected routes for accessibility, performance, and visual drift |
| W360-043 | Harden SelfPrime to premium launch quality | D03, D04, D10, D12, D14 | `adrper79-dot/prime-self-ui`, `adrper79-dot/prime-self`, smoke/a11y/auth/live UX | W360-041, W360-042 | Public, auth, dashboard, pricing, and practitioner journeys meet world-class scorecard with live evidence |
| W360-044 | Harden Admin Studio control-plane UX | D03, D04, D05, D11, D12 | `apps/admin-studio-ui`, `apps/admin-studio`, `packages/studio-core` | W360-006, W360-041, W360-042 | Operator flows are role-safe, readable under pressure, auditable, keyboard-accessible, and mobile-tolerant where required |
| W360-045 | Create launch-review UX governance | D01, D03, D12, D13, D14 | DoR/DoD, RFC, review templates, launch checklist | W360-041, W360-042 | No UI surface ships without journey spec, scorecard, a11y proof, performance proof, and event proof |

---

## 4.1 Portfolio app/repo coverage

| Surface | W360 disposition | Lead disciplines | Required next proof |
|---|---|---|---|
| `apps/admin-studio` | Active W360 core surface | D05, D09, D10, D11, D12 | RBAC/audit/dry-run/smoke tests and production health verification |
| `apps/admin-studio-ui` | Active W360 core surface | D03, D04, D11, D12 | Protected UI flows, environment safety, a11y, audit viewer proof |
| `apps/prime-self-reference` | Reference/template candidate | D03, D04, D13 | Decision: reference-only or reusable UI/template source |
| `apps/prime-self-smoke` | Active quality gate | D12, D10, D13 | Reusable smoke/a11y pattern documented for other apps |
| `apps/schedule-worker` | Active video infrastructure | D05, D08, D10, D09 | Failure replay, credit/refund hooks, manifest, SLO proof |
| `apps/synthetic-monitor` | Active reliability infrastructure | D10, D09 | W360 journey targets added as routes become available |
| `apps/video-cron` | Active video infrastructure | D08, D09, D10 | Retry/recovery evidence and dispatch metrics |
| `apps/video-studio` | Active media template surface | D08, D03, D14 | Practitioner and Xico video templates and brand packs |
| `apps/videoking` / `_external_reviews/videoking` | Reference only | D02, D07, D08, D13 | Reference-only status preserved; reusable patterns extracted |
| `adrper79-dot/prime-self` | Live app/API | D05, D10, D11 | Live health/auth/practitioner verification remains green |
| `adrper79-dot/prime-self-ui` | Live launch/proof UI | D03, D04, D12, D14 | Live smoke/a11y/auth and Studio launch entry if used |
| `xico-city` | Full W360 build | D01-D14 | S-00 through S-11 proof gates |
| `wordis-bond` | Scaffolded repo; feature-deferred | D09, D12, D13 | Graduation gate: clean checkout, env, CI, docs, owner |
| `cypher-healing` | Scaffolded repo; feature-deferred | D09, D12, D13 | Graduation gate: clean checkout, env, CI, docs, owner |
| `ijustus` | Scaffolded repo; feature-deferred | D09, D12, D13 | Graduation gate: clean checkout, env, CI, docs, owner |
| `the-calling` | Scaffolded repo; feature-deferred | D09, D12, D13 | Graduation gate: clean checkout, env, CI, docs, owner |
| `neighbor-aid` | Scaffolded repo; feature-deferred | D09, D12, D13 | Graduation gate: clean checkout, env, CI, docs, owner |

---

## 5. Xico City full-build slice plan

World Class 360 means building all Xico City slices. The execution order remains strict because later marketplace features depend on stable identity, schema, and money-moving flows.

| Slice | Name | World Class 360 completion target | Depends on |
|---|---|---|---|
| X0 | Repo stabilization | CI green, lockfile, scripts, exact pins, no forbidden runtime patterns | none |
| S-00 | Foundations | health/ready/Sentry/schema/CI/deploy/curl gate actually pass | X0 |
| S-01 | Identity & profiles | secure auth, refresh rotation, profile, avatar | S-00 |
| S-02 | Host onboarding | Stripe Connect Express, KYC state, host dashboard skeleton | S-01 |
| S-03 | Experience catalog | create/version/schedule/media/admin moderation | S-02 |
| S-04 | Discovery | search, filters, map, neighborhood/category pages | S-03 |
| S-05 | Bookings | checkout, idempotent webhook, cancellations/refunds | S-04 |
| S-06 | Reviews & trust | verified reviews, helpful votes, host responses, reports | S-05 |
| S-07 | Subscriptions | Explorer/Local tiers, member prices, billing portal | S-05 |
| S-08 | Payouts | Connect transfers, payout reports, exception handling | S-05/S-02 |
| S-09 | Curator tooling | collections, share links, public curated journeys | S-04 |
| S-10 | Compliance | DMCA, GDPR, consent logs, moderator console | S-01/S-03 |
| S-11 | PWA polish | offline shell, installable app, push, a11y/performance | S-04+ |

---

## 6. Practitioner Video Studio slice plan

| Slice | Name | Completion target | Depends on |
|---|---|---|---|
| PVS-00 | Revenue foundation | plan catalog, checkout, signed webhook, entitlement, credits | video baseline |
| PVS-01 | Self-serve onboarding | wizard captures niche, brand, offer, audience, forbidden claims | PVS-00 |
| PVS-02 | First render loop | paid user schedules render and receives playable output | PVS-01 |
| PVS-03 | User dashboard | videos, credits, plan, billing portal, embed/share | PVS-02 |
| PVS-04 | Operator recovery | failed jobs, replay, credit reversal, audit | PVS-02 |
| PVS-05 | Legal/trust | AI disclosure, refund, AUP, privacy, ToS | PVS-00 |
| PVS-06 | Launch engine | demo gallery, SEO, emails, affiliate/referral | PVS-03/PVS-05 |

---

## 7. Admin Studio slice plan

| Slice | Name | Completion target | Depends on |
|---|---|---|---|
| AS-00 | Working-tree cleanup | active Admin Studio/studio-core changes accounted for | W360-001 |
| AS-01 | Auth/RBAC | all sensitive APIs protected by roles | AS-00 |
| AS-02 | Audit middleware | every mutation writes factory_events/audit row | AS-01 |
| AS-03 | Dry-run command model | command schema, risk tier, diff preview, rollback plan | AS-02 |
| AS-04 | Smoke/test runner hardening | protected live/staging smoke runner and evidence capture | AS-02 |
| AS-05 | Deploy control | staging/prod deploys with health gates and rollback | W360-002, AS-03 |
| AS-06 | Function explorer | manifests ingested and displayed with reversibility/SLO | W360-024 |
| AS-07 | Release train UI | package/app/workflow version drift and deploy state | W360-025 |

---

## 8. Documentation hygiene queue

### Keep canonical

- `CLAUDE.md`
- `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md`
- `MASTER_INDEX.md`
- `PROJECT_STATUS.md`
- `docs/service-registry.yml`
- `docs/operations/WORLD_CLASS_360_TASK_DASHBOARD.md`
- `docs/revenue/PRACTITIONER_VIDEO_STUDIO_READY_STATE_PLAN.md`
- `docs/revenue/XICO_CITY_TRANCHE_REVIEW.md`
- `docs/operations/WORLD_CLASS_360_SCOPE_GAP_REVIEW.md`
- `docs/operations/WORLD_CLASS_360_DISCIPLINE_BREAKDOWN.md`
- `prompts/README.md`
- `prompts/AGENT_SUCCESS_CONTRACT.md`

### Mark historical or archive

| Pattern/file group | Action | Reason |
|---|---|---|
| root `*_SUMMARY.md`, `*_COMPLETE.md` | archive to `docs/archive/session-summaries/` or add historical banner | session artifacts compete with dashboard |
| `STAGE_0_*`, `STAGE_1_*`, `STAGES_2_5*`, `STAGE_5_COMPLETE.md` | archive/mark historical | superseded by World Class 360 dashboard |
| clean pass reports | archive to `docs/archive/clean-passes/` | useful evidence, not live plan |
| old Phase C/D kickoff/completion docs | mark historical unless actively used | prevent stale phase confusion |
| VideoKing phase refresh docs | keep baseline docs; archive one-off refresh summary if duplicated | VideoKing remains pattern source |

### Create

- `docs/DOCUMENT_STATUS_INDEX.md` — **created**; every major doc gets status: canonical, active reference, historical, archive candidate.
- `docs/operations/WORKFLOW_COORDINATION_MATRIX.md` — **created**; critical workflows, deploy gates, and immediate coordination backlog are listed.
- `docs/archive/README.md` — still needed after coordinator approves archive moves.

---

## 9. Escaped items to add in this pass

1. **Workflow registry** — workflows need metadata and recovery instructions.
2. **Event verification gate** — revenue and booking events must be tested like code.
3. **Cost guardrail gate** — no render or marketplace flow launches without cost controls.
4. **Customer support runbook** — refund, failed render, failed booking, login issue, data deletion.
5. **Seed/demo data strategy** — Xico needs believable listings and demo users for launch and testing.
6. **Terms/refund/compliance lockstep** — legal pages must ship before checkout goes public.
7. **Synthetic monitor expansion** — add Xico, checkout, dashboard, webhook canaries once routes exist.
8. **Package version drift monitor** — app repos must not silently lag Factory package versions.
9. **Secrets inventory refresh** — confirm all app repos have required secrets and no stale names.
10. **Rollback rehearsal** — run one non-destructive rollback drill per deployed Worker before public launch.
11. **Discipline routing** — every work item needs a lead discipline, reviewer discipline, risk tier, and evidence requirement.
12. **Template pack** — build reusable templates before repeating app/revenue/support work manually.
13. **Standards catalog** — standards must be enforceable checks, not scattered prose.
14. **Config normalization** — all W360-critical repos need aligned Wrangler, CI, package, lint, test, telemetry, and secret conventions.

---

## 10. Immediate execution order

1. Commit or consciously isolate current Factory doc/dashboard changes.
2. Resolve active working-tree collision risk.
3. Create workflow coordination matrix. **Done as document; shared deploy-gate implementation remains open.**
4. Assign discipline owners/reviewers for W360-001 through W360-038.
5. Complete portfolio app scope registry and config/template/standards gap tickets.
6. Stabilize Xico City repo and CI.
7. Implement Practitioner Studio entitlement/credit bridge.
8. Implement Xico S-00 true foundations and deploy/curl verify.
9. Run Admin Studio safety hardening.
10. Begin parallel product loops:
   - Xico S-01/S-02/S-03,
   - Practitioner Studio PVS-01/PVS-02,
   - Admin Studio AS-02/AS-03,
   - Observability W360-021/W360-022.

---

## 11. Completion definition for World Class 360 iteration

This iteration is complete when:

- Practitioner Video Studio has a paid self-serve render loop.
- Xico City completes all S-00 through S-11 slices with live or staged proof.
- SelfPrime remains healthy and tied to the video proof surface.
- Admin Studio can safely observe and operate core workflows with RBAC/audit/dry-run.
- Factory packages have release-train discipline and cross-package CI.
- Workflows have a coordination matrix and recovery runbooks.
- Full app/repo scope is explicitly tracked by discipline.
- Templates, standards, and configs are normalized enough that future apps do not reinvent launch-critical work.
- Stale docs are archived or marked historical.
- The dashboard has evidence-backed status for every active workstream.
