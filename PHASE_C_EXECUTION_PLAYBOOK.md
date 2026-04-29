# Phase C Execution Playbook

**Status:** Activation Ready  
**Last Updated:** April 29, 2026  
**Scope:** UX Quality + Monetization Maturity + Operational Excellence (Phase C in WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md)  
**Related:** SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md, WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md

---

## Executive Overview

Phase C transforms the system from "working infrastructure" to "world-class product." The phase has three tracks:

1. **UX Quality & Journey Redesign** — Task success > 90%, accessibility AA, design consistency
2. **Monetization Maturity** — Operator-safe flows, end-to-end instrumentation, trust signals
3. **Operational Excellence** — SLOs active, incident recovery verified, revenue integrity live

**Success Criteria:** SelfPrime + VideoKing demonstrate measurable conversion lift, zero accessibility debt on critical flows, and operator confidence in monetization and recovery workflows.

**Success Metrics:**
- Core journey task success rate > 90%
- Conversion lift on key monetization flows (% TBD per product goal)
- WCAG 2.2 AA issues at zero for critical flows
- Zero critical regressions in auth and money-moving flows
- Payout ops dashboard with batch review and recovery flows
- SLOs published with live dasboard; rollback verified for every release type

**Timeline:** Phase C spans Weeks 1–8 (concurrent execution of T1–T3, T5 tracks; then T4, T6, T7)

---

## Immediate Blockers (Phase E Prerequisites)

Before Phase C UX work begins, two blockers must be cleared:

### Blocker E0.2: Video Worker Health Checks

**Problem:** Shared video Workers (`schedule-worker`, `video-cron`) are not reachable at documented production URLs.

**Current State:**
```
https://schedule-worker.adrper79.workers.dev/health → 404
https://video-cron.adrper79.workers.dev/health → 404
```

**Action Required:**
1. Verify Hyperdrive IDs are configured in both workers
2. Verify Workers are deployed (check `wrangler deploy` in CI)
3. If missing routes: add `/health` endpoints to workers
4. Verify endpoint returns 200 with:
   ```json
   {
     "status": "ok",
     "version": "0.2.0",
     "timestamp": "2026-04-29T...",
     "nextRun": "2026-04-29T...", // for cron workers
     "registryUpdated": "2026-04-29T..." // confirm registry awareness
   }
   ```
5. After both return 200: update SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md E0.2 to ✅ Complete

**Owner:** Factory Platform Lead  
**Dependency:** Blocking all SelfPrime video UX work  
**Est. Time:** 2–4 hours (likely quick fix: route issue or secret)

---

### Blocker E0.3: Schedule Pipeline Tenancy

**Problem:** Shared video scheduling pipeline must guarantee private SelfPrime data doesn't leak into queued jobs.

**Current State:** Unknown; needs audit

**Action Required:**
1. Read `apps/schedule-worker/src/index.ts` and `apps/video-cron/src/index.ts`
2. Verify auth is app-scoped (not global)
3. Verify SelfPrime can only queue jobs with sanitized context (app ID, user ID, brief) — NOT raw chart data
4. Verify queued job has audit trail (Sentry event, database log entry)
5. If gaps exist: add RBAC + input validation middleware

**Owner:** Factory Platform Lead + SelfPrime Backend Lead  
**Dependency:** Required before SelfPrime puts private chart data in shared queue  
**Est. Time:** 4–8 hours (audit + middleware if needed)

---

## Phase C Execution Track Map

### Track 1: UX Quality & Journey Redesign (T1 + T4.2 + T4.3)

**Goal:** Make every critical user journey feel intentional, accessible, and trustworthy.

**Initiatives (in order):**

| ID | Initiative | Owner | Dependencies | Est. Time | Starting Assets |
|---|---|---|---|---|---|
| C1.1 | Audit critical journeys against design rubric | Product + Design | T1.1 (rubric exists) | 16h | T1.1 rubric + T1.2 journey pack |
| C1.2 | Redesign tier-gating UX (SelfPrime checkout, unlock paywalls) | SelfPrime Product + Design | C1.1 complete | 24h | Figma, user research from T1.2 |
| C1.3 | Implement operator pattern library (tables, filters, chips) | Factory Design + VideoKing Admin | C1.1 complete | 32h | T4.3 patterns + Figma components |
| C1.4 | WCAG 2.2 AA audit on critical flows | QA + Design + A11y | C1.1 complete | 12h | axe-core, NVDA/JAWS testing |
| C1.5 | Implement accessibility remediation backlog | Frontend teams | C1.4 complete | 40h | WCAG backlog from C1.4 |
| C1.6 | Instrument user journey metrics in PostHog | Analytics + Product | C1.2, C1.5 complete | 16h | PostHog event schema from T1.2 |

