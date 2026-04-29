# Practitioner Video Studio — Revenue Ready-State Plan

**Date:** 2026-04-29  
**Status:** Execution plan  
**Canonical dashboard:** `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md`  
**Active prompt:** `prompts/PHASE_E_VIDEO_REVENUE_PROMPT.md` + `prompts/AGENT_SUCCESS_CONTRACT.md`  
**Goal:** convert the now-verified Factory video/SelfPrime foundation into a self-serve paid product with the highest possible launch success rate.

---

## 1. Executive decision

Build **Practitioner Video Studio** as the first revenue product.

Positioning:

> Practitioner Video Studio helps coaches, consultants, and expert practitioners turn their expertise into branded AI videos, private client recaps, and paid mini-lessons without editing software.

Primary rule: **do not expand the platform before the first paid self-serve loop works.**

The first commercial loop is:

```text
Landing page
  → pricing
  → Stripe Checkout
  → entitlement activated by signed webhook
  → onboarding wizard
  → create video request
  → credit/quota check
  → schedule-worker job
  → video-cron dispatch
  → render-video workflow
  → R2 + Cloudflare Stream
  → user dashboard shows playable video
  → embed/share/download
  → analytics and cost events recorded
```

Ready state is not “the code exists.” Ready state is **a stranger can pay, generate a video, receive a playable output, and understand what to do next without contacting the owner.**

---

## 2. Current verified baseline

### Proven

- `schedule-worker`, `video-cron`, and `synthetic-monitor` have live `200` health checks.
- `render-video.yml` has successful production runs and produces Cloudflare Stream UIDs.
- SelfPrime has a live Stream iframe in the public hero.
- Prime Self live-site smoke, auth, and accessibility gates have passed.
- R2 and Cloudflare Stream secrets are proven by successful upload and registration.
- Schedule-worker migration has completed.
- Cross-package integration CI has passed.

### Still not revenue-ready

The missing layer is the product/business layer:

- plan and price catalog,
- Stripe Checkout and signed webhooks,
- entitlements,
- credits and quotas,
- self-serve onboarding,
- user dashboard,
- cost guardrails,
- product-specific analytics,
- legal/AI policy pages,
- launch/acquisition system,
- operator recovery workflows.

---

## 3. Non-negotiable engineering principles

1. **Self-serve before scale.** No manual fulfillment path is launch-ready.
2. **Hosted Stripe Checkout first.** Use the lower-maintenance Stripe Checkout Sessions path before any custom embedded payment UI.
3. **Webhook security is mandatory.** Verify Stripe signatures against the raw body, store processed event IDs, handle duplicates, and do not rely on event ordering.
4. **Entitlements are source of truth.** UI state, dashboard access, and render limits must all derive from the entitlement service, not from client claims.
5. **Credits are a ledger, not a counter.** Every grant, debit, refund, expiration, admin adjustment, and failed-job credit reversal must be append-only and auditable.
6. **Render jobs are idempotent.** Customer actions must not double-charge credits or create duplicate render jobs on retry.
7. **Cost guardrails ship before launch.** No paid render endpoint without quotas, duration limits, retry limits, and kill switches.
8. **Privacy by default.** Private client recaps and chart-derived videos must be private/authenticated unless explicitly published.
9. **Workers stay Workers-safe.** No Node built-ins in Worker runtime, no `process.env`, no `Buffer`, no unhandled raw fetch, no secrets in source.
10. **Direct verification beats CI.** Every deployed surface must be verified with observed HTTP status and, where relevant, playable media.
11. **SLOs use user journeys.** Track landing, checkout, first render, playable output, and dashboard access as customer journeys.
12. **Agents work through bounded ownership.** Specialist agents claim paths and update dashboard evidence; no ad hoc root task boards.

---

## 4. Target architecture

### Runtime boundaries

