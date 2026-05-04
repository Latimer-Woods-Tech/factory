# T6.3 — Release Train & Automated Deployment Verification

**Last Updated:** April 28, 2026  
**Phase:** Phase 4 (Deployment Procedures Ready)  
**Owner:** DevOps / Ops Lead  
**Status:** Full release procedure documented; canary testing ready

---

## Overview

T6.3 ensures **zero-downtime production deployments** via a 5-phase release train:

1. **Feature Freeze** — Stop new commits; prepare release candidate
2. **Staging Deployment** — Deploy to staging, run full E2E tests
3. **Staging Review** — QA + security + ops team final approval
4. **Canary Deployment** — Deploy to 10% of prod workers, monitor for 30 min
5. **Production Deployment** — Roll out to 100% when canary succeeds
6. **Post-Release Validation** — Verify metrics + customer feedback

---

## Release Procedure

### Phase 1: Feature Freeze (T-2 Business Days)

**Goal:** Prepare a stable release candidate

**Actions:**
```bash
# 1. Create release branch from main
git checkout main
git pull origin
git checkout -b release/v2.5.1

# 2. Update version
npm version minor  # or major/patch, depending on commits
# Outputs: v2.5.1

# 3. Generate changelog (auto from commits since last tag)
git log v2.5.0..HEAD --oneline > /tmp/commits.txt
# Manually curate into CHANGELOG.md

# 4. Commit + push
git add CHANGELOG.md package.json package-lock.json
git commit -m "chore(release): v2.5.1"
git push origin release/v2.5.1

# 5. Open PR for review
gh pr create \
  --title "Release: v2.5.1" \
  --body "See CHANGELOG.md for details" \
  --label release \
  --base main \
  --head release/v2.5.1
```

**Checklist:**
- [ ] All integration tests pass locally
- [ ] No high-priority bugs in this release
- [ ] Security audit passed (if changes touch auth/payments)
- [ ] Performance benchmarks met (E.g., P99 latency still <500ms)
- [ ] Changelog explains what's new + breaking changes (if any)

---

### Phase 2: Staging Deployment (T-1 Day)

**Goal:** Test release in production-like environment

**Actions:**
```bash
# 1. Merge release PR to main
gh pr merge --squash  # Use squash to keep history clean

# 2. Tag the release
git tag v2.5.1
git push origin v2.5.1

# 3. Deploy to staging
wrangler deploy --env staging --location ./dist/worker.js

# 4. Run E2E tests against staging
npm run test:e2e -- --target staging

# 5. Verify via curl
curl https://videoking-staging.adrper79.workers.dev/health  \
  -H "Authorization: Bearer ${TEST_TOKEN}"
# Expected: 200 OK + { status: "operational" }

# 6. Smoke tests (automated)
# - Create video + transcode (full flow)
# - Process payout batch
# - Generate revenue report
# Run ~/scripts/smoke-test.sh --env staging
```

**Expected Results:**
```
✅ All E2E tests pass (>9000 assertions)
✅ Health check returns 200
✅ Videos transcode in <5 minutes
✅ Payouts process without errors
✅ No new errors in Sentry
✅ Response times stable (P99 <500ms)
```

**If any fail:**
```
1. Diagnose (read cloudflare logs, Sentry errors)
2. Fix in main branch (git commit new fix)
3. Retag: git tag -d v2.5.1; git push origin :refs/tags/v2.5.1; git tag v2.5.1; git push origin v2.5.1
4. Redeploy to staging (repeat Phase 2)
```

---

### Phase 3: Staging Review (T-0.5 Days)

**Goal:** Team approves release; no surprises when it hits production

**Participants:**
- QA Lead (run exploratory tests)
- Security Lead (check security checklist)
- Ops Lead (review runbook + rollback plan)
- Product Lead (verify features work as designed)

**Review Meeting (30 min):**

```
Moderator: DevOps Lead

1. Demo (10 min): "Here's what changed in v2.5.1"
   - Show 3-5 user-facing changes
   - Show metrics impact (if any)

2. QA Report (5 min): "Staging has been stable; found 0 issues"

3. Security Sign-off (5 min): "Audit passed; no holes"

4. Ops Sign-off (5 min): "Rollback plan verified; we can revert in <5 min"

5. Vote (2 min): "Thumbs up to deploy canary?"
   - All 4 leads, yes = GO
   - Any lead, no = STOP (fix + redeploy to staging)

6. Next Release Timeline (3 min):
   - Canary: Tomorrow 2:00 PM UTC
   - Production (if canary passes): Tomorrow 4:00 PM UTC
```

**If any lead says NO:**
- Issue is documented
- Decision: Fix before release or defer to next release cycle
- If fix: go back to Phase 1 (new RC); if defer: v2.5.1 cancelled