**Exit Criteria (all required):**
- [ ] All critical journeys pass design rubric review
- [ ] Task success rate measured in analytics > 85% baseline
- [ ] WCAG 2.2 AA full compliance on: auth, signup, checkout, practitioner onboarding, creator upload
- [ ] Conversion metrics visible in PostHog funnel
- [ ] Design system token library published and adopted

**Success Signals:** Users report smoother onboarding; support tickets on "flow confusion" drop; conversion rate lifts measurably.

---

### Track 2: Monetization Maturity (T3 + T2.2)

**Goal:** Make monetization feel operator-safe, trustworthy, and measurable.

**Initiatives (in order):**

| ID | Initiative | Owner | Dependencies | Est. Time | Starting Assets |
|---|---|---|---|---|---|
| C2.1 | Audit creator onboarding journey end to end | Payments Lead + Product | T3.1 (schema exists) | 12h | T3.1 connected-account docs |
| C2.2 | Implement Stripe Connect error recovery UI | SelfPrime Backend + Frontend | C2.1 complete | 24h | Stripe test fixtures, error taxonomy |
| C2.3 | Add payout ops dashboard (batch review, retry, recovery) | VideoKing Admin + Backend | T3.2 (patterns exist) | 40h | T3.2 DLQ recovery docs + SQL templates |
| C2.4 | Test subscription, unlock, payout critical flows | QA + Backend | C2.2, C2.3 complete | 24h | T2.2 test patterns + fixtures |
| C2.5 | Instrument monetization funnel (checkout → payout) | Analytics + Backend | C2.3, C2.4 complete | 16h | PostHog contract from T3.3 |
| C2.6 | Document revenue integrity review cadence | Ops + Finance | C2.5 complete | 8h | T3.4 weekly review process |

**Exit Criteria (all required):**
- [ ] Creator onboarding success rate > 90%; failure reasons logged
- [ ] Payout operations dashboard live with batch review, retry, recovery flows
- [ ] Zero manual exceptions in weekly revenue reconciliation (first 4 weeks)
- [ ] Checkout → payout funnel visible in PostHog with drop-off rates < 5%
- [ ] SLA for payout processing documented and adhered to (e.g. < 2 business days)

**Success Signals:** Operators express confidence in payout recovery; creators report smooth onboarding; zero revenue surprises in reconciliation.

---

### Track 3: Operational Excellence (T5 + T6)

**Goal:** Make reliability, incident response, and release governance measurable and trustworthy.

**Initiatives (in order):**

| ID | Initiative | Owner | Dependencies | Est. Time | Starting Assets |
|---|---|---|---|---|---|
| C3.1 | Activate SLO dashboards (auth, checkout, payouts, video playback) | Platform Ops | T5.1 (SLOs defined) | 12h | T5.1 SLO specs + TimeStream setup |
| C3.2 | Document and test rollback paths for critical services | Platform Eng | T6.1 (gates exist) | 16h | T6.3 runbooks + wrangler config |
| C3.3 | Run security review on auth, payments, moderation, analytics | Security + Platform | T5.4 (checklist exists) | 24h | T5.4 security checklist |
| C3.4 | Formalize incident response: detection → triage → recovery | Ops Lead | C3.1, C3.2 complete | 12h | T5.3 incident template + postmortem guide |
| C3.5 | Run chaos testing on DLQ, payouts, video transcoding | QA + Backend | C3.4 complete | 20h | Chaos test fixtures + failure scenarios |
| C3.6 | Publish KPI dashboard: lead time, change failure rate, MTTR | Eng Manager | C3.1–C3.5 complete | 8h | GitHub metrics API + TimeStream |

**Exit Criteria (all required):**
- [ ] SLO dashboard shows > 99.9% uptime for auth, > 99.8% for payments, > 95% for video playback (current baseline)
- [ ] Rollback verified for every production release type (worker, page, job, schema change)
- [ ] Security review completed; zero critical findings; P1 exceptions documented
- [ ] Incident response tested: detection to recovery in < 15 min for auth outages, < 30 min for payment issues
- [ ] Chaos tests demonstrate graceful degradation (no data loss, no unrecoverable states)
- [ ] KPI dashboard shows 95%+ deployment success rate, < 2% change failure rate

**Success Signals:** On-call confidence; zero surprise outages; revenue integrity never questioned; operators never manually retry failed jobs.

---

## Sequencing & Cross-Track Dependencies

