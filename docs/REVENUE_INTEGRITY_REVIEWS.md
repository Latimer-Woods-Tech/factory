# Revenue Integrity Reviews: Weekly Reconciliation & Exception Management

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T3.4 — Establish revenue integrity reviews  
**Scope:** Define weekly reconciliation process, variance investigation, exception handling, audit trail

---

## Executive Summary

**Problem:** VideoKing handles money but has no formal revenue reconciliation:
- Weekly payouts: $47K ✅ (processed)
- Does it match what creators are owed? Unknown
- Are there gaps between DB ledger and actual transfers? Unknown
- If variance exists, how do we discover + remediate it? No process
- Regulatory/audit trail? Spotty

**Missing Process:**
- No weekly ledger vs. Stripe reconciliation
- No variance investigation discipline
- No exception tracking
- No audit log (who checked what when? decisions made?)
- Risk: "We processed $X but creators only got $Y; where's the delta?"

**Solution by May 22:**
- ✅ Weekly reconciliation process (every Monday post-batch)
- ✅ Variance tolerance rules (0.5% acceptable; >0.5% requires investigation)
- ✅ Exception categorization (pending bank settlement, failed transfers, operator error, bugs)
- ✅ Audit trail (every variance logged + root cause documented)
- ✅ SLA recovery (all variances resolved within 30 days)
- ✅ Monthly sign-off (Finance Lead verifies reconciliation)

**Result:**
- Revenue integrity: 100% confidence (every dollar auditable)
- Compliance ready: SOC 2 Type II audit trail in place
- Trust: Creators see reconciliation + know we settle accurately

---

## Part 1: Weekly Reconciliation Process

### Step 1: Collect Data (Monday 10:00 AM UTC)

**Data Sources:**
1. **Database Ledger** (Source of Truth for Creator Earnings)
   - Query: All `payouts` table entries from last batch (sorted by `created_at DESC`)
   - Sum: Total creator earnings for period
   ```sql
   SELECT 
     COUNT(*) as payout_count,
     SUM(amount) as total_amount,
     SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending,
     SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid,
     SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as failed
   FROM payouts
   WHERE batch_id = 'PB-{YYYYMMDD}' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
   ```

2. **Stripe Balance** (Actual Transfer Records)
   - Query: Stripe API `balance.list()` filtered to last 7 days
   - Sum: Total transferred to creator accounts
   ```typescript
   const stripe = Stripe(env.STRIPE_SECRET);
   const transfers = await stripe.transfers.list({
     limit: 100,
     created: { gte: Math.floor(Date.now() / 1000) - 7 * 24 * 3600 },
   });
   const totalTransferred = transfers.data
     .reduce((sum, t) => sum + t.amount, 0) / 100; // cents to dollars
   ```

3. **Creator Payout Ledger** (Detailed Breakdown)
   - Query: `SELECT creator_id, SUM(amount) FROM payouts GROUP BY creator_id`
   - Use: Identify which creators had variances

### Step 2: Calculate Variance (Monday 10:15 AM UTC)

```typescript
// src/workers/revenue-integrity-check.ts
export async function weeklyReconciliation(env: Env) {
  // Fetch DB ledger
  const dbResult = await env.DB.prepare(/* query above */).all();
  const dbTotal = dbResult.results[0].total_amount;
  
  // Fetch Stripe balance
  const stripe = Stripe(env.STRIPE_SECRET);
  const transfers = await stripe.transfers.list({ limit: 100 });
  const stripeTotal = transfers.data.reduce((sum, t) => sum + t.amount, 0) / 100;
  
  // Calculate variance
  const variance = Math.abs(dbTotal - stripeTotal);
  const variancePercent = (variance / dbTotal) * 100;
  const varianceDirection = dbTotal > stripeTotal ? 'MISSING' : 'OVERAGE';
  
  // Reconciliation status
  const TOLERANCE_PERCENT = 0.5;
  let status: 'healthy' | 'investigate' | 'critical' = 'healthy';
  
  if (variancePercent > TOLERANCE_PERCENT && variancePercent < 2.0) {
    status = 'investigate';
  } else if (variancePercent >= 2.0) {
    status = 'critical';
  }
  
  // Store result
  await env.DB.prepare(
    `INSERT INTO revenue_reconciliations 
    (week_of, db_total, stripe_total, variance, variance_percent, variance_direction, status, reconciled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, now())`
  ).bind(
    new Date(Date.now() - (Date.now() % (7 * 24 * 60 * 60 * 1000))), // week start
    dbTotal,
    stripeTotal,
    variance,
    variancePercent,
    varianceDirection,
    status,
  ).run();
  
  return { status, variance, variancePercent };
}
```

