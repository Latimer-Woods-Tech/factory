---
title: Release Procedure
description: End-to-end release process including staging verification, canary deployment, and auto-rollback.
---

# Release Procedure

**Last Updated:** April 28, 2026  
**Phase:** Phase D (T6.3)  
**Owner:** Tech lead + Ops + QA

## Release Schedule

**Default cadence:** Every 2 weeks (same day each sprint), typically **Monday 10:00 UTC**

**On-demand releases:** Only for critical security or revenue-blocking fixes; requires 2 approvals (tech lead + ops)

**Blackout dates:**
- Dec 24 – Jan 2 (holiday)
- 1 week before/after major events (product launches, blog posts)
- During known Infrastructure maintenance windows (check status.cloudflare.com)

---

## Phases of Release

### Phase 0: Feature Freeze (Friday Before Release, 17:00 UTC)

1. **Announce freeze:** Post in #releases "Feature freeze in effect"
2. **No new features merged** (only critical bugfixes + docs)
3. **All PRs must be reviewed** before EOD Friday
4. **Stable branch tagged:** `release/YYYY-MM-DD` (e.g., `release/2026-05-13`)

---

### Phase 1: Staging Deployment (Monday, 08:00 UTC)

1. **Deploy current main to staging environment:**
   ```bash
   cd apps/{app}
   git fetch origin
   git checkout main
   npm run build
   wrangler deploy --env staging
   ```

2. **Verify health endpoint:**
   ```bash
   curl https://{app}-staging.example.com/health
   # Should return 200 with green status
   ```

3. **Run smoke tests (automated):**
   ```bash
   npm run smoke-test:staging
   # Should pass all critical paths (login, create, subscribe, payout)
   ```

4. **Run performance baseline:**
   ```bash
   npm run perf-test:staging
   # Compare to previous baseline; flag if >10% regression
   ```

5. **Database migrations applied:**
   ```bash
   npm run migrate:staging
   # Should succeed; no schema errors
   ```

---

### Phase 2: Staging Review (Monday, 09:00 UTC)

**3-axis review:** Product, QA, Ops

| Reviewer | Checks | Approval |
|----------|--------|----------|
| **Product** | Feature correctness, UX, accessibility | Yes / No / Changes needed |
| **QA** | Smoke tests passed, no regressions, edge cases tested | Yes / No / Changes needed |
| **Ops** | Monitoring set up, rollback plan, incident response ready | Yes / No / Changes needed |

**If any "No" or "Changes needed":**
- Fix in main branch
- Redeploy to staging
- Re-review (restart Phase 2)
- Update release date if needed (communicate to team)

**If all approvals:** Proceed to Phase 3

---

### Phase 3: Canary Deployment (Monday, 10:30 UTC)

Deploy to **10% of production traffic** for **30 minutes**.

1. **Set canary traffic rule in CloudFlare:**
   ```
   Route 10% of requests to new Worker version
   Route 90% of requests to previous version
   Duration: 30 min
   ```

2. **Monitor canary metrics (every 2 min for 30 min):**
   - Error rate: Should be <1% (same as baseline)
   - Latency p99: Should be <200ms (not 5x increase)
   - Health check: `/health` returns 200

   | Metric | Baseline | Canary | Status |
   |--------|----------|--------|--------|
   | Error rate | 0.1% | 0.09% | ✅ Pass |
   | p99 latency | 140ms | 145ms | ✅ Pass (no regression) |
   | Requests/s | 1000 | 100 (10%) | ✅ Normal |

3. **If OK after 30 min:** Proceed to 100% deployment
4. **If error rate spikes >2%:** **Auto-rollback** to previous version (see Auto-Rollback)

*Canary monitoring is automated; ops reviews every 10 min.*

---

### Phase 4: Production Deployment (Monday, 11:00 UTC)

1. **Deploy to 100% production traffic:**
   ```bash
   # Update CloudFlare rule to route 100% to new version
   # OR manually deploy to production Workers
   wrangler deploy --env production
   ```

2. **Immediate verification (first 2 min):**
   ```bash
   curl https://{app}.adrper79.workers.dev/health
   # Should return 200
   
   # Check error rate in Sentry (real-time)
   # Should not spike above 0.5%
   ```

3. **Monitor for 1 hour:**
   - Error rate must stay <1%
   - Latency must stay within 10% of baseline
   - No unusual spike in any metric
   - If any anomaly: Consider rollback (see Rollback Decision)

---

### Phase 5: Post-Release Validation (Monday, 12:00 UTC)

1. **Run full integration tests:**
   ```bash
   npm run test:integration:production
   # All critical paths (login, payment, etc.) should pass
   ```

2. **Sample production database queries:**
   ```sql
   -- Revenue this hour should be > $0 (sanity check)
   SELECT COUNT(*) FROM transactions WHERE created_at > now() - interval '1 hour';
   
   -- No spike in errors (should be <0.2% affected)
   SELECT COUNT(*) FROM error_logs WHERE created_at > now() - interval '1 hour' AND severity='error';
   ```

3. **Communication:**
   - Post to #releases: "✅ Release deployed successfully"
   - Update status page: "All systems operational"
   - Post release notes to customer newsletter (if customer-facing)

4. **Incident-free window:**
   - If no incidents after 1 hour, release is **stable**
   - If incidents, see Rollback Decision tree below

---

## Auto-Rollback Triggers

If ANY of these conditions are true for >5 consecutive minutes, **automatic rollback** is triggered:

