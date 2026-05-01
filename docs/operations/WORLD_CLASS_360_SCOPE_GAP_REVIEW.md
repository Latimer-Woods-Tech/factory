# World Class 360 — Scope Gap and Process Review

**Date:** April 29, 2026  
**Status:** Active reference for `WORLD_CLASS_360_TASK_DASHBOARD.md`  
**Purpose:** answer whether the current plan is complete, whether it covers the full Factory app scope, and what templates, standards, and configs must be added to reach a world-class process.

---

## 1. Executive answer

The plan is strong and now directionally correct, but it needed improvement in four areas:

1. **Full app-scope coverage:** the dashboard emphasized Xico, Practitioner Video Studio, SelfPrime, Admin Studio, and video infrastructure, but did not explicitly queue every Factory app/repo surface.
2. **Templates:** the repo has useful templates, but not enough launch, app-scaffold, test, legal, event, smoke, support, seed-data, and manifest templates for repeatable World Class 360 delivery.
3. **Standards:** many standards exist in scattered docs; they need one enforceable standards catalog with required gates and owners.
4. **Config refinement:** app repos and Factory apps need normalized `wrangler`, workflow, secrets, `.dev.vars.example`, `tsconfig`, ESLint, Vitest, Renovate, service-registry, Sentry, PostHog, and deploy-gate conventions.

Process maturity verdict: **not fully world-class yet, but close enough to become world-class if the new W360 governance work is executed before broad feature expansion.**

---

## 2. Full Factory app/repo scope

### A. Factory-local apps and Workers

| Surface | Current role | World Class 360 required work |
|---|---|---|
| `apps/admin-studio` | Factory control-plane Worker API | RBAC, audit, dry-run command model, smoke auth, function manifests, deploy controls, production health verification |
| `apps/admin-studio-ui` | Browser UI for control plane | Environment switcher, Functions tab, Code/AI tabs, release train UI, audit viewer, command approval UX |
| `apps/prime-self-reference` | Reference UI/components for Prime Self | Decide if it remains reference-only or becomes reusable template source; align with design-system tokens |
| `apps/prime-self-smoke` | Live SelfPrime smoke/a11y tests | Expand pattern into reusable smoke template for Xico and Practitioner Studio |
| `apps/schedule-worker` | Shared video job API | Failure replay, app tenancy evidence, credit/refund integration, manifests, SLOs |
| `apps/synthetic-monitor` | Synthetic health checks | Add Xico, checkout, dashboard, render, webhook, and Admin Studio probes as routes exist |
| `apps/video-cron` | Video dispatch cron Worker | Recovery evidence, retry policy, job drift metrics, manifest, service registry freshness |
| `apps/video-studio` | Remotion/video template source | Practitioner templates, Xico listing/promo templates, validation gates, brand packs |
| `apps/videoking` / `_external_reviews/videoking` | Architecture and monetization reference | Keep pattern-source status clear; do not treat as live Worker until explicitly deployed |

### B. External app repos and product surfaces

| Surface | Current role | World Class 360 required work |
|---|---|---|
| `Latimer-Woods-Tech/prime-self` | Live reference Worker/API | Keep health/auth/practitioner routes verified; add Practitioner Studio entitlement/render hooks if productized here |
| `Latimer-Woods-Tech/prime-self-ui` | Live SelfPrime Pages site | Keep smoke/a11y/auth green; add pricing, legal, Studio onboarding, dashboard entry points if it remains launch frontend |
| `C:/Users/Ultimate Warrior/Documents/GitHub/xico-city` | Full marketplace app for this iteration | Complete S-00 through S-11: stabilization, identity, host onboarding, catalog, discovery, bookings, reviews, subscriptions, payouts, curator tooling, compliance, PWA |
| `Latimer-Woods-Tech/wordis-bond` | Created app repo | Validate scaffold, lockfile, env, CI, app README, service registry readiness; defer feature work unless W360 expands scope |
| `Latimer-Woods-Tech/cypher-healing` | Created app repo | Validate scaffold, lockfile, env, CI, app README, service registry readiness; defer feature work unless W360 expands scope |
| `Latimer-Woods-Tech/ijustus` | Created app repo | Validate scaffold, lockfile, env, CI, app README, service registry readiness; defer feature work unless W360 expands scope |
| `Latimer-Woods-Tech/the-calling` | Created app repo | Validate scaffold, lockfile, env, CI, app README, service registry readiness; defer feature work unless W360 expands scope |
| `Latimer-Woods-Tech/neighbor-aid` | Created app repo | Validate scaffold, lockfile, env, CI, app README, service registry readiness; defer feature work unless W360 expands scope |