| Surface | Owns | Must not own |
|---|---|---|
| SelfPrime UI / Practitioner Studio UI | Landing, pricing, onboarding, dashboard, video playback, embed copy | Secrets, direct Stream tokens, database writes outside APIs |
| SelfPrime / Studio API Worker | Auth, checkout session creation, entitlements, credits, user job creation, Stripe webhook handling | Remotion, ffmpeg, long-running render compute |
| `schedule-worker` | Shared render job queue, status, tenancy, app-scoped job isolation | Product pricing, raw private chart payloads |
| `video-cron` | Poll pending jobs and dispatch GitHub render workflow | App-specific policy decisions |
| `render-video.yml` | LLM script, TTS, Remotion, ffmpeg, R2 upload, Stream registration, job status update | Long-lived product state beyond artifacts |
| Admin Studio | Operator visibility, audit, replay, cost/risk dashboards | Unsafe production mutation without dry-run/RBAC/audit |

### New product components

| Component | Preferred home | Purpose |
|---|---|---|
| `studio_entitlements` tables | Product/API database | Plans, subscriptions, credit ledger, customer entitlements |
| Entitlement service | Package or product lib | Central policy for can-create-video, can-access-video, can-publish |
| Checkout routes | Product API Worker | Hosted Checkout session creation and billing portal |
| Stripe webhook route | Product API Worker | Signed event intake and entitlement activation |
| Onboarding wizard | Product UI | Collect niche, brand, tone, forbidden claims, first video intent |
| Video dashboard | Product UI | My videos, status, credits, embed/share/download, billing |
| Operator console MVP | Admin Studio or product admin route | Failed jobs, credit adjustments, refunds, replay, cost review |

---

## 5. Data model plan

### Required tables

#### `studio_plans`

Purpose: immutable-ish catalog mirror for plan policy.

Fields:

- `id`
- `slug` — `starter`, `pro`, `agency`, `founder_lifetime`
- `stripe_price_id`
- `billing_mode` — `subscription`, `one_time`, `credit_pack`
- `monthly_render_quota`
- `included_credits`
- `max_video_seconds`
- `max_retries_per_job`
- `private_video_allowed`
- `public_publish_allowed`
- `white_label_allowed`
- `active`
- `created_at`
- `updated_at`

#### `studio_customers`

Purpose: map product users to Stripe and app tenancy.

Fields:

- `id`
- `app_id`
- `user_id`
- `email_hash` or non-sensitive lookup key
- `stripe_customer_id`
- `default_plan_id`
- `status`
- `created_at`
- `updated_at`

#### `studio_subscriptions`

Purpose: local Stripe subscription projection.

Fields:

- `id`
- `customer_id`
- `stripe_subscription_id`
- `stripe_price_id`
- `plan_id`
- `status`
- `current_period_start`
- `current_period_end`
- `cancel_at_period_end`
- `last_event_id`
- `created_at`
- `updated_at`

#### `studio_credit_ledger`

Purpose: append-only render credit accounting.

Fields:

- `id`
- `customer_id`
- `app_id`
- `job_id`
- `entry_type` — `grant`, `debit`, `refund`, `expire`, `admin_adjustment`, `reversal`
- `credits_delta`
- `reason`
- `idempotency_key`
- `stripe_event_id`
- `created_by`
- `created_at`

Rules:

- never update ledger rows,
- never delete ledger rows,
- balance is computed from ledger or maintained as a derived projection,
- unique `idempotency_key` prevents duplicate debit/grant.

#### `studio_video_jobs`

Purpose: product-level projection of shared render jobs.

Fields:

- `id`
- `schedule_job_id`
- `customer_id`
- `app_id`
- `template_id`
- `visibility`
- `topic`
- `status`
- `credit_debit_ledger_id`
- `stream_uid`
- `embed_url`
- `failure_code`
- `failure_message`
- `cost_estimate_cents`
- `created_at`
- `updated_at`

#### `stripe_webhook_events`

Purpose: replay protection and audit.

Fields:

