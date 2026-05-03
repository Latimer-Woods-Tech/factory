# T5.3 — Incident Response & Drill Execution Checklist

**Last Updated:** April 28, 2026  
**Phase:** Phase 4 (Ready for Drills)  
**Owner:** Ops Lead  
**Status:** Playbooks complete; drill schedule ready

---

## Overview

T5.3 ensures the team can respond to P1 (page dev) and P2 (Slack alert) incidents in under 30 minutes. This involves:

1. **Drill 1 (May 5):** Simulate database failover
2. **Drill 2 (May 12):** Simulate Worker crash + rollback
3. **Drill 3 (May 19):** Simulate security breach + incident response
4. **All-hands training (May 22):** Review postmortems + update playbooks

---

## Pre-Drill Preparation Checklist

**Before May 5 (Drill 1 starts 2:00 PM UTC):**

- [ ] **Notify team:** Slack announcement 24 hours prior (Friday 2:00 PM UTC)
- [ ] **Prepare scenarios:** Database scripts, rollback procedures, comms templates
- [ ] **Test staging:** Run full drill scenario on staging first (Thu Apr 28)
- [ ] **Assign roles:**
  - Incident Commander (IC): On-call engineer
  - Scribe: Records timeline + actions
  - Comms Officer: Updates status page
  - Resolver: Executes fixes
  - Backup: Monitors dependencies
- [ ] **Briefing:** 15-min pre-drill sync (1:45 PM UTC) to align on goals

---

## Drill 1: Database Failover Simulation (May 5, 2:00 PM UTC)

**Scenario:** Neon primary database becomes unavailable; must fail over to read replica

**Duration:** 30 minutes (goal: discover + mitigate in <10 min)

### Simulation Steps

**2:00 PM UTC — Incident Starts**

IC receives alert: "Database connection refused - videoking"
```
⚠️ Alert: connection pool exhausted (9/10)
Error: ECONNREFUSED at 14:00:32 UTC
Service: videoking worker
Duration: unknown
```

**Scribe immediately:** Opens incident doc (template: `docs/templates/INCIDENT_LOG.md`)
```
Incident #: INC-2026-0428-001
Severity: P1 (service down)
Detected: 2:00 PM UTC
IC: Alice
Scribe: Bob
Status: INVESTIGATING
```

**Resolver actions:**
1. Check Neon console: "Confirm primary is down"
2. Query read replica: "Can read replicas still connect?"
3. Check replication lag: "Any data loss?"
4. Initiate failover: "Point application to read replica"

**Expected timeline:**
```
2:00 — Alert fired
2:02 — IC says "I'm incident commander"
2:03 — Scribe opens incident doc + Slack channel
2:05 — Resolver confirms primary down, read replica healthy
2:08 — DB connection string switched to replica
2:09 — Health check passes
2:10 — Incident declared RESOLVED
Postmortem: scheduled for next day
```

**Drill 1 Success Criteria:**
✅ IC took command within 2 minutes  
✅ Issue root-caused within 5 minutes  
✅ Service restored within 10 minutes  
✅ All 5 team members participated  
✅ Postmortem scheduled (due next business day)

---

## Drill 2: Worker Crash & Rollback (May 12, 2:00 PM UTC)

**Scenario:** Bad deployment of videoking worker; errors spike to 10%; must rollback previous version

**Duration:** 30 minutes

### Simulation Steps

**2:00 PM — Incident Starts**

IC receives alert: "Error rate >5% for 5 minutes"
```
⚠️ Alert: ERROR_RATE_HIGH
Error rate: 12.4% (threshold: 5%)
P99 latency: 3.2s (threshold: 500ms)
Affected endpoints: /api/videos, /api/videos/{id}
Duration: 5 minutes (started 1:55 PM UTC)
```

**Did anyone deploy recently?** 
Check GitHub Actions: "Yes, deploy just finished at 1:52 PM"
Deploy: videoking/v2.5.1 by engineering

**Resolver actions:**
1. Tail Worker logs: "What errors are we seeing?"
2. Compare old vs. new code: "What changed?"
3. Initiate rollback: `wrangler rollback --version v2.5.0`
4. Monitor error rate: "Is it dropping?"
5. Verify: `curl https://videoking.adrper79.workers.dev/health` returns 200

**Expected timeline:**
```
1:55 — Errors spike (alert doesn't fire yet, threshold is 5min)
2:00 — Alert fires
2:02 — IC says "I'm incident commander"
2:03 — Scribe opens incident doc
2:04 — Resolver checks logs, finds null pointer error in new code
2:05 — Resolver initiates rollback
2:08 — Health check passes, error rate dropping
2:10 — Incident resolved, rollback confirmed stable
Postmortem: scheduled for next day
Root cause: Forgot type guard for optional field
```

**Drill 2 Success Criteria:**
✅ Rollback executed in <5 minutes  
✅ Service recovered to <1% error rate  
✅ No manual fixes needed (rollback is enough)  
✅ Team documented what went wrong  
✅ Prevention discussed (e.g., better type safety, canary testing)

---

## Drill 3: Security Breach Response (May 19, 2:00 PM UTC)