### C. Shared package surfaces

All packages under `packages/` are in scope for standards and config refinement, especially:

- `packages/deploy` for templates and reusable deploy gates.
- `packages/studio-core` for manifests, command schemas, app registry, smoke probe contracts.
- `packages/design-system` for UI standards and reusable tokens/components.
- `packages/testing` for smoke, a11y, webhook, event, and worker test factories.
- `packages/analytics`, `packages/monitoring`, `packages/logger`, and `packages/errors` for observability standards.
- `packages/stripe`, `packages/auth`, `packages/neon`, `packages/compliance`, `packages/video`, `packages/schedule`, and `packages/validation` for money-moving, identity, data, legal, render, and quality gates.

---

## 3. Template backlog

| Template | Owner package/path | Why it is needed | Exit criteria |
|---|---|---|---|
| Worker app scaffold template | `packages/deploy/templates/` | Every Worker starts with health, ready, errors, logging, auth hooks, manifest, and deploy gate | `phase-7` and new app scaffold consume it |
| Pages/PWA app template | `packages/deploy/templates/` or `docs/templates/` | Xico and future apps need consistent frontend setup | Includes Vite/React or static Pages convention, a11y smoke, env injection, `_redirects` pattern |
| App README template upgrade | `docs/APP_README_TEMPLATE.md` | Existing app README template should include W360 gates | Includes local/staging/prod setup, secrets, health, smoke, rollback, owner, support |
| Feature-slice RFC template | `docs/templates/` | Prevents vague feature work | Includes outcome, routes, schema, events, tests, SLO, rollback, operator flow |
| Function manifest template | `packages/studio-core` + `docs/templates/` | Admin Studio needs machine-readable capabilities | Includes auth, reversibility, risk tier, smoke probes, SLO, owner |
| Stripe checkout/webhook template | `docs/templates/` + `packages/testing` | Money-moving work must be repeatable and idempotent | Tests reject bad signatures and duplicate events |
| Credit ledger template | `docs/templates/` | Practitioner Studio needs auditable credits | Append-only ledger, reason codes, idempotency keys, refund/reversal examples |
| Booking/payout template | `docs/templates/` | Xico needs safe commerce | Booking lifecycle, cancellation/refund, payout record, DLQ/retry tests |
| Analytics event contract template | `docs/templates/` + `packages/analytics` | Events should be tested like code | Event schemas and journey tests fail on missing or malformed events |
| Smoke/a11y template | `packages/testing` + `docs/templates/` | Prime Self smoke should become reusable | One command configures live-only smoke and axe checks for any app |
| Synthetic monitor target template | `apps/synthetic-monitor` + `docs/templates/` | New endpoints need fast monitor onboarding | Adds route target, expected code, owner, escalation, schedule |
| Support/refund runbook template | `docs/templates/` | Revenue apps need operator scripts | Covers failed login, failed render, failed booking, refund, data deletion |
| Launch package template | `docs/templates/` | Prevents launches without pricing/legal/SEO/demo proof | Includes pricing, legal, demo data, SEO, smoke, analytics, support, rollback |
| Seed/demo data template | `docs/templates/` | Xico and Studio need credible demos | Deterministic seed content, no secrets/PII, reset instructions |
| Historical banner template | `docs/templates/` | Stale docs need safe labeling | One consistent banner for superseded docs |

---

## 4. Standards backlog

| Standard | Current state | Required improvement |
|---|---|---|
| API route standard | Implied by Hono patterns | Publish route naming, versioning, auth, error, pagination, idempotency, health/ready rules |
| Worker runtime standard | Strong in `CLAUDE.md` | Add automated checks for no Node built-ins, no `process.env`, no raw `fetch`, no `Buffer`, no `any` public APIs |
| Auth/RBAC standard | Package exists | Define app roles, admin roles, service tokens, smoke auth, negative auth tests |
| Money-moving standard | Package support exists | Require signed webhooks, idempotency, append-only ledgers, replay tests, reconciliation runbook |
| AI/video safety standard | Partially documented | Require forbidden claims, prompt-leak checks, output validation, cost estimates, user disclosure |
| Frontend standard | `docs/FACTORY_FRONTEND_STANDARDS.md` exists | Tie standards to concrete CI gates: a11y, responsive, web vitals, forms, error states, design tokens |
| Design standard | `docs/packages/design-standards.mdx` exists | Make component/token ownership explicit; define brand pack boundaries by app |
| Analytics standard | Package exists | Require event contract tests for each launch-critical journey |
| Observability standard | Packages exist | Require correlation IDs, Sentry context, structured logs, dashboard ownership, synthetic probes |
| Config standard | Scattered across runbooks/templates | Create one required config checklist per app/repo |
| Documentation standard | New doc index exists | Add status banners and require canonical links in every plan |
| Release standard | Runbooks exist | Enforce deploy gates, rollback rehearsal, and run ID/status recording |

