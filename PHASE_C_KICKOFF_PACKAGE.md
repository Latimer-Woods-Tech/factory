# Phase C Kickoff Package

**Date:** April 29, 2026  
**Status:** Ready for Platform Lead Activation  
**Package Contents:** Complete Phase C execution plan + blocker resolution runbook

---

## What's in This Package

This package contains everything needed to execute Phase C (UX Quality + Monetization Maturity + Operational Excellence):

1. **PHASE_C_EXECUTION_PLAYBOOK.md** — Detailed 8-week execution plan with track ownership, dependencies, exit criteria, and success metrics
2. **PHASE_C_ACTIVATION_CHECKLIST.md** — Immediate action items (blockers + team assignments)
3. **PHASE_C_KICKOFF_PACKAGE.md** — This document; overview + next steps

---

## Key Dates & Milestones

| Milestone | Owner | Target Date | Blocker |
|-----------|-------|-------------|---------|
| **Blockers Cleared** | Platform Lead | May 1, 2026 | E0.2, E0.3 |
| **Week 1 Sprint Ready** | Track Leaders | May 5, 2026 | Blockers cleared |
| **C1 UX Audit Complete** | Product + Design | May 12, 2026 | C1.1 done |
| **C2 Monetization Audit Complete** | Payments + Product | May 12, 2026 | C2.1 done |
| **C3 SLO Dashboard Live** | Platform Ops | May 12, 2026 | C3.1 done |
| **Phase C Mid-point** | All | May 19, 2026 | Week 1–3 complete |
| **Phase C Complete** | All | June 23, 2026 | All C1–C3 exits met |

---

## Critical Path (What Must Happen First)

```
E0.2: Deploy video workers (2–4 hours)
  ↓
E0.3: Audit schedule pipeline (4–8 hours)
  ↓
Kickoff meeting (1 hour)
  ↓
Week 1 Sprint Board Ready (2 hours)
  ↓
C1.1, C2.1, C3.1 Start (parallel, all tracks)
```

**Timeline:** May 1–5, 2026

---

## Success Definition

Phase C is successful when **ALL** of these are true:

### UX Quality (C1)
- ✅ All critical journeys pass design rubric review (auth, signup, checkout, onboarding)
- ✅ Task success rate measured in analytics > 85% baseline (tracked in PostHog)
- ✅ WCAG 2.2 AA full compliance on critical flows (axe-core audit, NVDA verified)
- ✅ Conversion metrics visible in PostHog and reported weekly

### Monetization Maturity (C2)
- ✅ Creator onboarding success rate > 90% (logged failures < 10%)
- ✅ Payout ops dashboard live with batch review, retry, recovery (tested end-to-end)
- ✅ Zero unplanned manual exceptions in revenue reconciliation (4-week streak)
- ✅ Checkout → payout funnel visible in PostHog; drop-off < 5% at each stage
- ✅ SLA for payout processing documented (< 2 business days) and adhered to

### Operational Excellence (C3)
- ✅ SLO dashboard shows: auth > 99.9% uptime, payments > 99.8%, video > 95%
- ✅ Rollback verified for every production release type (worker, page, job, schema)
- ✅ Security review completed; zero critical findings; P1 exceptions documented
- ✅ Incident response tested: auth recovery < 15 min, payment fixes < 30 min
- ✅ Chaos tests demonstrate graceful degradation (no data loss)
- ✅ KPI dashboard shows 95%+ deployment success rate, < 2% change failure rate

---

## Team Assignments

### Platform Lead (Factory Infrastructure)
- [ ] Clear Blocker E0.2: Deploy schedule-worker + video-cron
- [ ] Clear Blocker E0.3: Audit schedule pipeline for data isolation
- [ ] Owns C3 (Operational Excellence) track
- [ ] Approves RFC reviews for infrastructure changes
- [ ] **Commits to:** Week 1 activation, blocker resolution by May 1

### Product Leads (SelfPrime + VideoKing)
- [ ] Lead C1 (UX audit) and C2 (monetization audit)
- [ ] Approve design rubric and journey maps
- [ ] Define success metrics for each journey
- [ ] Prioritize backlog based on UX debt
- [ ] **Commits to:** Week 1 sprint board, blocker clearance by May 1