### Week 1–2: Foundation (Parallel)
- **C1.1** Design rubric audit (Product + Design)
- **C2.1** Creator onboarding audit (Payments + Product)
- **C3.1** Activate SLO dashboards (Ops)
- **Clear Blockers E0.2 + E0.3** (Platform)

### Week 3–4: Implementation (Parallel)
- **C1.2 + C1.3** Redesign checkout + operator UI patterns (Design + Frontend)
- **C2.2 + C2.3** Stripe error recovery + payout ops dashboard (Backend + Admin)
- **C3.2 + C3.3** Rollback verification + security review (Platform + Security)

### Week 5–6: Testing & Instrumentation (Parallel)
- **C1.4 + C1.5** WCAG audit + accessibility remediations (QA + Frontend)
- **C2.4 + C2.5** Monetization flow tests + funnel instrumentation (QA + Analytics)
- **C3.4 + C3.5** Incident response + chaos testing (Ops + QA)

### Week 7–8: Dashboards & Governance (Sequential)
- **C1.6** User journey instrumentation (Analytics)
- **C2.6** Revenue integrity cadence (Ops + Finance)
- **C3.6** KPI dashboard publication (Eng Manager)

### Hard Stops
- No SelfPrime video UX work begins until **E0.2** ✅ (Worker health)
- No money-moving code deploys until **C2.4** ✅ (Tests passing)
- No incident response can be called "live" until **C3.5** ✅ (Chaos tested)

---

## Definition of Ready for Phase C Work

A Phase C feature or initiative is ready to start only when:

1. **Outcome is explicit.** "Improve checkout" is not ready; "reduce checkout abandonment from 8% to < 5%" is ready.
2. **Design is approved.** Figma mockups reviewed by design lead + product lead. Accessibility implications understood.
3. **Data structure is defined.** PostHog events, database schema, or API contract is written and reviewed.
4. **Testing strategy exists.** Unit tests, E2E specs, accessibility tests, and load test baseline are documented.
5. **Dependencies are named.** What Factory packages are required? What other initiatives must complete first?
6. **Success metric is measurable.** "Ship it" is not a metric; "task success rate > 90%" is.
7. **Rollback plan exists.** How will you revert if this breaks revenue or accessiblity?

---

## Definition of Done for Phase C Work

A Phase C initiative is done only when:

1. **Code is merged to main.** All peer reviews done. CI green. Linting + security + performance budgets pass.
2. **Tests are in place.** Unit coverage ≥ 85%, integration tests for critical paths, E2E tests for user journeys, accessibility tests for wCAG compliance.
3. **Documentation is updated.** README, runbook, operator guide, and CLAUDE.md standing orders reflect the change.
4. **Observability is live.** Sentry + PostHog events are firing. Dashboards show the metric. Alerts are configured.
5. **Validation is executed.** QA sign-off. Accessibility audit passed. Performance baseline meets budgets. Security review cleared.
6. **Dashboard is updated.** This playbook is updated with ✅ or status; metrics are visible; exit criteria are met.

---

## Phase C Kickoff Checklist

Before declaring Phase C execution active, verify:

- [ ] All blockers (E0.2, E0.3) are identified and assigned
- [ ] RFFC process is active (T6.2 done)
- [ ] Design system tokens are published (T4.3 done)
- [ ] SLO framework is documented (T5.1 done)
- [ ] Incident response template is ready (T5.3 done)
- [ ] Each track lead has confirmed team and calendar
- [ ] First sprint plan is written and committed
- [ ] Metrics baseline is captured (current checkout bounce rate, payout success rate, uptime %, MTTR)
- [ ] This playbook is link pinned in Slack #factory-platform

---

## Success Dashboard

Track progress week by week:

| Week | C1 Status | C2 Status | C3 Status | Blockers | On Track? |
|---|---|---|---|---|---|
| 1–2 | Audit: [ ] 0% | Audit: [ ] 0% | SLO up: [ ] 0% | E0.2, E0.3 | 🔴 Blocked |
| 3–4 | Redesign: [ ] 0% | Errors: [ ] 0% | Rollback: [ ] 0% | TBD | 🟡 Pending |
| 5–6 | A11y: [ ] 0% | Tests: [ ] 0% | Incident: [ ] 0% | TBD | 🟡 Pending |
| 7–8 | Metrics: [ ] 0% | Revenue: [ ] 0% | KPI: [ ] 0% | None | 🟢 On Track |

---

## Notes

- This playbook is a **living document**. Update it weekly with progress, blockers, and learnings.
- Each initiative should have a corresponding RFC (T6.2) for design/implementation review.
- Failures and learnings should be captured in postmortem notes linked here.
- Blocking issues should immediately escalate to the Factory Platform Lead.
