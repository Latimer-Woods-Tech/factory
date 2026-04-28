# Error Budget Policy

**Document Version:** 1.0  
**Last Updated:** April 28, 2026  
**Effective Date:** May 1, 2026

---

## Overview

Error budget policy translates SLO targets into operational discipline. It answers: "When does burned budget force us to change our work?"

This policy applies to all Factory applications managed by the core platform team.

---

## Policy Tiers

### Tier 1: Critical Services
**Services:** Auth, payments, payouts

**Budget Target:** 99.95%  
**Monthly Budget:** 21.6 minutes downtime  
**Consumption Thresholds:**

| Range | Status | Action | Duration |
|-------|--------|--------|----------|
| 0–50% | Healthy | Normal feature development continues | — |
| 50–80% | At Risk | Daily ops standup begins; head-of-engineering briefed | Until end of month or budget stabilized |
| 80–100% | Critical | **Code freeze: feature development paused; team pivots to reliability sprint** | Entire remainder of month |
| 100%+ | Breached | **Mandatory postmortem; root cause fix must ship in next sprint** | Blocks next sprint planning until fix is merged |

**Escalation Chain:**
- 50% consumed: Ops lead notified
- 80% consumed: Head of Engineering + Product lead notified
- 100% consumed: CEO + Board notified (if material business impact)

---

### Tier 2: Important Services
**Services:** Video streaming, user discovery, notifications

**Budget Target:** 99.9%  
**Monthly Budget:** 43.2 minutes downtime  
**Consumption Thresholds:**

| Range | Status | Action | Duration |
|-------|--------|--------|----------|
| 0–60% | Healthy | Normal ops; track weekly | — |
| 60–80% | At Risk | Prioritize reliability bugs; defer nice-to-have features | Until stabilized |
| 80–100% | Critical | **Reliability sprint: non-critical feature work paused** | Remainder of month |
| 100%+ | Breached | **Postmortem required; plan follow-up sprint** | Next sprint allocated to fixes |

**Escalation Chain:**
- 80% consumed: Engineering lead + Product lead briefed
- 100% consumed: Engineering lead + Ops lead accountability

---

### Tier 3: Best-Effort Services
**Services:** Analytics, ML batch jobs, secondary admin features

**Budget Target:** 99%  
**Monthly Budget:** 7.2 hours downtime  
**Consumption Thresholds:**

| Range | Status | Action |
|-------|--------|--------|
| 0–100% | Tracked | Noted in weekly ops review; no action required |
| 100%+ | Breached | Log incident; schedule fix at convenient time; no urgency |

**Escalation:** None required

---

## Code Freeze: Definition & Scope

### What triggers a code freeze?

**Tier 1:** Error budget >80% consumed on any critical service (Auth, Payments, or Payouts)  
**Tier 2:** Error budget >80% consumed on any important service AND that service's burn rate is 5×+ monthly burn rate

### What is paused?

**Feature development:**
- Any new features (even small)
- Non-critical UX improvements
- Refactoring work (unless it improves reliability)
- UI polish / design tweaks

**What continues:**
- Bug fixes (especially reliability-related)
- Security patches
- Documentation
- Monitoring and observability improvements
- Performance optimizations

### Who decides what's "critical"?

**Tech lead** (for Tier 1) or **Engineering lead** (for Tier 2) makes the call, in consultation with Product.

Example decision:
- **Critical (allowed during freeze):** "Fix 500 errors in payment webhook handler" ✅
- **Non-critical (blocked):** "Add new creator onboarding flow variant" ❌
- **Non-critical (blocked):** "Refactor database schema for future partitioning" ❌
- **Critical (allowed):** "Add index to speed up payout query (currently 10s, SLO is 2s)" ✅

### Code freeze communication

When code freeze is triggered:

1. **Immediate message to #engineering:** "Tier 1 Auth SLO at 82% consumption; code freeze begins immediately on non-critical features"
2. **Standup update:** Scrum master adjusts sprint board; moves low-priority items to backlog
3. **Daily standup focus:** Burn rate trend, incidents, fixes shipped
4. **Daily report to leadership:** SLO consumption %, incidents this 24h, ETA for stabilization

### Lifting the freeze