**Scenario:** Attacker obtains creator API tokens; must revoke tokens + audit usage + notify creators

**Duration:** 30 minutes

### Simulation Steps

**2:00 PM — Incident Starts**

IC receives alert: "Suspicious activity detected"
```
⚠️ Alert: SECURITY_ALERT
Unusual token usage: 1000+ API calls from single token in 10 minutes
Endpoints: /api/videos (list all), /api/creators (enum), /api/payouts (list all)
IP: 45.33.32.X (VPN, non-US location)
Detector: PostHog anomaly detection
```

**Security Officer actions:**
1. Revoke all tokens issued >30 days ago (most likely compromised)
2. Check audit log: "Which creators were affected?"
3. Query: "Were any private videos / PII accessed?"
4. Notify: Send email to affected creators (template: `docs/templates/SECURITY_INCIDENT_NOTIFICATION.md`)
5. Update status page: "We detected unauthorized access on 2026-05-19 at 2:00 PM UTC. Tokens have been revoked. No data was compromised."

**Expected timeline:**
```
1:55 — Attacker starts using stolen token (1000 requests)
2:00 — Alert fires
2:02 — IC says "I'm incident commander" + escalates to Security Officer
2:03 — Scribe opens incident doc + #security-incident Slack channel
2:05 — Security Officer revokes tokens
2:06 — Query impact: 3 creators affected
2:08 — Check audit log: No sensitive data accessed
2:10 — Send notification emails to 3 affected creators
2:12 — Update status page
2:15 — Incident declared RESOLVED
Postmortem: Tomorrow AM, discuss token rotation policy + rate limiting per creator
```

**Drill 3 Success Criteria:**
✅ Security Officer notified within 2 minutes  
✅ Tokens revoked within 5 minutes  
✅ Affected creators identified  
✅ Creator notification sent  
✅ No data was actually compromised (verified)  
✅ Status page updated  
✅ Postmortem identifies root cause (weak token rotation policy)

---

## Drill Execution Playbook (All Drills)

### T-24 Hours (Preparation)

**Ops Lead:**
- [ ] Review incident playbook: `docs/runbooks/incident-response-playbook.md`
- [ ] Prepare scenario slides (Drill 1/2/3 details)
- [ ] Set up test environment (staging or dedicated drill VM)
- [ ] Review past incidents (2-3 examples of how team responded)
- [ ] Create incident document template (copy from `docs/templates/INCIDENT_LOG.md`)

**IC Candidate (rotate each drill):**
- [ ] Read IC responsibilities section (CLAUDE.md standing orders)
- [ ] Understand escalation matrix (who to ping for what)
- [ ] Review communication templates

**All Team Members:**
- [ ] Read the scenario description (1 page)
- [ ] Optional: Review related runbook

### T-15 Minutes (Pre-Drill)

**Ops Lead (in video call with team):**
1. "This is a drill. No real incident."
2. Scenario walkthrough (1 slide, <2 min)
3. "IC, please take this role. Scribe, document everything."
4. "We are live in 15 minutes. Any questions?"
5. Close call, let people grab coffee

### T-0 Minutes (Drill Starts)

**Ops Lead (via Slack):**
```
@channel DRILL START: Incident #INC-2026-05-05-001 has been triggered.
You will receive an automated alert in 30 seconds.
Remember: This is a safety drill. Treat it as real, but don't panic.
Estimated duration: 30 minutes.
```

**then:**
```
⚠️  [SIMULATED] ERROR_RATE_HIGH
Error rate: 12.4% (threshold: 5%)
Duration: 5 minutes
Affected service: videoking
```

