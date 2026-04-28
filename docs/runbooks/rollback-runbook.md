---
title: Rollback Runbook
description: Fast procedures for rolling back bad deployments, database changes, and feature flags.
---

# Rollback Runbook

**Last Updated:** April 28, 2026  
**Phase:** Phase D (T5.3)  
**Owner:** Ops team + Tech leads

## Quick Reference

| Scenario | Action | Target Time |
|----------|--------|-------------|
| Bad Worker deploy | `wrangler rollback` | <5 min |
| Bad database schema | Restore from backup to point-in-time | <10 min |
| Feature flag enabled bad behavior | Flip flag off | <1 min |
| Stripe integration broken | Route through backup provider or fail gracefully | <5 min |
| Memory leak in production | Downscale + force restart compute | <3 min |

---

## Worker Rollback (CloudFlare)

### When to Rollback

- **Immediate:** Error rate >5% in first 2 minutes after deploy
- **Immediate:** P1 incident directly linked to recent deploy
- **Optional:** Error rate increasing steadily (but not immediate crisis)

### Procedure

1. **Get previous version:**
   ```bash
   cd apps/{app-name}
   git log --oneline -5  # Find commit before bad deploy
   git show {prev-commit-sha}:wrangler.jsonc  # Verify routes are correct
   ```

2. **Check CloudFlare Deployments UI** (faster than git):
   - Dashboard → Workers & Pages → {app-name} → Deployments
   - Find green checkmark (stable version before current red)
   - Note the timestamp + git SHA

3. **Trigger rollback:**
   ```bash
   cd apps/{app-name}
   wrangler rollback --message "Rollback due to P1 incident: [description]"
   # Follow prompts to select previous version
   ```

4. **Verify immediately:**
   ```bash
   curl https://{app}.adrper79.workers.dev/health
   # Should return 200 with green status
   ```

5. **Monitor for 5 minutes:**
   - Check Sentry error rate (should drop to baseline)
   - Check CloudFlare analytics (latency, requests should normalize)
   - Declare in incident channel: "✅ Rollback successful"

6. **Post-incident:** Understand what broke
   - Run full test suite against rolled-back version
   - Identify bug in code that caused P1
   - Create GitHub issue with `priority:blocking` label

---

## Database Rollback (Neon)

### When to Rollback Database

- **Immediate:** Failed migration left DB in inconsistent state
- **Immediate:** Data corruption detected (e.g., all balances set to 0)
- **Optional:** Performance regression (slow queries after migration)

### Procedure

1. **Stop deployments immediately:**
   - No new code should touch the database
   - Communicate to team: "Database rollback in progress; hold new deployments"

2. **Assess damage:**
   ```sql
   -- How many rows affected?
   SELECT COUNT(*) FROM {table} WHERE updated_at > now() - interval '30 min';
   
   -- Any referential integrity errors?
   SELECT * FROM pg_constraint WHERE conname LIKE '%_fk%';
   ```

3. **Determine rollback window:**
   - Neon allows point-in-time restore up to 7 days ago
   - Use the branch system: Create new branch from parent at `{time}`, test, promote to main

4. **Create restore branch in Neon:**
   ```bash
   neon branch create --parent main --name restore-{timestamp} \
     --restore-from-lsn {target-lsn-if-known}
   # Or via CloudFlare Hyperdrive: re-point connection string to new branch
   ```

5. **Test restore on staging:**
   - Update `.dev.vars` to use new branch connection string
   - Run test suite: `npm test`
   - Verify critical queries work: `SELECT * FROM users LIMIT 10`
   - Check data integrity: counts, balances, relationships

6. **Promote restore to main:**
   - Once verified, promote branch to `main` via Neon dashboard
   - Update app connection string (if changed)
   - Redeploy app to pick up restored data

7. **Verify production:**
   - Health check `/health`
   - Sample critical queries: `SELECT COUNT(*) FROM users`
   - Monitor for data inconsistencies over next hour

8. **Cleanup:**
   - Delete old main branch (if preserved)
   - Keep restore branch for 24 hours (in case we need to pivot again)
   - Document: what was rolled back, why, impact

---

## Feature Flag Rollback

### When to Rollback Flag

- **Immediate:** Feature flag enabled feature with bugs
- **Immediate:** Feature flag caused P1 or P2 incident

### Procedure

1. **Disable flag immediately:**
   ```bash
   # If using PostHog feature flags:
   curl -X PATCH https://api.posthog.com/api/feature_flags/{flag-id}/ \
     -H "Authorization: Bearer $POSTHOG_API_KEY" \
     -d '{"active": false}'
   
   # If using environment variable:
   wrangler secret put FEATURE_FLAG_NEW_FEATURE --secret "false"
   wrangler publish
   ```