---

### Step 3: Exception Investigation

**If Variance Exists:**

```
Decision Tree:
├─ Is variance < 0.5%?
│  ├─ YES → Accept (rounding, timing differences)
│  └─ Output: "HEALTHY" ✅
│
└─ Is variance ≥ 0.5%?
   ├─ Check: Are any payouts still "pending" or "failed" in DB?
   │  ├─ YES → Expected; payouts not yet settled
   │  └─ Mark as: "EXPECTED_PENDING" (acceptable for <7 days)
   │
   ├─ Check: Are failed payouts in DLQ being retried?
   │  ├─ YES → Expected; check retry schedule
   │  └─ Mark as: "DLQ_RECOVERY_IN_PROGRESS"
   │
   ├─ Check: Are there creator chargebacks?
   │  ├─ YES → Offset expected variance
   │  └─ Mark as: "CHARGEBACK_OFFSET"
   │
   └─ Check: UI error or data corruption?
      ├─ YES → Escalate to engineering
      └─ Mark as: "DATA_CORRUPTION_ALERT" 🚨
```

### Example: Investigating a 1.2% Variance

```
Scenario: DB says $47,212 owed; Stripe shows $46,651 transferred. Variance: $561 (1.19%)

Investigation Steps:
┌─────────────────────────────────────────────────┐
│ 1. Query DB for "pending" or "failed" payouts   │
│ ├─ Pending: 8 payouts, $427 total              │
│ │  (reason: still pending bank settlement)      │
│ ├─ Failed: 3 payouts, $134 total               │
│ │  (reason: in DLQ; auto-retrying)              │
│ └─ Subtotal: $561 (matches variance!)           │
│                                                 │
│ 2. Outcome:                                     │
│ ├─ Variance explained: $561 = $427 + $134      │
│ ├─ Status: EXPECTED_PENDING                    │
│ ├─ All pending payouts will settle by Wed      │
│ └─ All failed payouts retrying Monday 09:00    │
│                                                 │
│ 3. Resolution:                                  │
│ ├─ Check back Tuesday 10:00 am → expected 100% │
│ ├─ Alert: If Tuesday still shows variance      │
│ └─ Log: Variance explained; no action required  │
└─────────────────────────────────────────────────┘
```

---

## Part 2: Exception Categories

### Category A: Expected Pending
- **Cause:** Payouts processed but bank settlement not yet complete (1–2 days)
- **Duration:** Normal; resolves within 2–3 business days
- **Action:** Document; check again next week
- **Example:** Monday batch shows $8K pending; by Wednesday settled ✅

### Category B: DLQ Recovery In Progress
- **Cause:** Payment failed (insufficient funds, verification required)
- **Duration:** Auto-retrying (5m, 30m, 2h, 12h backoff)
- **Action:** Monitor retry schedule; track until success
- **Example:** Creator #2847 verification pending; auto-retry Monday batch ✅

### Category C: Chargeback Offset
- **Cause:** Viewer disputed charge; Stripe reversed transfer
- **Duration:** May offset other payouts temporarily
- **Action:** Log chargeback; adjust creator earnings
- **Example:** Viewer chargeback $50 → offset creator payout by $50

### Category D: Timing Misalignment
- **Cause:** Reconciliation run before Stripe settled all transfers (race condition)
- **Duration:** Transient; resolves within 24 hours
- **Action:** Re-run reconciliation after Stripe sync complete
- **Example:** Run at 10:15 am but Stripe still processing; run again at 2:00 pm ✅

### Category E: Data Corruption Alert 🚨
- **Cause:** DB entry doesn't match Stripe record (possible bug or manual error)
- **Duration:** Requires investigation + possible remediation
- **Action:** Escalate to engineering; manual operator override if needed
- **Example:** DB says $100 paid; Stripe shows $0 transferred (ERROR)