### Design Lead
- [ ] Co-own C1 track (UX quality)
- [ ] Lead C1.2 (checkout redesign)
- [ ] Lead C1.3 (operator pattern library)
- [ ] Approve design system tokens
- [ ] **Commits to:** Design system handoff by May 19

### Payments Lead
- [ ] Co-own C2 track (monetization maturity)
- [ ] Lead C2.1 (creator onboarding audit)
- [ ] Lead C2.2 (Stripe error recovery UX)
- [ ] Lead C2.3 (payout ops dashboard)
- [ ] **Commits to:** Payout dashboard MVP by May 26

### Platform Ops Lead
- [ ] Own C3 track (operational excellence)
- [ ] Lead C3.1 (SLO dashboard activation)
- [ ] Lead C3.4 (incident response formalization)
- [ ] Define on-call runbooks per service
- [ ] **Commits to:** SLO dashboard live by May 12

---

## Blockers Requiring Resolution

### E0.2: Video Workers Deployment ⏳ CRITICAL

**Status:** Configuration verified, deployment pending  
**Owner:** Platform Lead  
**Work:**
1. Resolve Cloudflare account authentication mismatch
   - Current auth is to account `a1c8a33cbe8a3c9e260480433a0dbb06`
   - wrangler.jsonc targets account `a1f157c46a8049bf90f8b577f977b665`
   - Either update wrangler configs to current account OR rotate CF credentials
2. `wrangler deploy --env production` for both workers
3. Verify `/health` endpoints return 200

**Success Criteria:**
```bash
curl https://schedule-worker.adrper79.workers.dev/health
# Returns: {"status":"ok",...}

curl https://video-cron.adrper79.workers.dev/health
# Returns: {"status":"ok",...}
```

**Blocker Date:** May 1, 2026

---

### E0.3: Schedule Pipeline Data Isolation ⏳ CRITICAL

**Status:** Needs audit  
**Owner:** Platform Lead + SelfPrime Backend Lead  
**Work:**
1. Audit `apps/schedule-worker/src/index.ts` for RBAC + input validation
2. Audit `apps/video-cron/src/index.ts` for data isolation
3. Verify SelfPrime endpoint:
   - Only accepts app-scoped requests (e.g. app ID header)
   - Rejects raw private data (chart data, PII)
   - Logs requests with correlation ID
   - Emits Sentry events for ops visibility
4. Create runbook: `docs/SCHEDULE_WORKER_ISOLATION_RUNBOOK.md`

**Success Criteria:**
```typescript
// Correct: SelfPrime sends sanitized context
POST /jobs
{ appId: "selfprime", userId: "user123", videoType: "chart", brief: "Generate 5-min summary" }

// Rejected: Raw chart data
POST /jobs
{ appId: "selfprime", chart: { ...rawChartData... } }
// Response: 400 Bad Request
```

**Blocker Date:** May 1, 2026

---

## Week 1 Action Items

### Monday, May 1

- [ ] **Kickoff Meeting** (1 hour, Platform Lead + Track Leads)
  - Review PHASE_C_EXECUTION_PLAYBOOK.md
  - Confirm team assignments
  - Discuss blockers and unblock timeline
  - Approve critical success metrics

- [ ] **Blockers E0.2 + E0.3 Cleared**
  - Video workers deployed and health-checking ✅
  - Schedule pipeline audit complete, no critical findings ✅

### Tuesday, May 2–Friday, May 5

- [ ] **C1.1: UX Audit Sprint** (Product + Design)
  - Compare current app journeys against design rubric (T1.1)
  - Document findings: what's working, what needs redesign
  - Create RFC for checkout redesign (C1.2)

- [ ] **C2.1: Monetization Audit Sprint** (Payments + Product)
  - Walk through creator onboarding end-to-end
  - Document current success rate and failure modes
  - Create RFC for Stripe error recovery (C2.2)

- [ ] **C3.1: SLO Dashboard Sprint** (Ops)
  - Set up TimeStream queries for auth, checkout, payouts, video playback
  - Configure Grafana or similar dashboard
  - Define alert thresholds per SLO

- [ ] **Sprint Board Created**
  - Add Week 2 initiatives to GitHub Projects
  - Link to this playbook
  - Create Slack channel #phase-c-execution (pinned: this package)

---

## Slack Channels & Docs

