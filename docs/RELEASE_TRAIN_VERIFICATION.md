# Release Train: Staging → Canary → Production

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T6.3 — Formalize release train and verification flow  
**Scope:** Define staging/canary/production deployment procedures, smoke test checklist, and rollback readiness

---

## Executive Summary

**Current State:** Deployment is manual or ad-hoc:
- Unclear whether to stage first or deploy direct to prod
- No standard smoke tests
- Rollback takes "a while" if things break

**Future State:** Structured release pipeline:
1. **Staging:** Deploy to test environment; run smoke tests (5 min)
2. **Canary:** Deploy to 1% of production; monitor for errors (10 min)
3. **Rollout:** If canary healthy, gradually roll out 5% → 25% → 100% (20 min total)
4. **Verify:** Health checks pass; no alerts; manual verification
5. **Rollback Ready:** If anything breaks, rollback in <1 min

**Result by May 8:**
- ✅ Every deploy follows same path (no exceptions)
- ✅ Staging deployment <2 min with automated tests
- ✅ Canary deployment monitored for 10 min (auto-rollback if errors)
- ✅ Production rollback <1 min on-demand

---

## Part 1: Release Pipeline Architecture

### Tier 0: Local Development

```
Engineer: npm run dev
↓
Runs tests, typecheck, lint locally
↓
If all green: Ready for PR
```

**Checklist Before Pushing:**
- [ ] `npm run typecheck` passes
- [ ] `npm run lint -- --max-warnings 0` passes
- [ ] `npm test` passes (coverage ≥85%)
- [ ] Manual smoke test (curl health endpoint)
- [ ] No secrets in code

### Tier 1: GitHub Actions (PR Checks)

```
Engineer: git push origin feature-branch
↓
GitHub Actions triggers:
├─ npm run typecheck
├─ npm run lint
├─ npm run test
├─ npm run build
└─ Lighthouse performance check (next.js apps)
↓
If all green: PR ready for review
↓
Reviewer: Approves PR + merges to main
```

### Tier 2: Staging Deployment

```
Merge to main
↓
GitHub Actions: Trigger staging deploy
├─ Build Worker
├─ Deploy to videoking-staging.adrper79.workers.dev
├─ Run smoke tests (automated)
│  ├─ GET /health → 200
│  ├─ POST /auth/login → 200
│  ├─ GET /api/videos → 200
│  └─ Database connectivity check
└─ Report results in Slack
↓
If failed: Alert engineers + pause
If passed: Ready for production deployment
```

### Tier 3: Canary Deployment (1%)

```
Engineer: Click "Deploy to Production" (or automatic after 1h in staging)
↓
GitHub Actions:
├─ Build Worker
├─ Deploy to videoking.adrper79.workers.dev (1% traffic)
├─ Monitor Sentry + Datadog for 10 minutes
│  ├─ Error rate > 1%? → Auto-rollback
│  ├─ Latency > 500ms? → Alert (don't auto-rollback)
│  └─ Database errors? → Auto-rollback
└─ Report in Slack: "Canary 1% deployed; monitoring..."
↓
If auto-rollback triggered:
├─ Revert to previous version
├─ Create incident in Slack
└─ Await fix + re-deploy

If monitoring passes (10 min):
└─ Proceed to gradual rollout (Tier 4)
```

### Tier 4: Gradual Rollout (5% → 25% → 100%)

```
Canary healthy (10 min)
↓
Deploy to 5% gradual
├─ Monitor 5 minutes
├─ No errors? → Deploy to 25%
├─ Monitor 5 minutes
└─ No errors? → Deploy to 100%
↓
Total time: 15 minutes (after canary passes)
↓
Final state:
├─ 100% on new version
├─ Health checks green
└─ Ready for manual verification
```

### Tier 5: Manual Verification