Code freeze lifts when:
- Budget consumption drops below 50% (healthy again), **AND**
- Burn rate has been stable (<2×) for 3 consecutive days

Example:
- Monday 2pm: Auth SLO at 85% → freeze begins
- Wednesday 10am: Auth SLO at 65%, burn rate at 1.5× → freeze continues (still > 50%)
- Friday 2pm: Auth SLO at 48%, burn rate stable at 1× → **freeze lifted**; normal development resumes

---

## Budget Consumption Calculation

SLO consumption is measured automatically and rolled up daily.

### Formula

For availability-based SLOs:

```
Monthly Error Budget = (1 - SLO_Target) × Hours_in_Month × 60 minutes

Example (99.95%, 30 days):
Budget = (1 - 0.9995) × 30 × 24 × 60 = 21.6 minutes

Consumption % = Minutes_of_Downtime_This_Month / Monthly_Budget × 100

Example:
If 2 incidents in May used 15 minutes combined:
Consumption = 15 / 21.6 × 100 = 69.4%
```

### Automated calculation

Ops team runs daily `slo-report.sh`:

```bash
npm run ops:slo-report -- --tier 1 --date 2026-05-15
```

Output:
```
SLO Report — May 15, 2026

Tier 1 Services:
  Auth         | 67.3% consumed | 3 incidents | On track
  Payments     | 42.1% consumed | 1 incident  | Healthy
  Payouts      | 55.0% consumed | 2 incidents | Healthy

Tier 2 Services:
  Video        | 38.0% consumed | 0 incidents | Healthy
  Discovery    | 64.2% consumed | 3 incidents | Watch
  Notifications| 22.1% consumed | 1 incident  | Healthy
```

Report is posted to #ops and #engineering daily at 9am UTC.

---

## Postmortem Trigger & Requirements

### When a postmortem is required

**Tier 1 incidents (always):**
- Any incident > 5 minutes (user-facing outage)
- Any data loss
- Any security breach

**Tier 2 incidents:**
- Any incident > 30 minutes
- Any incident that impacts >10% of users

**Tier 3 incidents:**
- Only if pattern (3+ incidents in 7 days) or high impact

**Mandatory for all tiers:**
- SLO fully consumed (100% of monthly error budget)
- 5× burn rate sustained for >10 minutes

### Postmortem timeline

| Time | Action |
|------|--------|
| Incident ends | Oncall pings incident commander |
| +15 min | Incident commander creates postmortem doc + notifies team |
| +24 hours | Draft postmortem completed by incident commander |
| +48 hours | **Postmortem review meeting** (engineering, ops, product) |
| +72 hours | Root cause + action items finalized; assigned to team members |
| +1 sprint | Root cause fix merged to main; prevention measures implemented |

### Postmortem content

Every postmortem must include:

1. **Timeline:** When did alert fire? When was root cause identified? When was it resolved?
2. **Root cause:** Why did this happen? Be specific (e.g., "N+1 query in feed endpoint", not "performance issue")
3. **Impact:** How long was service degraded? How many users affected? Revenue impact?
4. **Immediate fix:** What did we do to stop bleeding? (e.g., rollback, cache purge)
5. **Permanent fix:** What code/config change prevents this from recurring?
6. **Action items:** Who owns each item? Target date?
7. **Lessons:** What did we learn? Should we update runbooks, monitoring, or SLOs?

### Example postmortem (Tier 1 breach)

**Title:** Auth SLO Breach — May 2026 (100% budget consumed)

**Timeline:**
- May 15, 2pm UTC: Auth latency p99 rises from 400ms to 2s (alert fires)
- May 15, 2:15pm: On-call pages tech lead
- May 15, 2:45pm: Root cause identified: recent index corruption in `users` table
- May 15, 3:30pm: Rollback deployed; index rebuilt offline
- May 15, 4pm: Service stabilized; all tests passing

**Root Cause:** Neon reindex during schema migration corrupted btree index on `users.email`. Query planner degraded to full table scan; p99 latency went from 50ms → 2s.

**Impact:** 15 minutes of elevated latency; 3% of login attempts timed out and retried manually. No data loss. No revenue impact (during off-peak).

**Immediate Fix:** Rollback migrations; rebuild index online using `CONCURRENTLY` flag.