- `id`
- `stripe_event_id`
- `event_type`
- `api_version`
- `status` — `received`, `processed`, `ignored`, `failed`, `dead_lettered`
- `payload_hash`
- `object_id`
- `attempt_count`
- `processed_at`
- `created_at`

---

## 6. Workstream plan

### Team topology

| Team | Owner mode | Scope | Primary paths |
|---|---|---|---|
| Coordinator | Coordinator | Dashboard, OWR, sequencing, conflict resolution | `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md`, `docs/revenue/`, `prompts/` |
| Revenue API Team | Backend / money-moving | Checkout, Stripe webhook, entitlements, credits | Product API Worker, package libs, tests |
| Product UI Team | UI | Landing, pricing, onboarding, dashboard | SelfPrime UI / new Studio UI |
| Video Platform Team | Platform | Schedule-worker, video-cron, render workflow, replay | `apps/schedule-worker`, `apps/video-cron`, `.github/workflows/render-video.yml` |
| Observability Team | Ops | Events, SLOs, synthetic checks, dashboards | `apps/synthetic-monitor`, analytics package, docs/runbooks |
| Security & Compliance Team | Security | Auth, RBAC, Stripe signatures, legal pages, data deletion | API routes, legal docs, tests |
| Admin Studio Team | Ops UI | Operator console, audit, dry-run, replay | `apps/admin-studio`, `apps/admin-studio-ui`, `packages/studio-core` |
| Launch Team | Growth | SEO, examples, launch assets, email onboarding | docs/growth, UI pages, email templates |

### Loop model

Each workstream runs this loop:

```text
Plan → claim paths → implement small slice → local gates → integration gates → direct verification → dashboard evidence → next slice
```

No team can mark a slice done without:

- quality gate output,
- direct HTTP verification if deployed,
- event/ledger evidence if money-moving,
- rollback note,
- dashboard or plan update.

---

## 7. Phase plan

## Phase 0 — Lock the target and protect the baseline

**Duration:** 1 day  
**Owner:** Coordinator  
**Risk:** Low  
**Goal:** prevent more platform sprawl before revenue loop is built.

### Tasks

- Add this plan to the dashboard as the canonical revenue ready-state plan.
- Freeze new app buildout that does not directly support Practitioner Video Studio.
- Create OWR rows for checkout, entitlements, credits, dashboard, cost guardrails, legal, and launch.
- Confirm live baseline:
  - SelfPrime root `200`,
  - Stream iframe present,
  - schedule-worker `200`,
  - video-cron `200`,
  - synthetic-monitor `200`,
  - latest render workflow success.

### Exit gate

- Dashboard has one active revenue-readiness epic.
- Current verified baseline is recorded with run IDs and endpoint checks.

---

## Phase 1 — Money foundation: checkout, webhook, entitlements, credits

**Duration:** 5–7 days  
**Owner:** Revenue API Team + Security Team  
**Risk:** High / money-moving  
**Goal:** a customer can pay and receive a durable entitlement.

### Build

1. Plan catalog.
2. Hosted Stripe Checkout session creation.
3. Stripe billing portal link.
4. Signed Stripe webhook route.
5. `stripe_webhook_events` idempotency table.
6. Subscription projection table.
7. Entitlement service.
8. Credit ledger.
9. Negative tests:
   - invalid signature rejected,
   - duplicate webhook ignored,
   - out-of-order event reconciles from Stripe API or safely queues,
   - canceled subscription removes future quota,
   - failed payment moves entitlement into grace/paused state.

### Best-practice requirements

- Verify Stripe signatures using raw request body.
- Store every processed event ID.
- Listen only to required event types.
- Do not trust redirect success alone; fulfillment comes from webhook.
- Use idempotency keys for checkout/session creation where applicable.
- Return `2xx` quickly only after durable event receipt; process complex work asynchronously or with a safe internal handler.
- Store no Stripe secret in source or `wrangler.jsonc` vars.