---

### Phase 4: Canary Deployment (T+1 Day, 2:00 PM UTC)

**Goal:** Deploy to 10% of production workers for 30 minutes; watch for errors

**Setup:**
```bash
# 1. Open #release Slack channel
@channel Release v2.5.1 canary start at 2:00 PM UTC
Target: 10% of videoking workers
Duration: 30 minutes
Monitoring: Sentry (errors) + PostHog (events) + Cloudflare (latency)

# 2. Enable traffic split (Cloudflare)
# Send 10% to new worker version, 90% to current version
curl -X PUT https://api.cloudflare.com/client/v4/accounts/{ID}/workers/deployments \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d '{
    "strategy": "canary",
    "percentage": 10,
    "new_version": "v2.5.1",
    "old_version": "v2.5.0"
  }'

# 3. Monitor continuously (30 min)
# Watch Sentry for new errors
# Watch PostHog for user flows
# Watch Cloudflare for increased latency
```

**Automated Monitoring:**

Script: `scripts/monitor-canary.sh`

```bash
#!/bin/bash
DURATION_MAX=1800  # 30 minutes
SAMPLE_INTERVAL=60  # Every min
ERROR_THRESHOLD=5  # Alert if >5% errors
LATENCY_THRESHOLD=750  # Alert if P99 > 750ms

start_time=$(date +%s)

while true; do
  now=$(date +%s)
  elapsed=$((now - start_time))
  
  if [[ $elapsed -gt $DURATION_MAX ]]; then
    echo "✅ Canary period complete (30 min)"
    break
  fi
  
  # Check error rate
  error_rate=$(curl -s https://api.sentry.io/api/0/projects/.../stats/ \
    --header "Authorization: Bearer ${SENTRY_TOKEN}" | \
    jq '.data[0][1].sum_values')
  
  if (( $(echo "$error_rate > $ERROR_THRESHOLD" | bc -l) )); then
    echo "⚠️  ERROR: Error rate spike: ${error_rate}%"
    echo "🔄 Initiating rollback"
    ./rollback-canary.sh
    break
  fi
  
  # Check latency
  latency=$(curl -s https://videoking.adrper79.workers.dev/metrics \
    -H "Authorization: Bearer ${MEASUREMENT_TOKEN}" | \
    jq '.latency.p99_latency_ms')
  
  if (( latency > LATENCY_THRESHOLD )); then
    echo "⚠️  WARNING: Latency spike: ${latency}ms (threshold: ${LATENCY_THRESHOLD}ms)"
  fi
  
  # Summary every 5 min
  if (( elapsed % 300 == 0 )); then
    echo "📊 Canary status after ${elapsed}s:"
    echo "   Error rate: ${error_rate}% (threshold: ${ERROR_THRESHOLD}%)"
    echo "   P99 latency: ${latency}ms (threshold: ${LATENCY_THRESHOLD}ms)"
    echo "   Traffic: 10% → v2.5.1 | 90% → v2.5.0"
  fi
  
  sleep $SAMPLE_INTERVAL
done
```

**Success Criteria:**
```
✅ Error rate stays <5%
✅ P99 latency stays <750ms
✅ No new Sentry error clusters
✅ User events flowing normally
```

**If canary FAILS (any criterion violated):**

```bash
# Automatic rollback
curl -X PUT https://api.cloudflare.com/client/v4/accounts/{ID}/workers/deployments \
  -d '{ "strategy": "canary", "percentage": 0, "new_version": "v2.5.1" }'
# Now: 100% on v2.5.0, canary killed

# Notify team
@channel Canary FAILED. Rolled back to v2.5.0.
Error rate spiked to 8%.
Incident report: [link]

# Create incident (see T5.3 procedures)
```

---

### Phase 5: Production Rollout (T+1 Day, 4:00 PM UTC)

**Goal:** If canary passed, roll out v2.5.1 to 100% of prod workers

**Prerequisites:**
- Canary ran for 30 min with no issues ✅
- All 4 leads gave approval ✅
- Team is ready (on call, monitoring systems up)

**Actions:**
```bash
# 1. Final health check
curl https://videoking.adrper79.workers.dev/health \
  -H "Authorization: Bearer ${TEST_TOKEN}"
# Expected: 200 OK

# 2. Update traffic split to 100%
curl -X PUT https://api.cloudflare.com/client/v4/accounts/{ID}/workers/deployments \
  -d '{
    "strategy": "canary",
    "percentage": 100,
    "new_version": "v2.5.1"
  }'

# 3. Announce in Slack
@channel Production rollout v2.5.1 in progress (4:00 PM UTC)
Canary completed successfully ✅
Expected impact: None (if canary was good, prod will be too)
Will monitor for 1 hour post-deploy

# 4. Monitor for 1 hour
# Same checks as canary; alert if anything degrades
```

