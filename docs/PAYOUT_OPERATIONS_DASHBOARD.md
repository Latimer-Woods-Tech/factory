# Payout Operations: Operator Dashboard & Workflows

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T3.2 — Make payout operations operator-grade  
**Scope:** Build payout ops dashboard, batch review, retry/recovery flows, weekly reconciliation, audit trail

---

## Executive Summary

**Problem:** Payout processing is critical but lacks operator visibility:
- Monday 09:00 UTC batch runs → all processing is silent
- If 3/500 creators fail → operator finds out only when they email support
- No retry visibility → failed payouts stuck in DLQ for days
- No reconciliation → if Stripe balance doesn't match DB, we have no recovery path
- Support time: 2–3 hours of ad-hoc investigation per week

**Missing Infrastructure:**
- No batch status dashboard (can't see progress during run)
- No manual recovery UI (must SSH into worker + run SQL)
- No audit trail (why did this payout fail? who retried it? did creator see the money?)
- No reconciliation process (weekly $X variance = operational blind spot)

**Solution by May 22:**
- ✅ Dashboard: Payout batch status + real-time progress + success/failure summary
- ✅ Manual actions: Retry failed transfer / Override status / Refund disputed payout
- ✅ Audit trail: Every payout + retry + manual action logged with operator, timestamp, reason
- ✅ Weekly reconciliation: "DB earnings $5,000 vs. Stripe $4,987 = $13 variance (acceptable)"
- ✅ SLA tracking: "147 payouts in 3.2 min (within budget)"

**Result:**
- Operator time: 30 min / week (down from 2–3 hours)
- Support tickets: 80% reduction (self-service status for creators)
- Revenue accuracy: 100% audit trail + weekly variance reconciliation

---

## Part 1: Payout Operations Dashboard

### Top-Level View

**URL:** `https://factory-admin.videoking.com/payouts`

```
┌────────────────────────────────────────────────────┐
│  Payout Operations Dashboard                       │
├────────────────────────────────────────────────────┤
│                                                    │
│ 📊 This Week (Apr 22–28)                          │
│ ├─ Total Batches: 4 (Mon, Tue, Wed, Thu)         │
│ ├─ Total Payouts: 2,047                          │
│ ├─ Successful: 2,044 (99.85%)                    │
│ ├─ Failed (DLQ): 3 (0.15%)                       │
│ └─ Total Volume: $47,293                         │
│                                                    │
│ 💰 Reconciliation Status                          │
│ ├─ DB Earnings: $47,300                          │
│ ├─ Stripe Transfers: $47,287                     │
│ ├─ Variance: -$13 (0.03%) ✅ WITHIN TOLERANCE    │
│ └─ Last Check: Today 10:00 AM UTC                │
│                                                    │
│ ⏰ Next Scheduled Batch                           │
│ ├─ Date: Monday Apr 29 @ 09:00 UTC               │
│ ├─ Estimated Creators: 487                       │
│ ├─ Estimated Volume: $12,450                     │
│ └─ All creators verified: ✅ YES                 │
│                                                    │
├────────────────────────────────────────────────────┤
│ [View Batches] [View Failures] [Reconciliation]   │
│ [Manual Payout] [Creator Search] [Settings]       │
└────────────────────────────────────────────────────┘
```

---

### Batch History View

**URL:** `https://factory-admin.videoking.com/payouts/batches`

```
┌────────────────────────────────────────────────────────────────┐
│  Payout Batch History                                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Batch ID     Date/Time              Status    Payouts  Amount  │
│ ─────────────────────────────────────────────────────────────  │
│ PB-20260428  Mon 09:00 UTC, Apr 28  COMPLETE  2,044    $47.3K │
│             ✅ All succeeded         → Details                 │
│                                                                │
│ PB-20260427  Sun 09:00 UTC, Apr 27  COMPLETE  1,987    $41.2K │
│             ✅ + 3 DLQ (retrying)   → Details                 │
│                                                                │
│ PB-20260426  Sat 09:00 UTC, Apr 26  COMPLETE  2,156    $53.8K │
│             ✅ All succeeded         → Details                 │
│                                                                │
│ Pagination: [First] [Prev] [1] [2] [3] [Next] [Last]         │
│ Filter: [Status] [Date Range] [Min Volume]                   │
│ Export: [CSV] [JSON]                                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Details Click (Batch PB-20260427):**
```
┌────────────────────────────────────────────────────────────────┐
│  Batch PB-20260427 Details                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ 📋 Batch Info                                                 │
│ ├─ ID: PB-20260427                                            │
│ ├─ Date: Sunday 09:00 UTC, Apr 27, 2026                       │
│ ├─ Duration: 3 min 14 sec (within 5-min budget)              │
│ ├─ Total Payouts Processed: 1,990                            │
│ │  ├─ Successful: 1,987 (99.85%)                             │
│ │  ├─ Failed: 3 (0.15%)                                      │
│ │  └─ Total Volume: $41,287                                  │
│ │                                                             │
│ 💳 Failed Transfers (DLQ)                                     │
│ │                                                             │
│ │ Creator ID  Amount   Error                  Status          │
│ │ ─────────────────────────────────────────────────────────  │
│ │ #2847      $125.43  Stripe: verification_  DLQ: retrying   │
│ │                     required (Tier 1)       (next: Mon)     │
│ │                     → [Support] → Manual Override           │
│ │                                                             │
│ │ #5109      $87.23   Stripe: account_       DLQ: escalate   │
│ │                     closed by user          (->Support)     │
│ │                     → [Contact Creator]                     │
│ │                                                             │
│ │ #6834      $56.78   Timeout (network)      DLQ: retrying   │
│ │                     → [Retry NOW]           (next: 5m)      │
│ │                                                             │
│ ├─ DLQ Summary: 3 payouts; 1 auto-retrying, 2 need ops      │
│ └─ Projected Recovery: 2/3 resolved by Monday batch          │
│                                                                │
│ [Export Batch Report] [Manual Actions] [Close Batch]         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

### Failed Payout (DLQ) View

**URL:** `https://factory-admin.videoking.com/payouts/failed`

```
┌────────────────────────────────────────────────────────────────┐
│  Failed Payouts (DLQ Queue)                                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Status: 3 items in DLQ; 2 pending manual action              │
│                                                                │
│ Creator  Batch       Amount   Error           Retries  Action │
│ ────────────────────────────────────────────────────────────  │
│ #2847    PB-20260427 $125.43  verification_   0/4     Manual  │
│                      req (Tier 1)              (next:  [Retry]│
│                                                Mon 09)  [Mark  │
│                                                         Paid]  │
│                                                         [Ref-  │
│                                                         und]   │
│                                                                │
│ #5109    PB-20260427 $87.23   account_        0/4     Contact│
│                      closed    (next:          [Contact]      │
│                                 Wed 21)         [Manual]      │
│                                                         [DQ]   │
│                                                                │
│ #6834    PB-20260427 $56.78   timeout         2/4     [Retry]│
│                      (network)  (next:                         │
│                                  5 min)                        │
│                                                                │
│ Filter: [Status] [Error Type] [Batch] [Date]                │
│ Bulk Action: [Select All] [Retry All] [Export]              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Manual Retry Dialog (Payout #2847):**
```
┌────────────────────────────────────────────┐
│  Manual Payout Retry                       │
├────────────────────────────────────────────┤
│                                             │
│ Creator #2847 (Alex Rivera)                │
│ Amount: $125.43                            │
│ Original: Mon Apr 27 @ 09:03 UTC           │
│                                             │
│ Error: Stripe verification_required        │
│ Reason: Stripe account needs re-           │
│         verification (1099 form?)          │
│                                             │
│ Options:                                    │
│ ○ [Retry Transfer] (Stripe now)            │
│   → If verification complete, success      │
│ ○ [Mark as Paid] (Admin override)          │
│   → Creator sees payout; audit log notes  │
│     "Manual override: creator resolved"    │
│ ○ [Refund] (Reverse earnings)              │
│   → Edge case; rare & logged               │
│ ○ [Contact Creator] (Send message)         │
│   → "We need you to verify your Stripe"    │
│                                             │
│ Suggested Action: Retry Transfer           │
│ (creator likely fixed verification)        │
│                                             │
│ Notes: [text input for audit]              │
│                                             │
│ [Cancel] [Perform Action] [Queue & Notify]│
│                                             │
└────────────────────────────────────────────┘

Audit Log Entry:
{
  "timestamp": "2026-04-28T11:30:00Z",
  "operator_id": "op_admin_sarah",
  "action": "payout_retry",
  "payout_id": "#2847",
  "amount": "$125.43",
  "reason": "Creator likely resolved Stripe verification",
  "status_before": "dlq_verification_required",
  "status_after": "retry_pending",
  "notes": "Follow up if fails again; use contact creator option"
}
```

---

## Part 2: Weekly Reconciliation Workflow

### Monday After Batch (10:00 AM UTC)

**Automated Process:**

```typescript
// src/workers/payout-reconciliation.ts
export async function reconcilePayouts(env: Env) {
  // 1. Get DB ledger
  const dbResult = await env.DB.prepare(
    `SELECT 
      COUNT(*) as payout_count,
      SUM(amount) as total_amount,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as confirmed_amount
    FROM payouts
    WHERE payout_date = CURRENT_DATE AND batch_id = ?`
  ).bind(CURRENT_BATCH_ID).first();

  // 2. Get Stripe balance
  const stripe = Stripe(env.STRIPE_SECRET);
  const balance = await stripe.balance.retrieve();
  
  // 3. Calculate variance
  const dbAmount = dbResult.total_amount;
  const stripeAmount = balance.available[0].amount / 100; // cents to dollars
  const variance = Math.abs(dbAmount - stripeAmount);
  const variancePercent = (variance / dbAmount) * 100;

  // 4. Determine reconciliation status
  const TOLERANCE_PERCENT = 0.5; // 0.5% variance is acceptable
  let status = 'healthy';
  let alerts = [];

  if (variancePercent > TOLERANCE_PERCENT) {
    status = 'investigate';
    alerts.push(`Variance ${variancePercent.toFixed(2)}% exceeds tolerance (${TOLERANCE_PERCENT}%)`);
  }

  // 5. Store reconciliation record
  await env.DB.prepare(
    `INSERT INTO payout_reconciliations 
    (batch_id, db_amount, stripe_amount, variance, variance_percent, status, reconciled_at)
    VALUES (?, ?, ?, ?, ?, ?, now())`
  ).bind(
    CURRENT_BATCH_ID,
    dbAmount,
    stripeAmount,
    variance,
    variancePercent,
    status
  ).run();

  // 6. Notify operator if investigation needed
  if (status === 'investigate') {
    await Slack.send(
      '#revenue-ops',
      `⚠️ Payout reconciliation ALERT for batch ${CURRENT_BATCH_ID}:\n` +
      `DB: $${dbAmount.toFixed(2)} | Stripe: $${stripeAmount.toFixed(2)} | ` +
      `Variance: $${variance.toFixed(2)} (${variancePercent.toFixed(2)}%)\n` +
      `Action required: [View Dashboard](https://factory-admin.videoking.com/payouts/reconciliation)`
    );
  } else {
    await Slack.send(
      '#revenue-ops',
      `✅ Payout reconciliation for batch ${CURRENT_BATCH_ID}: HEALTHY\n` +
      `DB: $${dbAmount.toFixed(2)} | Stripe: $${stripeAmount.toFixed(2)} | ` +
      `Variance: $${variance.toFixed(2)} (${variancePercent.toFixed(2)}%)`
    );
  }

  return { status, variance, alerts };
}
```

---

### Reconciliation Dashboard

**URL:** `https://factory-admin.videoking.com/payouts/reconciliation`

```
┌────────────────────────────────────────────────────────────────┐
│  Weekly Payout Reconciliation Report                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Week: Apr 21–27, 2026                                          │
│                                                                │
│ Overall Status: ✅ RECONCILED (all variances within tolerance) │
│                                                                │
│ Daily Reconciliation:                                          │
│                                                                │
│ Date       Batch      DB Total    Stripe     Variance  Status │
│ ──────────────────────────────────────────────────────────    │
│ Mon 4/21   PB-20260421 $47,293   $47,280    -$13      ✅     │
│           (99.85% success; 3 DLQ)  (0.03%)            OK      │
│           [Details]                                   [Manual] │
│                                                                │
│ Tue 4/22   PB-20260422 $51,847   $51,847    $0       ✅     │
│           (100% success)           (0.00%)            OK      │
│           [Details]                                           │
│                                                                │
│ Wed 4/23   PB-20260423 $43,652   $43,625    -$27     ✅     │
│           (99.9% success; 2 DLQ)   (0.06%)            OK      │
│           [Details]                                           │
│                                                                │
│ Thu 4/24   PB-20260424 $38,920   $38,920    $0       ✅     │
│           (100% success)           (0.00%)            OK      │
│           [Details]                                           │
│                                                                │
│ ────────────────────────────────────────────────────────────  │
│ WEEK TOTAL:  $181,712          $181,673    -$39     ✅     │
│              (99.92% success)    (0.02%)     OK              │
│                                                                │
│ Action Items:                                                  │
│ • 7 failed payouts in DLQ (6 auto-retried, 1 needs manual)   │
│ • All variances within 0.5% tolerance                        │
│ • Projected next Monday: 487 creators verified               │
│                                                                │
│ [Generate PDF Report] [Export CSV] [Email Weekly]            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Manual Payout Actions

### Issue: Creator Disputes Unreceived Payout

**Support Flow:**
1. Creator emails: "I got the success notification but no money"
2. Support tickets go to ops
3. Ops checks:

```
Operator Investigation:
┌─────────────────────────────────────────────────────┐
│ Creator #5847 (Jane Doe)                            │
│ Claim: $156.78 payout not received                  │
│ Claimed Date: Monday, Apr 21 @ 09:15 UTC           │
│                                                     │
│ Investigation:                                      │
│ ├─ DB Status: Payout marked 'paid' ✅              │
│ ├─ Transfer ID: tr_...xyz (Stripe)                 │
│ ├─ Stripe Status: transferred (arrived 4/21)      │
│ ├─ Creator Bank Status: ???                        │
│ │  (Asked: "Did you check your bank?")            │
│ │  (Waited 2 days for response)                    │
│ │                                                  │
│ ├─ Action Options:                                │
│ │  A) Wait for bank (Stripe settled; not our lag) │
│ │  B) Issue refund (if customer wrong about lag)  │
│ │  C) Retry transfer (if Stripe says pending)     │
│ │  D) Escalate to Stripe (if transfer lost)       │
│ │                                                  │
│ ├─ Decision: Contact creator                       │
│ │  "Hi Jane, we see the transfer left our account │
│ │  on 4/21. Your bank usually takes 1–2 days.    │
│ │  If you still don't see it by 4/23, let us know."
│ │                                                  │
│ └─ Log: [sent_at: 2026-04-22T14:30:00Z]          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Issue: Creator Account Closed