### Required events

- `checkout_started`
- `checkout_completed`
- `subscription_activated`
- `subscription_cancelled`
- `credit_granted`
- `credit_debited`
- `credit_refunded`

### Exit gate

- Test checkout activates entitlement in production or staging.
- Duplicate webhook does not double-grant credits.
- Billing portal works.
- Credit balance is visible through an authenticated API.

---

## Phase 2 — Self-serve first render

**Duration:** 5–7 days  
**Owner:** Product UI Team + Video Platform Team + Revenue API Team  
**Risk:** High / customer-facing  
**Goal:** paid user creates first video without human help.

### Build

1. Onboarding wizard:
   - niche,
   - audience,
   - offer,
   - tone,
   - forbidden claims,
   - video type.
2. `POST /videos` product endpoint:
   - auth required,
   - entitlement check,
   - credit reservation/debit,
   - sanitized schedule-worker job creation,
   - product job projection row,
   - idempotency key.
3. `GET /videos/:id` status endpoint.
4. User-friendly failure states.
5. Credit reversal when job fails before usable output.
6. Job completion projection from schedule status/Stream UID.

### Privacy rules

- Private/client recap videos default to authenticated/private.
- Shared queue stores only minimal generation brief and context references.
- No raw private chart payloads in shared queue.
- Public publishing requires explicit user action and moderation policy.

### Exit gate

A new paid user can:

1. log in,
2. complete onboarding,
3. submit one video,
4. see status,
5. receive a playable video,
6. copy embed/share link,
7. see credits remaining.

---

## Phase 3 — Customer dashboard and operator console MVP

**Duration:** 4–6 days  
**Owner:** Product UI Team + Admin Studio Team  
**Risk:** Medium  
**Goal:** users and operator can manage the loop without terminal work.

### User dashboard MVP

- My videos.
- Generate new video.
- Render status.
- Credits remaining.
- Current plan.
- Billing portal.
- Copy embed.
- Download/share link when allowed.
- Basic analytics: views, completions, clicks.

### Operator console MVP

- Users/customers.
- Subscriptions.
- Credit ledger.
- Render jobs.
- Failed jobs.
- Replay failed job.
- Manual credit adjustment with audit reason.
- Cost estimate by job/customer.
- Kill switch for render creation.

### Exit gate

- User can self-serve account/video management.
- Operator can diagnose failed renders and adjust credits with audit trail.

---

## Phase 4 — Observability, SLOs, cost guardrails, and failure recovery

**Duration:** 4–6 days  
**Owner:** Observability Team + Video Platform Team + Security Team  
**Risk:** High / launch safety  
**Goal:** launch without blind spots or uncapped costs.

### SLOs

Use user-journey SLOs, not only endpoint uptime.

| Journey | Initial SLO | Measurement |
|---|---:|---|
| Landing/pricing available | 99.9% | synthetic monitor + Pages status |
| Checkout session creation | 99.5% | API success ratio |
| Webhook entitlement activation | 99.5% within 2 minutes | webhook event state |
| First render accepted | 99.0% | product job creation success |
| Render completes to playable Stream UID | 95.0% within 15 minutes | schedule + Stream ready state |
| Dashboard loads | 99.5% | synthetic auth smoke |

### Cost guardrails

- Plan-level monthly render cap.
- Plan-level max duration.
- Plan-level max retries.
- Per-user daily render throttle.
- Per-app global render throttle.
- Emergency render kill switch.
- Cost estimate recorded before dispatch.
- Cost actual/backfill when known.
- Alert at 70%, 90%, and 100% monthly cost budget.

### Failure recovery

- Failed workflow marks product and schedule job failed.
- Failed jobs show user-friendly message.
- Retry preserves original idempotency context.
- Credit reversal policy is deterministic.
- Operator replay is audited.
- Known failure codes have runbook steps.

### Exit gate