---

## Part 3: Weekly Reconciliation Dashboard

**URL:** `https://factory-admin.videoking.com/finance/reconciliation`

```
┌────────────────────────────────────────────────────────────────┐
│  Weekly Revenue Reconciliation (Apr 21–27)                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Overall Status: ✅ RECONCILED (No issues)                     │
│ Submitted By: Sarah (Ops Lead) on Apr 28 @ 10:30 am UTC       │
│ Last Updated: Apr 28 @ 14:00 UTC (Post-investigation)         │
│                                                                │
│ 📊 Summary                                                     │
│ ├─ DB Ledger (Creator Earnings):       $181,712               │
│ ├─ Stripe Actual Transfers:             $181,651               │
│ ├─ Variance:                            -$61 (0.03%)           │
│ ├─ Status:                              ✅ WITHIN TOLERANCE   │
│ └─ Expected by:                         Apr 30 (2 bank days)  │
│                                                                │
│ 💾 Breakdown                                                   │
│                                                                │
│ Successful (→ Stripe):        $177,944 (98.12%)              │
│ Pending (waiting settlement): $3,087 (1.70%)                 │
│ Failed (in DLQ):              $681 (0.38%)                   │
│ ─────────────────────────────────────────────────            │
│ DB Total:                      $181,712 (100%)               │
│                                                                │
│ Exception Details:                                             │
│                                                                │
│ Pending Transfers (8 total):                                  │
│ • $1,247 → creator #2847 (approval pending at Stripe)        │
│ • $856 → creator #5109 (approval pending at Stripe)          │
│ • [5 more at $184–$234 each]                                 │
│ → Expected settlement: Apr 29 ✅                             │
│                                                                │
│ Failed Transfers (3 total; in DLQ):                          │
│ • $234 → creator #6834 (network timeout)                     │
│   Status: Auto-retrying (next attempt: May 6 @ 09:00)        │
│   [Manual Retry] [Refund]                                    │
│ • $224 → creator #9847 (verification_required)               │
│   Status: creator contacted; awaiting response                │
│   [Follow up] [Manual Override]                              │
│ • $223 → creator #3012 (insufficient_funds)                  │
│   Status: Auto-retrying (next attempt: May 6 @ 09:00)        │
│   No action needed                                            │
│                                                                │
│ 🔐 Audit Trail                                               │
│ • Reconciliation started: Apr 28 @ 10:15 am UTC              │
│ • Variance identified: $61 (0.03%)                           │
│ • Investigation: Identified as "expected pending"            │
│ • Resolution: Monitor; will re-reconcile May 1               │
│ • Status: ✅ APPROVED (Sarah, 10:30 am)                      │
│                                                                │
│ [Export PDF] [Email Report] [Archive]                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Monthly Sign-Off Process

### Last Business Day of Monthly

**Finance Lead reviews:**
- [ ] All weekly reconciliations (4 weeks of data)
- [ ] Any unresolved variances from prior month?
- [ ] Total creator earnings vs. revenue recognized
- [ ] Chargeback/refund impact on earnings
- [ ] Operator actions (manual overrides, refunds)

**Sign-off Template:**
```
MONTHLY REVENUE INTEGRITY SIGN-OFF
Month: April 2026

Total Creator Earnings (DB): $761,438
Total Transferred (Stripe): $761,287
Net Variance: -$151 (0.02%)
Status: ✅ ACCEPTABLE (within 0.5% tolerance)

Exceptions Handled:
├─ DLQ failures resolved: 23 (100%)
├─ Chargeback offsets: 5 ($1,247)
├─ Manual overrides: 2 (operator documented)
└─ Data corrections: 0

Audit Trail:
✅ All weekly reconciliations completed
✅ All variances documented
✅ All exceptions investigated
✅ All creators' records accurate