**Permanent Fix:** 
1. Database migrations now require DBA review for index changes (PR template updated)
2. Neon branch created for index testing before production
3. Monitoring added for index health (bloat detection)

**Lessons Learned:**
- Our index corruption detection was too late (should have caught at index creation time)
- Need synthetic monitoring for auth latency (current: only real traffic)

**Action Items:**
- [ ] Add index fragmentation check to pre-deployment verification (Due: May 22)
- [ ] Create synthetic auth health check (Due: May 29)
- [ ] Document DBA review process in deployment guide (Due: May 22)

---

## Exception Policy

### When can we skip error budget policy?

Exceptions are **rare** and must be approved by Head of Engineering + Product Lead.

**Legitimate exceptions:**

1. **Customer-reported critical bug:** If a paying customer finds a critical bug (e.g., data corruption), it takes priority over code freeze. Logged as "Strategic Exception" and post-reviewed in postmortem.

2. **Infrastructure incident:** If our infrastructure provider (Neon, Stripe, Cloudflare) has an outage causing SLO breach, we can adjust the error budget window. **Does not exempt us from postmortem**; we still review what we could have done (e.g., failover, backup).

3. **Security incident:** Any active security breach or data leak takes P0 priority regardless of SLO status.

**Invalid exceptions:**
- ❌ "We have a big feature deadline"
- ❌ "Sales promised delivery date"
- ❌ "It's the end of quarter"
- ❌ "We didn't plan properly, so burn rate is high"

### Exception tracking

Every exception is logged:
```
EXCEPTIONS.md (append-only log)
2026-05-15: Auth SLO > 80% → Approved exception for critical payment bug fix (Customer: AcmeCorp)
```

Reviewed quarterly to identify patterns (e.g., "Do we have too many strategic exceptions?").

---

## Seasonal Considerations

### Holiday periods

If your service typically sees 10× normal traffic during holidays, adjust SLO targets or add seasonal budget buffer.

**Example:** Video streaming sees 5× traffic during Thanksgiving. Either:
- **Option A:** Increase Tier 2 Availability target to 99.95% for Nov 20-28
- **Option B:** Run reliability sprint in Oct to build stability margin

Seasonal adjustments are made **before** the season (e.g., Q3 review for Q4 holidays).

---

## Metrics Dashboard

Real-time error budget status:

**Public dashboard:** `https://ops.factory-internal.dev/slo`

Shows:
- Current month SLO consumption (%) for all Tiers
- Burn rate over past 7 days
- Incidents this month (count + severity)
- On-call engineer for each Tier 1 service
- Next quarterly review date

**Access:** All engineering + ops staff

---

## Policy Review

This policy is reviewed **quarterly** alongside SLO targets.

- **Questions?** File issue in Factory repo with label `policy-slo`
- **Propose changes?** Submit RFC (see [rfc-process.md](rfc-process.md)) with `policy` tag
- **Historical exceptions tracking:** See `EXCEPTIONS.md` in Factory root

---

## FAQ

**Q: If we hit 80% on Friday of the month, and the month ends Sunday, do we still freeze?**  
A: Yes. Code freeze stays until either (a) end of month + stabilized, or (b) budget drops below 50%. You don't escape freeze by "running out the clock."

**Q: What if we're in a code freeze and a Tier 1 security bug is discovered?**  
A: Security bugs are exempt from freeze (file exception). Fix it immediately; document in postmortem.

**Q: Can we "borrow" budget from next month?**  
A: No. Each month is independent. If you burn 100% in May, June starts fresh at 100% budget. The May postmortem might change the SLO target (e.g., lower p99 latency target), but that's a policy change, not borrowing.

**Q: What if two Tier 1 services both hit 80% in the same week?**  
A: All-hands reliability sprint. Tech lead coordinates across both areas. Prioritize root causes, measure impact together.

**Q: Can a single engineer override the freeze?**  
A: No. Freeze is lifted only by Head of Engineering (or their designee). Even tech leads need formal approval to merge feature code during freeze.

---

**Related Documents:**
- [SLO Framework](slo-framework.md)
- [Videoking SLO Targets](../videoking/slo-targets.md)
- [RFC Process](rfc-process.md) (for proposing policy changes)