---

## 5. Config refinement backlog

| Config area | Required work |
|---|---|
| `wrangler.jsonc` | Normalize Worker names, env blocks, Hyperdrive binding names, compatibility flags, unsafe/stale migrations, secret-free vars |
| `.dev.vars.example` | Every Worker/app gets a non-secret example with required keys and comments |
| GitHub Actions | Normalize `npm ci`, typecheck, lint, test, build, deploy, health gate, artifact retention, environment approvals |
| Reusable deploy gate | Implement shared script/workflow based on `scripts/verify-http-endpoint.mjs` |
| `package.json` | Require exact or policy-approved dependency versions, complete scripts, no missing build/lint/test commands |
| Lockfiles | Every app repo must support clean `npm ci`; generated folders must not be committed |
| `tsconfig` | Workers-only strict ESM config with no Node ambient type leakage |
| ESLint | Zero warnings, no `any` public APIs, no Node built-ins, no raw fetch without wrapper/error handling |
| Vitest | Coverage thresholds aligned with Factory gates; Workers pool where runtime-sensitive |
| Renovate | Enable package drift monitoring for all app repos and Factory packages |
| Service registry | Add any public Workers/Pages as they become real; avoid reference-only endpoints being mistaken as live |
| Sentry/PostHog | Confirm project/env naming, event names, release tags, and alert ownership |
| Synthetic monitor | Standard target schema and onboarding checklist |
| Admin Studio registry | Ingest apps, packages, workflows, manifests, secrets inventory status, and deploy proof |

---

## 6. Process maturity assessment

| Dimension | Current score | World-class target | Gap |
|---|---:|---:|---|
| Strategy clarity | 8/10 | 10/10 | World Class 360 is now clear, but all app surfaces needed explicit scope mapping |
| Engineering guardrails | 8/10 | 10/10 | Strong constraints; needs more automated enforcement across external repos |
| Workflow/release discipline | 7/10 | 10/10 | Matrix exists; reusable deploy gate and rollback rehearsals still needed |
| Product/UX discipline | 7/10 | 10/10 | Standards exist; need CI-enforced UX/a11y/performance and templates |
| Revenue safety | 6/10 | 10/10 | Entitlements, ledgers, replay, reconciliation, support runbooks not complete |
| Observability | 7/10 | 10/10 | Synthetic monitor exists; event verification and journey SLOs need enforcement |
| Documentation hygiene | 7/10 | 10/10 | Index exists; historical banners/archive moves remain |
| Multi-agent coordination | 7/10 | 10/10 | OWR and dashboard exist; path ownership and conflict locks need enforcement |

Overall: **7.1/10 now; world-class after W360-031 through W360-037 are complete.**

---

## 7. Required dashboard additions

Add these to `WORLD_CLASS_360_TASK_DASHBOARD.md`:

| ID | Workstream | Exit criteria |
|---|---|---|
| W360-031 | Full portfolio app scope registry | Every Factory app/repo is listed with status, owner, gates, and W360 disposition |
| W360-032 | Template buildout pack | Templates listed in this review exist and are referenced by scaffolding/runbooks |
| W360-033 | Standards catalog and enforcement | Standards are consolidated and each has an owner, gate, and test/check mechanism |
| W360-034 | Config normalization pass | Wrangler, GitHub Actions, package, TS, ESLint, Vitest, Renovate, service registry, Sentry/PostHog configs audited and normalized |
| W360-035 | App repo graduation gates | Created app repos cannot be marked ready until clean checkout, env verification, CI, deploy, smoke, docs, and ownership pass |
| W360-036 | Operator/support runbook pack | Refund, failed render, failed booking, login, data deletion, moderation, and rollback runbooks exist |
| W360-037 | Design and brand asset system | Logos, tokens, brand packs, templates, and app-specific design boundaries are inventoried and made reusable |

---

## 8. Final verdict

The plan is now materially better, but the process should not be called world-class until:

1. Every Factory app/repo is explicitly accounted for.
2. Templates exist for repeated app, commerce, smoke, support, launch, and manifest work.
3. Standards are enforced by checks, not just written in docs.
4. Configs are normalized across Factory and app repos.
5. Direct HTTP verification, event verification, and rollback evidence are mandatory gates.

The correct next implementation move is not another broad app feature. It is: **close W360-031 through W360-034, then execute Xico stabilization and Practitioner Studio entitlement bridge in parallel.**