```
After 100% rollout:
↓
On-call / release manager:
├─ [ ] curl https://videoking.adrper79.workers.dev/health → Must be 200
├─ [ ] Check Sentry dashboard → No P1 alerts
├─ [ ] Check /admin/metrics → MRR not dropping
├─ [ ] Check DLQ queue → Not backing up
├─ [ ] Slack #incidents: "✅ Release v1.2.3 deployed + verified"
└─ [ ] Monitor for 30 minutes (watch for delayed issues)
↓
If all green:
├─ Release tagged in GitHub
├─ Annotate: "v1.2.3 deployed to production at 2026-04-29 15:30 UTC"
└─ Update #releases channel
↓
If any check fails:
├─ Initiate rollback (see Part 3)
└─ Create incident
```

---

## Part 2: Smoke Test Suite

### Automated Smoke Tests (Run After Each Deployment)

```typescript
// tests/smoke.test.ts
import { test, expect } from 'vitest';

test('Health endpoint', async () => {
  const res = await fetch('https://videoking.adrper79.workers.dev/health');
  expect(res.status).toBe(200);
  
  const data = await res.json();
  expect(data).toHaveProperty('status');
  expect(data.status).toBe('healthy');
  expect(data).toHaveProperty('p95_latency_ms');
  expect(data.p95_latency_ms).toBeLessThan(500);
});

test('Authentication works', async () => {
  const loginRes = await fetch('https://videoking.adrper79.workers.dev/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
  });
  expect(loginRes.status).toBe(200);
  
  const { token } = await loginRes.json();
  expect(token).toBeTruthy();
  
  // Verify token is valid
  const apiRes = await fetch('https://videoking.adrper79.workers.dev/api/videos', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  expect(apiRes.status).toBe(200);
});

test('Database connectivity', async () => {
  const res = await fetch('https://videoking.adrper79.workers.dev/api/creators/me', {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });
  
  // Should not return 503 (connection error)
  expect(res.status).not.toBe(503);
  expect(res.status).not.toBe(500); // DB error would be 500
});

test('Money-moving endpoint responsive', async () => {
  const start = Date.now();
  const res = await fetch('https://videoking.adrper79.workers.dev/api/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TEST_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tier_id: 1, payment_token: 'tok_test' })
  });
  const duration = Date.now() - start;
  
  // Should respond in <2s (even if ultimately fails)
  expect(duration).toBeLessThan(2000);
  
  // Should not return 5xx (service error)
  expect(res.status).not.toMatch(/^5\d\d$/);
});

test('Rate limiter not activated', async () => {
  // Make 10 rapid requests
  const requests = Array.from({ length: 10 }, () =>
    fetch('https://videoking.adrper79.workers.dev/api/videos', {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    })
  );
  
  const responses = await Promise.all(requests);
  
  // None should be 429 (rate limited)
  responses.forEach(res => {
    expect(res.status).not.toBe(429);
  });
});

test('Stream video embedding active', async () => {
  const res = await fetch('https://videoking.adrper79.workers.dev/api/videos/test-id', {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });
  
  const data = await res.json();
  expect(data).toHaveProperty('stream_uid');  // Cloudflare Stream UID
  expect(data.stream_uid).toMatch(/^[a-f0-9]+$/);
});
```

### Manual Verification Checklist

**Post-Deploy (After Automated Tests Pass):**

```markdown
## Release v1.2.3 Verification Checklist

Date: 2026-04-29 15:30 UTC
Version: v1.2.3 (git sha: abc123def456)
Deployed to: Production (100% rollout)

### Health Checks
- [ ] `curl https://videoking.adrper79.workers.dev/health`
  - Status: PASS/FAIL
  - Latency: ___ ms
  - Uptime: ___% (should be >99%)

### Sentry Alerts
- [ ] No P1 alerts in past 30 min
- [ ] Error rate normal (<0.5%)
- [ ] Status: ✅ PASS / ❌ FAIL

### Business Metrics (Factory Admin)
- [ ] MRR unchanged (with ±1% tolerance)
- [ ] Video publication rate normal
- [ ] Creator payout queue healthy
- [ ] Status: ✅ PASS / ❌ FAIL