**IC responds (in #incident-response Slack channel):**
```
I'm Incident Commander.
Starting incident response.
Scribe: Bob, can you log this?
Comms Officer: Please update status page with "investigating"
```

### During Drill (0–30 min)

**Scribe maintains incident timeline:**
```
2:00 — Alert fired, IC assumed command
2:02 — Team mobilized
2:04 — Root cause identified (bad deploy)
2:05 — Resolver starting rollback
2:08 — Health check passed
2:10 — Incident resolved
```

**Comms Officer updates status page:**
```
🟡 investigating — We are investigating elevated error rates
(update every 3–5 minutes during active incident)
```

**Then, when resolved:**
```
✅ resolved — Issue identified and mitigated. Rollback completed at 14:10 UTC.
```

### Post-Drill (T+30 min)

**Team reconvenes in video call:**

**Ops Lead:**
1. "Drill complete. Great work, team."
2. "Let's do a quick retrospective (5 min):"
   - What went well?
   - What could improve?
   - Any blockers?

**Example Retro (Drill 1):**
```
❌ Issue: IC wasn't notified — took 2 min to realize incident was happening
✅ Fix: Add automatic Slack DM to on-call IC when P1 alert fires

✅ Good: Scribe was thorough, logged everything
✅ Good: Resolver was decisive, checked 3 things then took action

❌ Issue: Postmortem not scheduled — forgot to assign date/time
✅ Fix: IC should always schedule postmortem before closing incident (standing rule)
```

**Ops Lead then:**
- [ ] Schedule postmortem (48 hours after drill)
- [ ] Send postmortem template + instructions to IC
- [ ] Close incident doc

---

## Postmortem Template

**File:** `docs/templates/POST_DRILL_POSTMORTEM.md`

```markdown
# Post-Drill Postmortem: Drill 1 (Database Failover)

**Date:** May 6, 2026 (next business day after May 5 drill)  
**Duration:** 30 minutes  
**Participants:** IC (Alice), Scribe (Bob), Resolver (Charlie), Comms (Diana), Backup (Eve)

## What Happened

[Recap of incident scenario and actual response]

## What Went Well (Keep Doing)

- IC took command immediately
- Scribe was thorough with timeline
- Team communicated clearly in Slack

## What Could Improve (Action Items)

| Item | Owner | Due Date |
|------|-------|----------|
| Add automatic Slack DM to on-call IC | DevOps | May 13 |
| Update playbook with new alert thresholds | Ops | May 10 |

## Lessons Learned

1. Failover takes ~3 min; add to SLO (we target <5 min recovery)
2. Read replicas should be geo-distributed (single AZ is risky)
3. Consider automatic failover instead of manual (for next phase)
```

---

## Training Schedule (May 22 All-Hands)

**1 Hour Video Call:**

1. **Welcome (5 min):** Purpose of drills + safety + learning mindset
2. **Drill 1 Recap (10 min):** Show recording; highlight what team did well
3. **Drill 2 Recap (10 min):** Show recording; discuss rollback procedure
4. **Drill 3 Recap (10 min):** Show recording; emphasize security response speed
5. **Q&A (10 min):** "Any questions? Concerns?"
6. **Action Items Review (5 min):** Recap changes made based on drills
7. **Next Steps (5 min):** Q2 drill calendar + new team member training

---

## Drill Calendar

| Date | Time (UTC) | Drill | IC | Scribe |
|------|-----------|-------|-----|--------|
| May 5 | 2:00 PM | Database Failover | Alice | Bob |
| May 12 | 2:00 PM | Worker Crash + Rollback | Charlie | Diana |
| May 19 | 2:00 PM | Security Breach | Eve | Frank |
| May 26 (if needed) | 2:00 PM | Bonus: Customer escalation | [Team vote] | [Team vote] |

---

## Roles & Responsibilities

### Incident Commander (IC)

**When:** Takes command as soon as P1 alert fires  
**What:**
- "I'm IC"
- Assign roles (Scribe, Comms, Resolver, Backup)
- Guide team through playbook
- Make critical decisions (rollback vs. fix, customer comms, escalation)
- Declare incident resolved + schedule postmortem

**Authority:** Can override normal approval chains in crisis (e.g., "Resolver, go ahead and rollback without code review")

### Scribe

**When:** Starts immediately after IC assigns role  
**What:**
- Create/copy incident document
- Record every action + timestamp
- Note decisions + rationale
- Assign action items

**Tools:** `docs/templates/INCIDENT_LOG.md`, Slack thread

### Comms Officer

**When:** Starts immediately after IC assigns role  
**What:**
- Update status page (https://status.videoking.local)
- Send customer notification emails (if customer-facing incident)
- Answer support Slack questions
- Ensure accuracy of all external comms

### Resolver

**When:** Starts immediately, directed by IC  
**What:**
- Execute fixes per playbook
- Report status to IC every 2 minutes ("Still investigating…" / "Found root cause…" / "Rollback in progress…")
- Test recovery procedures
- Verify incident is resolved

### Backup

**When:** Standby, activated if Resolver gets stuck  
**What:**
- Monitor dependencies (is Stripe up? Is Neon responding?)
- Escalate if needed ("Stripe is down too; this is bigger than we thought")
- Take over if Resolver gets stuck

---

## Escalation Matrix

**Who to contact if incident isn't resolving:**

| Time Elapsed | Who | How | Actions |
|-------------|-----|-----|---------|
| <5 min | IC makes calls | Slack | Follow playbook |
| 5–10 min | IC + Tech Lead | Video call | Debug session |
| 10–15 min | IC + Tech Lead + CEO | Slack (if customer impact) | Decide on comms |
| 15+ min | Full war room | Video + Slack | External comms, legal check |

**Tech Lead contact:** @tech-lead (usually Alex)  
**CEO contact:** @ceo (only if customer revenue at risk)

---

## Exit Criteria

**T5.3 is complete when:**

✅ All 3 drills executed on schedule (May 5, 12, 19)  
✅ All 3 postmortems written + action items tracked  
✅ Team can recover from P1 incident in <30 minutes  
✅ Team can communicate status to customers in <5 minutes  
✅ At least 1 improvement implemented based on drill learnings  
✅ All team members trained on incident response playbook  
✅ Backup responder trained + ready to take IC role

---

## Related Docs

- [Incident Response Playbook](docs/runbooks/incident-response-playbook.md) — Full procedures
- [Rollback Runbook](docs/runbooks/rollback-runbook.md) — How to rollback
- [Status Page](https://status.videoking.local) — Public incident comms
- [IMPLEMENTATION_SCORECARD.md](../IMPLEMENTATION_SCORECARD.md) — Phase D status
