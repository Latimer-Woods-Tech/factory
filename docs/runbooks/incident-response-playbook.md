---
title: Incident Response Playbook
description: Step-by-step procedures for detecting, triaging, mitigating, and recovering from production incidents.
---

# Incident Response Playbook

**Last Updated:** April 28, 2026  
**Phase:** Phase D (T5.3)  
**Owner:** Ops team + On-call + Tech leads

## Severity Levels

### P1 — Critical

**Definition:** Revenue down, authentication broken, or >5% of users unable to use core feature.

**Examples:**
- Payment processing down (no new subscriptions)
- Login/auth system broken
- Core content delivery failing (videos not loading)
- Database down or unreachable

**Targets:**
- **Detect:** <5 minutes
- **Mitigate:** <15 minutes
- **Resolve:** <1 hour
- **Communication:** Notify customer + investors within 15 min

**Triggers:**
- Alert fires in Sentry: "Error rate >5% for 2+ minutes"
- Health check: `/health` returns non-200 for >1 minute
- OnCall dashboard: System triggered P1 incident

---

### P2 — High

**Definition:** Feature degraded but alternative path exists, or <5% of users affected.

**Examples:**
- Video transcoding queue slow (videos take 2x longer)
- Payout processing delayed but queued
- Analytics dashboard slow (but not broken)
- Email delivery delayed (24h target still met)

**Targets:**
- **Detect:** <15 minutes
- **Mitigate:** <1 hour
- **Resolve:** <4 hours
- **Communication:** Notify team; customer notification optional unless >1 hour

**Triggers:**
- Alert fires: "Error rate >2% for 5+ minutes" OR "p99 latency >5s"
- Manual escalation from customer support
- Health check degraded but not critical

---

### P3 — Low

**Definition:** Minor cosmetic issue or soft feature regression with workaround.

**Examples:**
- UI glitch (button color wrong)
- Sorting/filtering slow (but works)
- Non-critical third-party integration delayed (Slack notifications)
- Typo in error message

**Targets:**
- **Detect:** <1 day
- **Mitigate:** Next business day
- **Resolve:** <1 week via normal sprint cadence
- **Communication:** Add to backlog; no urgent notification

**Triggers:**
- Manual bug report from user
- QA during testing
- Sentry error rate <0.1%

---

## Immediate Actions (First 5 Minutes)

### For P1 Incidents

1. **Page on-call:** Use PagerDuty (or equivalent)
   - Auto-page primary tech lead + ops
   - Page secondary after 5 min if no ack
   - Page director if no progress after 15 min

2. **Establish incident channel:**
   - Slack: Create `#incident-{timestamp}` (e.g., `#incident-2026-04-28-1422`)
   - Copy link to PagerDuty alert
   - Invite: observability owner, tech lead, product lead, customer success

3. **Gather initial data (2 min):**
   - What is broken? (check `/health` endpoint)
   - When did it start? (check Sentry / CloudWatch / Datadog timestamp)
   - How many users affected? (check active session count + error spike magnitude)
   - Any recent deployments? (check CloudFlare deployment log or git log)

4. **Assess rollback need (3 min):**
   - If broken <5 min after deploy, consider **immediate rollback** (see Rollback Runbook)
   - If broken from non-code cause (database, third-party API, infra), diagnose first

5. **Communicate status:**
   - Post to incident channel: "P1 incident: [service] down since [time], [N] users affected, investigating"
   - Update status page: "Investigating: [service] slow/unavailable"
   - Notify customer success lead: "We're aware and working on it"

---

### For P2 Incidents

1. **Page secondary on-call (if deployed last 30 min) or tech lead**
2. **Create Slack channel** (same as P1 pattern)
3. **Gather initial data** (same as P1, but can take 10 min)
4. **Post to channel:** Severity, impact, ETA

---

### For P3 Incidents

1. **File GitHub issue** with label `priority:low`
2. **Post in team Slack** (not incident channel)
3. **Add to next sprint backlog**

---

## Triage Script (First 15 Minutes)

Use this decision tree to diagnose root cause:

```
Is the error in logs (Sentry / CloudWatch)?
├─ YES → Go to "Logs-Based Diagnosis" below
└─ NO → Go to "Infrastructure Diagnosis" below

=== LOGS-BASED DIAGNOSIS ===
Q1: Error type?
├─ "Database connection failed" → Database down
├─ "Timeout connecting to X.adrper79.workers.dev" → Service X is down
├─ "502 Bad Gateway" → Cloudflare / ingress issue
├─ "Stripe API error: 503" → Third-party API down
├─ "Memory exceeded" → Out of memory (scale compute)
├─ "CORS error" → Frontend/backend mismatch or deployment rollback issue
├─ "JWT validation failed" → Auth secret mismatch or rotation issue
└─ Other → Go to logs; search for causality chain

Q2: Did this start after a deploy?
├─ YES (within 5 min) → Rollback immediately (see Rollback Runbook)
└─ NO → Continue investigation

Q3: What's the error rate now vs 30 min ago?
├─ Increasing (spike) → Likely recent deploy or configuration change
├─ Steady/flat → Likely external dependency or database issue
└─ Decreasing → Already recovering; monitor

=== INFRASTRUCTURE DIAGNOSIS ===
Q1: Check CloudFlare region status (https://www.cloudflarestatus.com)
├─ Issue reported → Wait for CloudFlare team; monitor our error rate
└─ No issue → Continue

Q2: Check Neon cluster (https://console.neon.tech/app/admin/project)
├─ Red alert → Database is down; contact Neon support
└─ Green → Continue

Q3: Check Durable Objects (CloudFlare Dashboard → Workers → Durable Objects)
├─ High checkpoint latency → Likely overload; consider scaling out
└─ Healthy → Continue

Q4: Check API logs by service (CloudWatch / Datadog)
├─ videoking service errors spiking → Tech lead for videoking
├─ database queries slow (p99 >2s) → Check query load; might need indexing
└─ External dependency slow (Stripe, Telnyx) → Wait or failover

Q5: Are we under attack? (Check rate limiter stats)
├─ YES (100k+ requests from <10 IPs) → Trigger DDoS mitigation
└─ NO → Continue

=== IF STILL UNKNOWN ===
1. Declare "root cause unknown" in incident channel
2. Look at recent changes: git log –since="30 min ago"
3. Check team Slack: Did anyone deploy or change config?
4. If all else fails, involve platform lead + do incident review after recovery
```