- **#factory-platform** — Strategic updates, blocker escalation (existing)
- **#phase-c-execution** — Daily standup, RFC reviews (new)
- **#phase-c-ux** — Design + UX work, journey redesign (new, optional)
- **#phase-c-monetization** — Payments + ops work, payout ops (new, optional)

**Pinned in #phase-c-execution:**
1. PHASE_C_EXECUTION_PLAYBOOK.md
2. PHASE_C_ACTIVATION_CHECKLIST.md
3. Success metrics dashboard (link)

---

## Budget & Resource Considerations

### Estimated Effort
- Platform Lead: 2–4 hours/week on blockers + C3 track
- Product Leads: 8–12 hours/week on C1 + C2 audits
- Design Lead: 6–10 hours/week on design system + C1.2 work
- Payments Lead: 4–8 hours/week on C2.2 + C2.3 work
- Platform Ops: 4–6 hours/week on C3 track
- QA: 6–10 hours/week on testing + accessibility audits
- Analytics: 2–4 hours/week on instrumentation

**Total:** 32–54 person-hours/week for 8 weeks = 256–432 person-hours

### Budget Implications
- [ ] Confirm team capacity before May 1 kickoff
- [ ] Identify any resource conflicts (other projects, ON_CALL rotation)
- [ ] Plan for learning curve (RFC process, new tools)

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Video workers deployment delayed | Medium | High — blocks SelfPrime UX | Clear CF account issue by May 1; have backup deployment method |
| WCAG audit reveals widespread issues | Low | High — delays C1 exit | Start accessibility audit in Week 1; allocate budget for remediations |
| Payout SLA not achievable with current stack | Low | High — C2 exit blocked | Spike on payout latency; may need DB optimization or caching layer |
| Security review finds critical issues | Low | Critical — may halt C3 work | Start security audit in Week 1; schedule with security team early |
| Team capacity insufficient | Medium | High — slips all deadlines | Weekly capacity review; escalate to leadership if needed |

---

## Communication Plan

### Weekly
- **Standup:** Tues/Thurs 10:00 AM (15 min, #phase-c-execution)
- **Metrics Review:** Friday 4:00 PM (30 min, all leads)
- **Blockers Escalation:** Ad-hoc, ping Platform Lead

### Biweekly
- **Architecture + RFC Review:** Monday 2:00 PM (60 min, leads + designers)
- **Design System Review:** Wednesday 3:00 PM (45 min, design + C1 leads)

### Monthly
- **Phase C Leaders Sync:** First Monday (90 min, full track leads + Platform Lead)
- **Executive Review:** Last Friday (30 min, highlight progress + risks)

---

## Next Steps

**TODAY (April 29):**
1. ✅ Share this package with Platform Lead, all track leads
2. ✅ Confirm team assignments and capacity
3. ✅ Identify any blockers to May 1 kickoff

**WEEK OF MAY 1:**
1. Kickoff meeting (all on this package)
2. Clear E0.2 + E0.3 blockers
3. Create Week 1 sprint board
4. Capture metrics baseline
5. Stand up #phase-c-execution Slack channel

**WEEK OF MAY 5:**
1. Begin Week 1 sprints (C1.1, C2.1, C3.1 parallel)
2. First RFC reviews for major work items
3. Metrics tracking live in dashboard

---

## Document Chain

This package is part of a larger execution hierarchy:

1. **Standing Orders:** [CLAUDE.md](CLAUDE.md) (Factory core principles)
2. **World Class Plan:** [WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) (Phases A–E roadmap)
3. **Synergy Plan:** [SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md](SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md) (Product strategy)
4. **Phase C Playbook:** [PHASE_C_EXECUTION_PLAYBOOK.md](PHASE_C_EXECUTION_PLAYBOOK.md) (This week's work)
5. **Activation Checklist:** [PHASE_C_ACTIVATION_CHECKLIST.md](PHASE_C_ACTIVATION_CHECKLIST.md) (Immediate actions)
6. **This Package:** [PHASE_C_KICKOFF_PACKAGE.md](PHASE_C_KICKOFF_PACKAGE.md) (You are here)

---

## Questions?

- **Strategic questions:** See WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md
- **Synergy questions:** See SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md
- **Execution questions:** See PHASE_C_EXECUTION_PLAYBOOK.md
- **Blockers:** Ping Platform Lead on #factory-platform

**Phase C is ready to activate. Awaiting Platform Lead confirmation.**