- Synthetic monitor covers public, checkout, dashboard, and render-status routes.
- Failure replay path is tested.
- Cost alerts and kill switch are documented and verified.

---

## Phase 5 — Legal, trust, and compliance

**Duration:** 2–4 days  
**Owner:** Security & Compliance Team  
**Risk:** Medium / legal  
**Goal:** sell legally and reduce avoidable disputes.

### Build/publish

- Terms of Service.
- Privacy Policy.
- Acceptable Use Policy.
- AI disclosure.
- Refund policy.
- Data retention policy.
- Generated content/IP policy.
- Medical/legal/financial disclaimer.
- Cookie/analytics notice where required.
- Account deletion/data export request path.

### Product-specific policy requirements

- No guaranteed income claims.
- No diagnosis/treatment claims.
- No legal/financial advice claims.
- No deepfake or impersonation use.
- No copyright-infringing uploads or prompts.
- User remains responsible for reviewing generated content before publishing.

### Exit gate

- All legal pages linked from footer and checkout flow.
- Refund/support path visible.
- Account deletion request path documented.

---

## Phase 6 — Launch and acquisition system

**Duration:** 5–10 days  
**Owner:** Launch Team + Product UI Team  
**Risk:** Medium / conversion  
**Goal:** create self-serve inbound demand without cold outreach.

### Build

- Sales landing page.
- Pricing page.
- Demo gallery with 3–5 videos.
- Founder offer page.
- FAQ.
- Comparison page.
- 20–50 programmatic SEO pages.
- Product Hunt launch copy.
- AppSumo submission packet.
- Indie Hackers / Show HN post draft.
- Automated welcome email.
- Abandoned checkout email.
- Render complete email.
- Weekly video idea email.
- Referral tracking link.

### Initial offer

- Founder Lifetime: `$999` limited seats.
- Pro: `$99/month`.
- Agency: `$2,500/year`.
- Optional credit packs after baseline margin is proven.

### Exit gate

- A new visitor can understand, pay, onboard, generate, and share without contacting support.
- Funnel events show each step.
- At least one full test purchase is completed end to end.

---

## 8. Test strategy

### Unit tests

- Plan policy calculation.
- Credit ledger balance.
- Credit debit idempotency.
- Credit reversal.
- Entitlement status transitions.
- Stripe webhook event parsing.
- Invalid signature rejection.
- Duplicate event no-op.
- Render request validation.
- Forbidden claims validation.

### Integration tests

- Checkout session creation with mocked Stripe response.
- Webhook activation updates entitlement.
- Render request debits credit and schedules job.
- Failed render reverses or preserves debit according to policy.
- Dashboard only returns authenticated user’s jobs.
- Admin credit adjustment emits audit event.

### Live smoke tests

- Public landing `200`.
- Pricing `200`.
- Login route works.
- Checkout create-session returns redirect/session.
- Webhook endpoint rejects invalid signature.
- Authenticated dashboard `200`.
- Create test render job.
- Poll job to terminal state.
- Stream iframe is present and playable.

### Accessibility and UX gates

- WCAG 2.2 AA critical pages.
- Keyboard navigation for checkout/onboarding/dashboard.
- Mobile layout for pricing/onboarding/dashboard.
- Clear loading, empty, error, and success states.

---

## 9. Deployment and release gates

### Environments

| Environment | Purpose | Gate |
|---|---|---|
| Local | fast dev and mocked Stripe/render | unit/integration tests |
| Staging | real Stripe test mode, staging DB, staging render if safe | full E2E smoke |
| Production | paid users and real media | approval + smoke + rollback plan |

### Production deploy checklist

- `git status -sb` clean except intentional files.
- Package/app gates pass.
- Migration reviewed and reversible or rollback documented.
- Stripe webhook endpoint configured for only needed events.
- Secrets exist in proper environment.
- Staging smoke passed.
- Production deploy completed.
- Direct HTTP verification observed.
- Dashboard/OWR updated with run IDs and endpoint statuses.