**Post-Deployment Monitoring (1 Hour):**

Key Metrics:
| Metric | Threshold | Current |
|--------|-----------|---------|
| Error Rate | <5% | 0.02% ✅ |
| P99 Latency | <500ms | 245ms ✅ |
| Health | operational | ✅ |
| Stripe Webhook Success | >99% | 99.98% ✅ |
| Video Processing Queue | <500 pending | 120 ✅ |
| Payout Batch Processing | No failures | 0 ✅ |

**If all green after 1 hour:**
```
✅ Release v2.5.1 complete!
Deployed at 4:00 PM UTC
All systems nominal
Rollback plan: Ready if needed (less than 5 min)
```

---

### Phase 6: Post-Release (T+2 Days)

**Actions:**
1. **Verify customer impact** — Any support tickets about new version?
2. **Check metrics** — Did we improve what we intended?
3. **Update docs** — README, CHANGELOG, deployment runbooks
4. **Schedule retro** (if any issues found)
5. **Archive release artifacts** — Tag + document what was deployed

---

## Rollback Procedure

**If production has critical issue after deployment:**

```bash
# 1. Declare rollback
curl -X PUT https://api.cloudflare.com/client/v4/accounts/{ID}/workers/versions \
  -d '{ "current": "v2.5.0" }'
# Immediate: All traffic back to v2.5.0

# 2. Verify
curl https://videoking.adrper79.workers.dev/health
# Should return 200 with v2.5.0 in response

# 3. Communicate
@channel ROLLBACK COMPLETE
Version reverted to v2.5.0
All systems operational
Incident report: [link]
```

**Rollback time:** <2 minutes (Cloudflare edge caching + instant version switch)

---

## Deployment Checklist

**Before each release:**

### Pre-Release (T-2 Days)
- [ ] All commits for this release reviewed + merged
- [ ] Feature branch deleted
- [ ] Release notes written (CHANGELOG.md)
- [ ] Version bumped (package.json)
- [ ] Build succeeds locally: `npm run build`
- [ ] Tests pass locally: `npm test`
- [ ] No TypeScript errors: `npm run typecheck`

### Staging (T-1 Day)
- [ ] Deployed to staging
- [ ] E2E tests pass: `npm run test:e2e -- --target staging`
- [ ] Smoke tests pass: `./scripts/smoke-test.sh --env staging`
- [ ] No new Sentry errors
- [ ] Performance metrics stable (P99 <500ms)
- [ ] All 4 leads reviewed + approved

### Canary (T+1 Day, 2:00 PM UTC)
- [ ] Canary deployed (10% traffic)
- [ ] Monitor script running: `./scripts/monitor-canary.sh`
- [ ] #release channel active (Slack updates every 5 min)
- [ ] Error rate <5%
- [ ] Latency P99 <750ms
- [ ] No rollback triggered

### Production (T+1 Day, 4:00 PM UTC)
- [ ] Canary completed successfully ✅
- [ ] Production rollout authorized + started
- [ ] Health checks passing (every 30 sec for 1 hour)
- [ ] Customer support monitoring (no escalations)
- [ ] Metrics dashboard showing stable performance
- [ ] Rollback procedure tested + ready

---

## Automated Release Calendar

**File:** `scripts/release-calendar.yml`

```yaml
releases:
  - version: v2.5.1
    status: scheduled
    staging_date: 2026-05-02
    staging_time: 10:00Z
    review_date: 2026-05-02
    review_time: 14:00Z
    canary_date: 2026-05-03
    canary_time: 14:00Z
    production_date: 2026-05-03
    production_time: 16:00Z
    owner: DevOps Lead
    
  - version: v2.6.0
    status: planned
    staging_date: 2026-05-16
    # ... etc
```

---

## Exit Criteria

**T6.3 is complete when:**

✅ Full 5-phase release procedure documented + tested  
✅ Canary traffic split implemented + working in staging  
✅ Monitoring scripts automated + verified  
✅ Rollback procedure <5 minutes + verified  
✅ Team trained on release roles + procedures  
✅ 3 successful test deployments (to staging + canary + production)  
✅ Post-release verification checklist created

---

## Related Docs

- [Release Procedure](docs/runbooks/release-procedure.md) — Full runbook
- [Rollback Runbook](docs/runbooks/rollback-runbook.md) — Emergency procedures
- [Incident Response Playbook](docs/runbooks/incident-response-playbook.md) — If deployment fails
- [IMPLEMENTATION_SCORECARD.md](../IMPLEMENTATION_SCORECARD.md) — Phase D status