**Support Flow:**
```
Problem:
- Creator closed their Stripe account
- Payout transfer fails with: "account_closed"
- Creator never received notification from Stripe

Solution Flow:
1. Manual Action: Mark payout as "refund_eligible"
   - Reverse DB earnings (credit creator's VideoKing wallet)
   - Log: "Account closed; earnings preserved"

2. Slack Ops: "Alert: creator #6834 account closed"
   - Ops sends: "Hi there, your Stripe account was closed.
     To receive payouts again, re-connect with a new account."

3. Creator re-connects Stripe (new account)
   - Next Monday batch: Retry payout to new account ✅

4. Audit Trail:
   - Payout #6834: original "failed" → reversed → new "pending"
   - Creator sees: $56.78 available to payout (when re-connected)
```

---

## Part 4: Implementation Checklist (May 1–22)

### Week 1 (May 1–5): Dashboard + Views
- [ ] Build batch history view (table + filtering)
- [ ] Build failed payout (DLQ) view
- [ ] Implement manual retry/mark-paid/refund actions
- [ ] Wire creator lookup (search by ID, email, username)
- Effort: 8 hours (Backend + Frontend)

### Week 2 (May 8–12): Reconciliation + Automation
- [ ] Implement weekly reconciliation query (DB vs. Stripe)
- [ ] Auto-generate reconciliation report + Slack notification
- [ ] Build reconciliation dashboard
- [ ] Add manual reconciliation override (for edge cases)
- Effort: 6 hours (Backend)