### User Journeys (Manual Testing)
- [ ] Watch video: Works end-to-end
- [ ] Subscribe: Stripe flow works
- [ ] Creator upload: Upload progresses normally (~10s)
- [ ] Status: ✅ PASS / ❌ FAIL if any fails

### Data Integrity
- [ ] DLQ queue not backing up (< 10 pending)
- [ ] No unexpected audit log entries
- [ ] Subscription count still matches DB
- [ ] Status: ✅ PASS / ❌ FAIL

### Verified By: [Engineer Name]
### Time Verified: [Timestamp]
### Overall Status: ✅ PASSED / ❌ FAILED

If FAILED:
- [ ] Initiate rollback (see Part 3)
- [ ] Create incident in Slack
- [ ] Document root cause
```

---

## Part 3: Rollback Procedure

### When to Rollback

**Automatic Rollback (During Canary):**
- Error rate > 5%
- Latency spike (p95 > 1000ms)
- Database connection errors
- Authentication failures

**Manual Rollback Decision:**
- Incident severity P1 or P2
- Verification checklist fails
- Customer impact confirmed

### Rollback Steps

```bash
#!/usr/bin/env bash
# scripts/rollback.sh

# 1. Verify rollback target
PREVIOUS_VERSION=$(git tag -l | sort -V | tail -2 | head -1)
echo "Rolling back to: $PREVIOUS_VERSION"
read -p "Confirm? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Rollback cancelled."
  exit 1
fi

# 2. Deploy previous version
echo "Deploying $PREVIOUS_VERSION..."
git checkout $PREVIOUS_VERSION
wrangler deploy --env production

# 3. Verify health
echo "Verifying health..."
if curl -s https://videoking.adrper79.workers.dev/health | grep -q '"status":"healthy"'; then
  echo "✅ Rollback successful"
  echo "Previous version: $PREVIOUS_VERSION now live"
else
  echo "❌ Rollback verification failed"
  echo "Contact platform team immediately"
  exit 1
fi

# 4. Notify
echo "Creating Slack notification..."
curl -X POST https://hooks.slack.com/services/... \
  -d "{
    \"text\": \"🔄 Rollback completed: v1.2.3 → $PREVIOUS_VERSION\",
    \"attachments\": [{
      \"color\": \"warning\",
      \"fields\": [{\"title\": \"Reason\", \"value\": \"${ROLLBACK_REASON}\"}]
    }]
  }"
```

**Manual Rollback (Cloudflare Dashboard):**
1. Log into Cloudflare → Workers
2. Click "videoking" worker
3. Go to "Deployments" tab
4. Click "Rollback" on previous version
5. Confirm
6. Wait 30 seconds for effect

**Verify After Rollback:**
```bash
curl https://videoking.adrper79.workers.dev/health
# Should show previous version number in response
```

---

## Part 4: Deployment Decision Tree

```
Code ready for deployment?
├─ NO: Go back to PR reviews / refactor
└─ YES: Continue to staging

Staging deployment success?
├─ NO: Fix issues; redeploy staging
└─ YES: Continue to canary

Deploy canary (1% of prod traffic)?
├─ Monitor 10 minutes
│  ├─ Error rate > 1%? → AUTO-ROLLBACK
│  └─ Latency spike? → ALERT (manual review)
├─ ROLLBACK TRIGGERED: Fix issue; re-test staging; re-deploy to canary
└─ CANARY HEALTHY: Continue to gradual rollout

Gradual rollout (5% → 25% → 100%)?
├─ Monitor during rollout
│  ├─ Errors appear? → HALT; investigate
│  └─ Normal? → Continue rollout
├─ HALT: Diagnostic; consider rollback
└─ 100% DEPLOYED: Proceed to manual verification

Manual verification (health checks)?
├─ FAIL: Rollback immediately
└─ PASS: Release approved + tag created

