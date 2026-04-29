# Phase C Activation — Immediate Actions

**Date:** April 29, 2026  
**Status:** Blockers Identified, Awaiting Platform Lead Assignment  
**Critical Path:** Clear blockers → Activate Phase C execution → Week 1 kickoff

---

## Blocker Inventory

### Blocker E0.2: Video Workers Not Deployed ⏳ URGENT

**Description:** Both `schedule-worker` and `video-cron` are configured but not deployed to Cloudflare.

**Current State:**
```
https://schedule-worker.adrper79.workers.dev/health → Cloudflare 1042 (route doesn't exist)
https://video-cron.adrper79.workers.dev/health → Cloudflare 1042 (route doesn't exist)
```

**Root Cause:** Workers haven't been deployed via `wrangler deploy` in CI/CD.

**Configuration Verified:**
- ✅ `apps/schedule-worker/wrangler.jsonc` exists with correct config
- ✅ `apps/video-cron/wrangler.jsonc` exists with correct config  
- ✅ Both have `workers_dev: true` (auto-routed to .workers.dev)
- ✅ Hyperdrive binding configured: `78e47571fffb4a81ba12ee454507e006`
- ✅ Cron trigger configured: `0 * * * *` (hourly in video-cron)

**Action Required:**
1. Deploy schedule-worker:
   ```bash
   cd apps/schedule-worker
   npm run build
   wrangler deploy --env production
   ```
2. Deploy video-cron:
   ```bash
   cd apps/video-cron
   npm run build
   wrangler deploy --env production
   ```
3. Verify health endpoints:
   ```bash
   curl https://schedule-worker.adrper79.workers.dev/health
   curl https://video-cron.adrper79.workers.dev/health
   # Both must return 200 with: {"status":"ok","version":"0.2.0",...}
   ```
4. Update [SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md](SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md) → E0.2 status to ✅ Complete

**Owner:** Factory Platform Lead  
**Dependencies:** Neon credentials + Cloudflare API token  
**Est. Time:** 30 min (likely just needs `wrangler deploy`)  
**Blocking:** All SelfPrime video UX features

---

### Blocker E0.3: Schedule Pipeline Tenancy Audit ⏳ REQUIRED

**Description:** Verify that shared video scheduling pipeline cannot leak private SelfPrime data.

**Current State:** Unknown; needs audit of `apps/schedule-worker/src` and `apps/video-cron/src`

**Audit Checklist:**
- [ ] `schedule-worker` has endpoint to accept scheduled video requests
- [ ] Endpoint validates request comes from authorized app (e.g. app ID via header or API key)
- [ ] SelfPrime can only send sanitized context: `{ appId, userId, videoType, brief }`
- [ ] SelfPrime does NOT send raw chart data, PII, or sensitive profiles
- [ ] Both workers log job creation with correlation ID (traceability)
- [ ] Both workers emit Sentry events on success/failure (debugging)
- [ ] Queue or KV storage is app-scoped (namespace or prefix isolation)

**Action Required:**
1. Read `apps/schedule-worker/src/index.ts` — note auth strategy and job schema
2. Read `apps/video-cron/src/index.ts` — note dispatch strategy and logging
3. If gaps exist:
   - Add RBAC middleware (app ID → authorization)
   - Add input validation (reject raw chart data)
   - Add audit logging/Sentry instrumentation
   - Document data isolation guarantees in runbook
4. Create runbook: docs/SCHEDULE_WORKER_ISOLATION_RUNBOOK.md
5. Update [SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md](SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md) → E0.3 status to ✅ Complete

**Owner:** Factory Platform Lead + SelfPrime Backend Lead  
**Dependencies:** E0.2 complete (workers deployed)  
**Est. Time:** 4–8 hours (audit + middleware if needed)  
**Blocking:** SelfPrime cannot put private data in shared queue until verified

---

## Phase C Activation Checklist

Before Phase C officially begins, complete these steps:

- [ ] **Blockers Cleared:** E0.2 and E0.3 are both ✅ Complete
- [ ] **Kickoff Meeting:** Factory Platform Lead + SelfPrime Product + VideoKing Product → review Phase C playbook
- [ ] **Track Leaders Assigned:** 
  - [ ] C1 (UX): Product Lead + Design Lead
  - [ ] C2 (Monetization): Payments Lead + Product Lead  
  - [ ] C3 (Ops): Platform Ops Lead
- [ ] **Week 1 Sprint Planned:** Audits (C1.1, C2.1, C3.1) assigned to owners
- [ ] **Metrics Baseline Captured:**
  - [ ] Checkout bounce rate (current: ?)
  - [ ] Payout success rate (current: ?)
  - [ ] API uptime % (current: ?)
  - [ ] MTTR for auth outages (current: ?)
- [ ] **Dashboard Posted:** PHASE_C_EXECUTION_PLAYBOOK.md pinned in #factory-platform Slack
- [ ] **First RFC Written:** T6.2 RFC template used for first C1.2 (checkout redesign)

---

## What Happens if Blockers Aren't Cleared?

| Blocker | Impact | Timeline |
|---|---|---|
| E0.2 Not Deployed | SelfPrime video features blocked; Phase C UX work stalled | Week 1–2 delay |
| E0.3 Not Audited | Risk of data leaks; cannot deploy to production; audit failure | Week 3+ delay, security incident risk |

---

## Phase C "Go" Decision Criteria

Phase C execution officially begins when **ALL** of these are true:

1. ✅ E0.2: Both video workers deployed and returning 200 health checks
2. ✅ E0.3: Data isolation audit complete; no critical findings
3. ✅ Week 1 sprint board is ready with assigned owners
4. ✅ Metrics baseline is captured in shared dashboard
5. ✅ First three initiatives (C1.1, C2.1, C3.1) have owners and start dates

---

## Next Steps

**Immediate (Today):**
1. Assign Blocker E0.2 to Platform Lead → deploy workers
2. Assign Blocker E0.3 to Platform + SelfPrime Lead → audit schedule pipeline

**This Week:**
1. Blockers cleared → kickoff meeting
2. Track leaders confirm capacity  
3. Week 1 sprint board ready
4. Metrics baseline captured

**Week 1:**
1. C1.1 Design audit starts (Product + Design)
2. C2.1 Creator onboarding audit starts (Payments + Product)
3. C3.1 SLO dashboard activation starts (Ops)
4. RFC reviews begin for C1.2 checkout redesign

---

## Document Links

- **Execution Playbook:** [PHASE_C_EXECUTION_PLAYBOOK.md](PHASE_C_EXECUTION_PLAYBOOK.md)
- **Synergy Plan:** [SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md](SELFPRIME_VIDEOKING_SYNERGY_DEVELOPMENT_PLAN.md)
- **World Class Dashboard:** [WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md)
- **Standing Orders:** [CLAUDE.md](CLAUDE.md)
- **Schedule Worker Config:** [apps/schedule-worker/wrangler.jsonc](apps/schedule-worker/wrangler.jsonc)
- **Video Cron Config:** [apps/video-cron/wrangler.jsonc](apps/video-cron/wrangler.jsonc)