---

## Service-Specific Diagnostics

### Database Down

**Check:**
```sql
SELECT now(); -- If returns nothing or times out, DB is down
SELECT count(*) FROM pg_stat_activity; -- Active connections
```

**Mitigation:**
1. Is it scheduled maintenance? Check Neon billing page
2. Try failover to read replica
3. Check CloudFlare Hyperdrive logs (monitoring bucket)
4. Contact Neon support; check status page

---

### Third-Party API Down (Stripe, Telnyx, etc.)

**Check:**
- Visit service status page (stripe.com/status, etc.)
- Try API call manually: `curl -X GET https://api.stripe.com/v1/ping`

**Mitigation:**
1. If non-critical path: route around (fail gracefully, don't crash)
2. If critical: P1 escalation; contact service provider
3. Consider fallback provider if available (e.g., Stripe → Square for payments)

---

### Memory / CPU Overload

**Check:**
```
CloudFlare Workers dashboard → Metrics
Look for: CPU time, wall time, duration
If CPU/wall time at 50ms limit consistently → Overloaded
```

**Mitigation:**
1. Temporary: Reduce traffic via rate limiting
2. Medium-term: Optimize hot code path (profile with CloudFlare)
3. Long-term: Upgrade Worker tier or refactor to Durable Objects

---

## Escalation

| Situation | Action | Condition |
|-----------|--------|-----------|
| No progress after 15 min (P1) | Page Tech Director | Currently paged tech lead is not responding |
| No progress after 30 min (P1) | Page CEO | Director + tech lead not responding |
| Database down | Page Neon support | We can't recover within 30 min |
| Third-party API down | Page service provider | We can't workaround; critical feature blocked |
| Under attack | Activate DDoS plan | >100k requests/min from <50 unique IPs |
| Data corruption suspected | Declare data incident | Trigger immediate backup restore test |

---

## Communication

### To Customers (via Status Page + Email)

**Format:**

```
🔴 [Service] Unavailable
Started: 2026-04-28 14:22 UTC
Status: Mitigating

We're experiencing issues with [service]. 
Impact: [% users affected]
What we're doing: [specific action]
ETA: [25 minutes]

We'll update every 15 minutes.
```

**Timeline:**
- Detect → Post "Investigating" within 5 min
- Mitigate → Post "Identified, mitigating" within 20 min
- Resolve → Post "Resolved" + brief incident summary
- Post-incident → Post full RCA + action items within 48 hours

### To Team (Slack Template)

```
🚨 P1 INCIDENT: [Service] [Status]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
What: [Brief description + impact]
When: [Detected at HH:MM UTC]
Who: [On-call + responders]
Status: [Investigating | Mitigating | Resolved]
Recent changes: [If any deploy/config change]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next update: [Time + 5 min]
Slack channel: #incident-YYYY-MM-DD-HHMM
```

---

## Resolution vs. Recovery

**Resolution:** Issue is fixed (root cause addressed or rollback complete)  
**Recovery:** All systems back to normal (caches cleared, load balanced, metrics normalized)

- **P1:** Must be resolved <60 min; recovery <90 min
- **P2:** Must be resolved <4 hours; recovery <5 hours
- **P3:** No time target (next sprint okay)

Post-resolution, someone must declare resolution in incident channel + on status page:

```
✅ RESOLVED at 14:47 UTC
Root cause: [Stripe API was down]
Fix: [Routed around to Square during Stripe downtime]
RCA will follow within 24 hours.
```

---

## Documentation

**During the incident:**
- Incident channel Slack messages are searchable; don't delete
- Copy key diagnostics to `INCIDENT_LOG.json` (Sentry integration)

**After the incident (within 24 hours):**
- Create postmortem (see [Postmortem Template](../templates/POSTMORTEM_TEMPLATE.md))
- Fill in: what happened, impact, root cause, action items
- Hold sync with on-call, tech lead, product lead (see [Postmortem Sync Agenda](../runbooks/postmortem-sync-agenda.md))

---

## Training & Drills

- **Monthly:** On-call re-training (read this playbook)
- **Quarterly:** Incident simulation drill (practice rollback, comms, escalation)
- **Post-incident:** Team retrospective (captured learnings from real incidents)

---

## Runbook Links

- [Rollback Runbook](rollback-runbook.md) — How to revert a bad deploy quickly
- [Postmortem Template](../templates/POSTMORTEM_TEMPLATE.md) — Post-incident review structure
- [Postmortem Sync Agenda](postmortem-sync-agenda.md) — Meeting to discuss action items
- [Deployment](deployment.md) — How deployments happen (understand to troubleshoot better)

---

## Related Docs

- [SLO Framework](slo-framework.md) — SLO definitions + error budget
- [Error Budget Policy](error-budget-policy.md) — When to freeze features due to errors