Final state:
✅ Deployed to production
✅ Verified + healthy
✅ Ready for monitoring (30 min post-release watch)
```

---

## Part 5: Release Coordination

### Weekly Release Schedule

**Every Monday 14:00 UTC:**
- Collect merged PRs from past week
- Prepare release notes
- Verify staging deployment
- Canary deploy at 14:30
- Gradual rollout at 14:45
- Manual verification at 15:05

**Out-of-Cycle Hotfixes:**
- If P1 incident requires immediate fix
- Follow same release pipeline (5 min expedited)
- Skip weekly cycle; deploy ASAP

### Slack #releases Channel

```
📦 Release v1.2.3 started (2026-04-29 14:30)
├─ Changes: 3 PRs merged
│  ├─ fix(payments): implement Stripe rate limiting
│  ├─ feat(observability): add correlation IDs
│  └─ chore(deps): update hono to 4.3.1
├─ Deployed to: staging →canary (1%) → ...
├─ Status: ✅ Canary healthy (10 min monitoring complete)
│  ├─ Error rate: 0.18% (✅ normal)
│  ├─ Latency p95: 145ms (✅ normal)
│  └─ Ready for rollout
└─ Next: Gradual rollout 5% → 25% → 100%

🚀 Release v1.2.3 complete (2026-04-29 15:15)
├─ Status: ✅ Deployed + verified
├─ Verification: ✅ All checks passed
├─ Uptime: 99.92% (normal)
├─ MRR: $112.4K (±0.2% vs previous)
└─ Watch period: 30 min monitoring (until 15:45)

🔴 Release v1.2.3 FAILED (if applicable)
├─ Status: ❌ Rolled back
├─ Previous version: v1.2.2
├─ Reason: Auth service 403 errors (canary 1%)
├─ Rolled back at: 14:45
└─ Incident created: #incidents thread
```

---

## Part 6: Release Readiness Checklist

**Before Each Release (Engineering Lead):**

```markdown
## Release v[X.Y.Z] Readiness

### Prerequisites
- [ ] All PRs merger to main reviewed + approved
- [ ] No open critical issues (P1/P2) in Sentry
- [ ] Staging deployment successful + all smoke tests pass
- [ ] Database migrations applied + tested
- [ ] Secrets verified in wrangler.jsonc (no additions needed)

### Communication
- [ ] Release notes drafted in Slack
- [ ] Stakeholders notified (product, ops)
- [ ] Postmortem scheduled for any recent fixes

### Deployment
- [ ] Canary deployment prepared (1% traffic ready)
- [ ] Monitoring dashboards open (Sentry, Datadog)
- [ ] Rollback procedure reviewed + ready
- [ ] On-call ready to respond if incidents occur

### Sign-Off
- [ ] Tech lead: Ready to deploy ✅/❌
- [ ] Product: Aware of changes ✅/❌
- [ ] Ops: Health check procedures verified ✅/❌

**Approved by:** [Name] at [Timestamp]
**Go/No-Go Decision:** GO ✅ / NO-GO ❌
```

---

## Part 7: Exit Criteria (T6.3)

- [x] Release pipeline architecture documented (tiers 0–5)
- [x] Staging → Canary → Rollout flows defined
- [x] Smoke test suite created (7 automated tests)
- [x] Manual verification checklist provided
- [x] Rollback procedure (automatic + manual)
- [x] Decision tree for deployment
- [x] Slack release coordination channel template
- [x] Weekly release schedule defined
- [ ] GitHub Actions workflows implemented (May 1)
- [ ] First release via new pipeline (May 8)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Platform Lead | T6.3 release train framework; staging/canary/prod flows; smoke tests; rollback |

---

**Status:** ✅ T6.3 RELEASE TRAIN DESIGN READY  
**Next Action:** Implement GitHub Actions workflows (May 1); conduct first release via new pipeline (May 8)

**Helpful Links:**
- [Sentry Alerts Setup](../docs/runbooks/slo.md)
- [Cloudflare Deployments Docs](https://developers.cloudflare.com/workers/ci-cd/deployments/)
- [Previous Release Postmortems](../releases/)