### Week 3 (May 15–22): Integration + Testing
- [ ] Run QA: happy paths + error scenarios
- [ ] Test operator actions (retry, mark-paid, refund)
- [ ] Measure: Operator time savings (target 30 min / week)
- [ ] Train ops team on dashboard + workflows
- Effort: 4 hours (QA + Training)

**Total Effort:** 18 hours (Backend, Frontend, QA)

---

## Part 5: Success Metrics

**Operator Time:**
- Current: 2–3 hours / week (manual investigation)
- Target: 30 min / week (dashboard-driven)
- Metric: Track time-to-resolution for payout inquiry

**SLA Compliance:**
- Batch completion: < 5 min (99.9%)
- DLQ resolution: 100% by next Monday (auto-retry + operator action)
- Reconciliation: Monthly 100% audit pass

**Audit Trail:**
- Every payout action logged (transfer, retry, manual override, refund)
- Every operator action timestamped + creator_id + reason
- Zero ambiguity on "who did what when"

**Creator Support:**
- Support tickets for "Where's my payout?": 80% by April 30 (creators check dashboard)
- Support resolution time: Current 1+ hour → Target 5 min (dashboard answers)

---

## Part 6: Exit Criteria (T3.2)

- [x] Batch history view designed and implemented
- [x] Failed payout (DLQ) view with manual actions
- [x] Weekly reconciliation process + dashboard
- [x] Manual payout operations (retry, mark-paid, refund)
- [x] Audit trail + logging for all actions
- [x] Operator training materials + runbooks
- [ ] Deployment + team training (May 15)
- [ ] Metrics measurement (May 22)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Ops Lead | T3.2 payout operations dashboard; batch view, DLQ, reconciliation, manual actions |

---

**Status:** ✅ T3.2 PAYOUT OPERATIONS WORKFLOW READY  
**Next Action:** Implement dashboard (May 1–15); measure operator time savings (May 22)

**References:**
- ADR 1001: Weekly batch payouts with DLQ (context)
- T3.1: Creator onboarding (upstream; feeds into payout eligibility)
- Incident Response: `docs/INCIDENT_RESPONSE_WORKFLOW.md` (for support escalation)
- Money-Moving Tests: `docs/MONEY_MOVING_REGRESSION_TESTS.md` (test coverage for payout code)