2. **Verify from client:**
   - New feature should be hidden (existing UI grayed out or hidden)
   - Old behavior should resume
   - No errors in browser console

3. **Monitor error rate:**
   - Should drop within 2 minutes if flag was the culprit
   - If error rate doesn't drop, flag wasn't the root cause; investigate further

4. **Post-incident review:**
   - What was the bug?
   - Did pre-staging tests miss it? (improve test coverage)
   - When safe, re-enable with fix + longer staging period

---

## Partial Rollback (Code + Database Sync)

If code and database versions must match, use this procedure:

1. **Identify safe point:**
   - What's the most recent config that was working?
   - App version X.Y + Database schema V3?

2. **Create compatibility layer (if available):**
   - New app code can read old schema format?
   - Or old app code can read new schema format?
   - If yes, use that to stagger rollback

3. **Rollback in order:**
   - If dropping a column, first deploy code that doesn't use it, then drop column
   - If renaming a column, use database view as alias during transition
   - If adding required column, add nullable first, then deploy app, then add constraint

4. **Verify both layers:**
   - Test app + database together on staging branch first
   - Then rollback production database
   - Then rollback production code
   - Monitor migrations/deployment logs for errors

---

## Rollback Decision Tree

```
Did a deploy happen <10 min before the incident?
├─ YES
│  ├─ Is error specific to new code? (Check stack trace in logs)
│  │  ├─ YES → Rollback Worker immediately (5 min window)
│  │  └─ NO → Skip rollback; investigate infrastructure
│  └─ NO
│     └─ Continue investigation (rollback not applicable)
├─ NO
│  ├─ Did a database migration run?
│  │  ├─ YES
│  │  │  ├─ Did migration fail to apply correctly? (Check migration logs)
│  │  │  │  ├─ YES → Rollback database (test on branch first)
│  │  │  │  └─ NO → Investigate query performance / schema issue
│  │  │  └─ NO → Not a rollback issue
│  │  └─ Did a feature flag change?
│  │     ├─ YES → Disable flag immediately (1 min)
│  │     └─ NO → Not a rollback scenario; escalate to incident response
│  └─ NO → Not a rollback scenario
```

---

## Post-Rollback Steps

1. **Incident channel post:**
   ```
   ✅ Rollback completed [timestamp]
   Reverted: [Worker version | Database snapshot | Feature flag]
   Error rate: [X%] → [Y%] (decrease expected)
   Status page: Update to "Recovered"
   ```

2. **Root cause analysis** (within 24 hours):
   - Why did the change break?
   - Did tests pass but miss this scenario?
   - Create GitHub issue with priority
   - Schedule follow-up PR with fix

3. **Prevent recurrence:**
   - Add test case for this scenario
   - Add pre-deployment check (e.g., syntax check, schema validation)
   - Update deployment checklist if new risk surfaced

4. **Learn:**
   - Bring to retrospective
   - Share with team: "This is why we test {thing}"
   - Update this runbook if process was unclear

---

## Rollback Permissions

Who can trigger rollback?

- **Worker rollback:** Any engineer with CloudFlare access + git commit access
- **Database rollback:** Tech lead or ops engineer (requires Neon access)
- **Feature flag rollback:** Any engineer with PostHog access
- **Emergency override:** On-call can declare rollback; ops executes

On-call should be trained and have credentials cached in dashboard for emergency access.

---

## Recovery After Rollback

After successful rollback, follow this order:

1. **Stabilize:** Monitor error rate, latency, user activities for 15 minutes
2. **Communicate:** "We've reverted the change; investigating root cause"
3. **Notify stakeholders:** Product lead, finance, customer success
4. **Test:** Before re-deploying fix, ensure staging tests pass
5. **Deploy fix:** Slower, more careful rollout (canary if >5% code change)

---

## Runbook Links

- [Incident Response Playbook](incident-response-playbook.md) — When to trigger rollback
- [Deployment](deployment.md) — How deployments work; understand to rollback faster
- [Database & Migrations](database.md) — Neon migration strategies
- [Postmortem Template](../templates/POSTMORTEM_TEMPLATE.md) — Post-incident review

---

## Emergency Contacts

- **Neon support:** support@neon.com (for data recovery)
- **CloudFlare dashboard:** https://dash.cloudflare.com/
- **PostHog:** https://posthog.com/support
- **On-call:** Check PagerDuty on-call schedule