1. **Error rate >5%** (5x normal)
2. **API latency p99 >5000ms** (35x normal)
3. **Health check failing** (`/health` returns non-200)
4. **Database connection pool exhausted** (can't process requests)
5. **Payment processing down** (0 transactions in 10 min window)

**Auto-rollback procedure:**
1. Alert fires in Sentry + PagerDuty
2. Ops receives page: "Auto-rollback triggered"
3. Ops verifies issue is real (not false positive)
4. Ops executes rollback via CloudFlare or Worker console
5. Status page updated: "Incident, rolling back"
6. Post to #incidents: "Auto-rollback executed; investigating"

---

## Manual Rollback Decision Tree

**Even if auto-rollback doesn't trigger, on-call can declare rollback if:**

```
Are we detecting unusual behavior?
├─ YES (degraded performance, errors, data issues)
│  ├─ Did this start after our deploy? (check timestamps)
│  │  ├─ YES → Rollback immediately (5 min max)
│  │  └─ NO → Investigate further (likely not our fault)
│  └─ NO → Continue monitoring
└─ NO → Release is stable; monitor for 1h then stand down
```

---

## Staging vs. Production Checklist

### Pre-Release Checklist (Must Pass Before Release)

- [ ] **Code:** All PRs reviewed, no ESLint errors, TypeScript strict mode passes
- [ ] **Tests:** Unit tests >90% coverage, integration tests pass, e2e tests pass
- [ ] **Docs:** README updated, changelog entry added, API docs if applicable
- [ ] **Performance:** Web Vitals no regression >10%, API latency no regression >20%
- [ ] **Accessibility:** No new WCAG 2.2 AA issues (CI gate passes)
- [ ] **Security:** No hardcoded secrets, no new vulnerabilities (npm audit), secrets rotated if needed
- [ ] **Database:** Migrations tested on staging, rollback plan documented
- [ ] **Infrastructure:** No new permissions needed, rate limits reviewed, quotas verified
- [ ] **Stakeholders:** Product approved, ops approved, finance notified (if revenue impact)

### Post-Release Checklist (After 1 Hour)

- [ ] Error rate <0.5%
- [ ] Latency p99 within 10% of baseline
- [ ] No spike in any custom metric (revenue, users, etc.)
- [ ] No customer complaints in support queue
- [ ] No Sentry alerts for new error types
- [ ] Health endpoint returns 200
- [ ] Database is responsive (<50ms query time)
- [ ] Payment processing working (test transaction completed)

---

## Release Notes Template

Post to `#releases` channel after deployment:

```
🚀 RELEASE 2026-05-13 — DEPLOYED ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 WHAT'S NEW
• Feature: Creator onboarding redesign (faster signup, 90% less friction)
• Fix: Payout processing stuck on edge case (fixes 5 failed payouts)
• Performance: Payment validation 20% faster (parallel checks)

⚠️ KNOWN ISSUES
• Video transcoding queue taking 2x longer on average (investigating; issue #1234)

📊 METRICS
• Deployment time: 12 min (code + databases + validation)
• Canary: 30 min, error rate 0.09% (baseline 0.1%) ✅
• Staging sign-off: Product ✅, QA ✅, Ops ✅

🔄 ROLLBACK
• If needed: see #incident-{timestamp}
• Rollback procedure: docs/runbooks/rollback-runbook.md

💬 QUESTIONS?
• Slack: #videoking or ask the release lead
```

---

## Release Roles & Responsibilities

| Role | Responsibilities | Escalation |
|------|------------------|------------|
| **Release Lead** (Tech Lead) | Ensure all approvals, coordinate deployment, handle incidents | If delayed >30 min beyond schedule |
| **QA** | Run smoke tests, verify staging, verify post-release | Alert release lead if any test fails |
| **Ops** | Set canary rules, monitor metrics, ready for rollback | Alert release lead if any metric spikes |
| **Product** | Sign off on feature correctness, verify UX on staging | Alert release lead if UI issues found |
| **On-call** | Monitor production for 1 hour, ready to escalate | If incident, trigger incident response (see playbook) |

---

## Troubleshooting

### Canary metrics show latency spike but not error spike — What do I do?

**Analysis:** Users are timing out but not getting errors. This suggests:
- Database is slow
- External API (Stripe, etc.) is slow
- Code has inefficient hot path

**Action:**
1. Check database query logs (CloudFlare → Hyperdrive metrics)
2. Check external API latency (Stripe dashboard, Telnyx metrics)
3. If both are normal, check code for N+1 queries or loops
4. If identified, fix and re-deploy (restart release)
5. If unclear, rollback and investigate post-release

### Staging tests pass but production has errors — Why?

**Common causes:**
- Production data volume is higher (N+1 query exposed under load)
- Production has different configuration (check environment variables)
- Production has different database state (backup restored?)
- Timing-dependent bug (race condition revealed only under traffic)

**Action:**
1. Check production for unusual data state: `SELECT COUNT(*) FROM {table}`
2. Compare production vs. staging config: `echo $DATABASE_URL`
3. Check CloudFlare logs for patterns in failed requests
4. Rollback if pattern is unclear; debug post-release

---

## Related Docs

- [Pre-Release Checklist](../templates/PRE_RELEASE_CHECKLIST.md) — Detailed checklist before release
- [Smoke Test Template](../templates/smoke-test-template.md) — How to write smoke tests
- [Rollback Runbook](rollback-runbook.md) — How to quickly revert
- [Incident Response](incident-response-playbook.md) — If things go wrong during release