---

## 10. Agent execution packages

### Agent Package A — Revenue API

**Paths:** product API Worker, entitlement package/lib, tests  
**Risk:** high / money-moving  
**Exit:** checkout + webhook + entitlements + credits pass tests and live smoke.

### Agent Package B — Product UI

**Paths:** landing/pricing/onboarding/dashboard UI  
**Risk:** medium / conversion  
**Exit:** public pages and authenticated dashboard pass build, smoke, a11y.

### Agent Package C — Video Integration

**Paths:** schedule-worker integration, render workflow, job status projection  
**Risk:** high / user output  
**Exit:** paid user job produces playable Stream UID and dashboard row.

### Agent Package D — Ops and Observability

**Paths:** synthetic monitor, analytics events, SLO docs, workflow gates  
**Risk:** medium / launch safety  
**Exit:** funnel, SLO, cost, and failure events are visible.

### Agent Package E — Security and Legal

**Paths:** auth/RBAC, webhook verification, legal pages, deletion/export docs  
**Risk:** high / trust  
**Exit:** negative tests, policy pages, data deletion path, audit events pass.

### Agent Package F — Launch

**Paths:** SEO pages, demo gallery, email templates, launch copy  
**Risk:** medium / revenue  
**Exit:** public launch assets are live and tracked.

---

## 11. Readiness scoring

Do not launch until score is at least **90/100**.

| Category | Points | Required? |
|---|---:|---:|
| Live video happy path | 10 | Yes |
| Checkout + webhook + entitlement | 15 | Yes |
| Credit ledger + quotas | 15 | Yes |
| Self-serve onboarding | 10 | Yes |
| User dashboard | 10 | Yes |
| Cost guardrails | 10 | Yes |
| Product analytics | 10 | Yes |
| Legal/trust pages | 10 | Yes |
| Smoke/a11y/SLO gates | 5 | Yes |
| Launch/acquisition assets | 5 | Yes |

Automatic launch blockers:

- no signed webhook verification,
- no duplicate webhook protection,
- no credit/usage cap,
- no refund/support policy,
- no playable demo video,
- no user-facing dashboard,
- no direct production HTTP verification.

---

## 12. First 30-day operating cadence

### Daily

- Review render failures.
- Review checkout failures.
- Review cost budget.
- Review top funnel drop-off.
- Review support/refund requests.

### Twice weekly

- Ship one conversion improvement.
- Ship one reliability improvement.
- Publish one SEO/demo asset.

### Weekly

- Revenue review:
  - visitors,
  - checkout starts,
  - purchases,
  - activation rate,
  - first render success,
  - gross margin,
  - churn/refunds.
- Reliability review:
  - SLO status,
  - error budget,
  - failed render rate,
  - webhook failures,
  - smoke/a11y failures.

---

## 13. Definition of ready to sell

The product is ready to sell only when:

1. A stranger can pay through Stripe Checkout.
2. Webhook activation grants entitlement without manual work.
3. Paid user can generate at least one video.
4. Credit/quota enforcement prevents cost blowups.
5. Dashboard shows video status and playable output.
6. Failed renders are recoverable and understandable.
7. Legal/trust pages are published.
8. Analytics prove the funnel.
9. Direct HTTP checks and workflow run IDs are recorded.
10. Operator has a safe way to inspect and repair money/render issues.

---

## 14. Highest-success sequence

Execute in this exact order:

1. Phase 0 — freeze scope and register this plan.
2. Phase 1 — checkout/webhook/entitlements/credits.
3. Phase 2 — self-serve first render.
4. Phase 3 — dashboard/operator MVP.
5. Phase 4 — observability/cost/failure recovery.
6. Phase 5 — legal/trust.
7. Phase 6 — launch/acquisition.

Do not build additional standalone apps until Phase 2 is complete and at least one paid test purchase has successfully produced a playable video.