Signed: [Finance Lead Name]
Date: April 30, 2026
```

---

## Part 5: SLA & Recovery

### Variance Resolution SLA

| Variance Size | Investigation SLA | Resolution SLA | Escalation |
|---|---|---|---|
| <0.5% | Automatic accept | N/A | No escalation |
| 0.5–2% | Within 24h | Within 7 days | PM if unresolved |
| 2–5% | Within 4h | Within 3 days | Engineering + PM |
| >5% | Within 1h (critical) | Within 24h | CEO + Legal |

### Example: 3% Variance (Immediate Action)

```
Trigger: 3% variance detected (Monday 10:20 am UTC)

Escalation:
1. Alert goes to Slack #revenue-ops (immediate)
2. Page on-call engineer (PageDuty)
3. Create incident ticket (Sentry + Factory Admin)
4. Engineering investigates root cause (within 4 hours)
5. Finance reviews proposed fix (within 6 hours)
6. Implement fix + re-reconcile (within 24 hours)

Example Root Causes (Real Scenarios):
├─ Bug: Double-charge deduplication failed
├─ Bug: Currency conversion error
├─ Operator: Manual payout entered twice
├─ Fraud: Creator booked fake earnings
└─ Stripe: Account closed mid-batch (rare)
```

---

## Part 6: Implementation Checklist (May 1–22)

### Week 1 (May 1–5): Automation + Dashboard
- [ ] Build reconciliation query (DB vs. Stripe)
- [ ] Automate weekly reconciliation (Monday 10:15 am)
- [ ] Build reconciliation dashboard
- [ ] Create exception categories + investigation flowchart
- Effort: 6 hours (Backend + Analytics)

### Week 2 (May 8–12): Process + Training
- [ ] Define reconciliation process + SLAs
- [ ] Train Finance Lead on sign-off procedure
- [ ] Create runbook: "Investigate Variance"
- [ ] Document escalation paths (who to page, when, why)
- Effort: 4 hours (Ops + Finance)

### Week 3 (May 15–22): Verification + Audit
- [ ] First 4 weekly reconciliations executed
- [ ] All exceptions documented + resolved
- [ ] Monthly sign-off completed (April results)
- [ ] Prepare SOC 2 audit trail
- Effort: 3 hours (Finance)

**Total Effort:** 13 hours (Backend, Finance, Ops)

---

## Part 7: Success Metrics

**Reconciliation Accuracy:**
- Weekly reconciliations: 100% completed
- Variance detection: 100% (all anomalies caught)
- Exception resolution: 100% within SLA

**Audit Trail Quality:**
- Every dollar auditable (creator → batch → transfer → bank)
- Zero manual workarounds (all documented)
- Zero "we don't know what happened to $X" scenarios

**Compliance Readiness:**
- SOC 2 Type II ready (full audit trail)
- Monthly sign-offs completed
- Regulatory audit: <2 hours to gather evidence

**Creator Trust:**
- Disputes resolved: Within 24 hours
- Transparency: Creators can see reconciliation status

---

## Part 8: Exit Criteria (T3.4)

- [x] Weekly reconciliation process defined
- [x] Variance tolerance rules documented (0.5% threshold)
- [x] Exception categories defined (5 types)
- [x] Reconciliation dashboard designed
- [x] Monthly sign-off template created
- [x] SLA + escalation paths documented
- [x] Implementation checklist (13 hours; May 1–22)
- [ ] Automation deployed (May 5)
- [ ] First 4 reconciliations completed (Apr 28 + May 5/12/19/26)
- [ ] Monthly sign-off completed (May 30)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Finance Lead | T3.4 revenue integrity reviews; weekly reconciliation, exception handling, SLAs, audit trail, SOC 2 compliance |

---

**Status:** ✅ T3.4 REVENUE INTEGRITY FRAMEWORK READY  
**Next Action:** Deploy reconciliation automation (May 1); execute first reconciliation (Apr 28); complete monthly sign-off (May 30)

**References:**
- ADR 1001: Weekly batch payouts (operational context)
- T3.2: Payout operations (manual recovery workflows)
- T3.3: Monetization funnel (earnings attribution)
- Incident Response: `docs/INCIDENT_RESPONSE_WORKFLOW.md` (SLAs for P1 revenue incidents)
- SOC 2 Compliance: [AICPA SOC 2 Trust Service Criteria](https://www.aicpa.org/interestareas/informationsystemsaudit/pages/systrust.aspx)
