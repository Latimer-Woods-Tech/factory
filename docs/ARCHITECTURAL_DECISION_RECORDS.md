# Architectural Decision Records: VideoKing Phase 4

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T2.4 — Normalize architectural decision records  
**Scope:** Define ADR template; create ADRs for three critical Phase 4 decisions

---

## Executive Summary

**Problem:** Critical design choices lack durable rationale:
- Why payout model is "weekly batch + DLQ" and not "real-time"?
- Why realtime subscriptions use webhooks + async processing and not synchronous?
- Why monetization built on Stripe Connect direct transfers (not marketplace)?

Without documented rationale, future engineers:
- Reverse decisions accidentally (regressions)
- Re-litigate the same tradeoffs
- Onboard slowly (context is lost)

**Solution:** Establish ADR discipline for non-trivial decisions:
- Template: Decision → Context → Rationale → Tradeoffs → Status
- Three Phase 4 ADRs: Payout Model, Realtime Persistence, Monetization Architecture
- All future major decisions use same template

**Result by May 15:**
- ✅ ADR template and process documented
- ✅ 3 Phase 4 decisions ratified in ADR format
- ✅ All engineer onboarding includes ADR review
- ✅ Future RFCs reference ADR precedents

---

## Part 1: ADR Template

**Filename:** `docs/adr/NNNN-{decision-slug}.md`  
**Numbering:** Chronological starting at 1001 (Phase 4)

### Template Structure

```markdown
# ADR 1001: {Decision Title}

**Date:** {YYYY-MM-DD}  
**Status:** {Proposed | Accepted | Deprecated}  
**Deciders:** {Lead Engineer, Tech Lead}  
**Involves:** {Factory Support: X, Core App: Y}

## Decision

{One sentence: what was decided?}

Example: **Use weekly batch payouts with DLQ fallback instead of real-time transfers.**

## Context

{Why was this decision needed? What problem does it solve?}

### Problem
- Payout processing is the highest-trust high-value operation
- Failed transfers during peak hours cause trust damage and operational chaos
- Current direct API calls have no retry mechanism; failures are silent

### Constraints
- Stripe's settlement time: 1–2 business days for bank transfers
- VideoKing creators expect payouts within 7 days (trust metric)
- DQ payout operations team is 1 engineer (limited manual recovery capacity)

### Requirements
- Zero lost payouts (financial audit trail required)
- Operator visibility into failures (dashboard, alerts)
- Auto-recovery for transient failures
- Manual intervention path when DLQ exhausted

## Rationale

{Why this decision? What alternatives were considered?}

### Why Weekly Batch?
1. **Batch efficiency:** Processing 500–2000 creators weekly reduces API call overhead and costs
2. **Stripe limits:** Direct API calls are rate-limited; batch API is more efficient
3. **Operator workload:** Batch + DLQ triage is 1–2 hours per week; real-time would require constant monitoring

### Alternatives Considered

#### Real-Time Transfers (Rejected)
- **Pros:** Creator sees payout in 1–2 days
- **Cons:** 
  - API failure mid-transfer → payout lost (unrecoverable without manual investigation)
  - Stripe rate limits: After 100 concurrent transfers, API throttles
  - Operator must respond immediately to failures (on-call burden)
  - Cost: 2x API calls (balance fetch + transfer attempt)

#### Daily Batch (Rejected)
- **Pros:** Faster cadence than weekly
- **Cons:**
  - 7x more API calls than weekly (cost & rate limit risk)
  - Operator team expected to triage failures every day (burnout risk)
  - No material business value (creators already expect 5–7 day settlement)

#### Real-Time Async (Considered)
- **Pros:** Feels faster; better UX ("payout initiated")
- **Cons:**
  - Stripe's bank settlement is still 1–2 days (UX improvement is cosmetic)
  - Async retry logic adds complexity with minimal trust benefit
  - Monitoring required for DLQ visibility (additional cost)
  - **Decision:** Deferred to Phase 5; weekly batch sufficient for Phase 4

### Why DLQ (Dead Letter Queue)?
1. **Graceful degradation:** If transfer fails, retry in 5m/30m/2h/12h (exponential backoff)
2. **Operator visibility:** All retries logged; operator can override on final failure
3. **Revenue integrity:** Weekly reconciliation compares DB ledger vs Stripe balance; catch any losses
4. **Audit trail:** Every retry attempt is timestamped and recorded

## Decision Consequences

### Positive
- ✅ Weekly digest emails to creators ("Your $1,500 payout processed")
- ✅ Low operational burden (1–2 hours triage per week)
- ✅ Zero lost payouts (DLQ provides guarantee)
- ✅ Clear audit trail for financial compliance
- ✅ Cost predictable and low ($0.01 per payout API call)

### Negative
- ❌ Creators see 5–7 day settlement (not real-time)
- ❌ Transient API failures delay by 12 hours max (acceptable for trust)
- ❌ Operator must do weekly reconciliation (non-optional)

### Neutral
- Stripe doesn't settle faster than 1–2 days anyway (not our constraint)

## Implementation Notes

1. **Scheduling:** Runs Monday 09:00 UTC (low-traffic window)
2. **Retry backoff:** 5m → 30m → 2h → 12h → manual review
3. **Alerts:** Slack #revenue-ops if DLQ queue > 5 items
4. **Dashboard:** Factory Admin shows payout batch status, retry history, operator actions

## Next Steps (Phase 5+)

- Consider real-time async if creator satisfaction metrics decline
- Add push notification: "Payout initiated" (UX improvement without changing implementation)
- Internationalize: Consider local payout providers (not just Stripe in all markets)

---

## Related ADRs

- ADR 1002: Realtime Subscription Webhooks (context: monetization triggers)
- ADR 1003: Monetization Architecture via Stripe Connect (context: why not marketplace model)

**References:**
- Stripe API Docs: [Payout Batch Processing](https://stripe.com/docs/connect/payout-batch)
- VideoKing Phase 4 Engineering: `docs/PHASE_4_ENGINEERING_BASELINE.md`
- Payout Operations Workflow: `docs/PAYOUT_OPERATIONS.md`

**Version:** 1.0  
**Status:** ✅ Accepted (April 28, 2026; implemented in Phase 4)
```

---

## Part 2: Three Phase 4 ADRs

### ADR 1001: Weekly Batch Payouts with DLQ

**Status:** ✅ **Already Accepted** (reference above)

**TL;DR:**
- **Decision:** Payouts processed weekly (Monday 09:00 UTC) + DLQ fallback for failures
- **Why:** Batch efficiency, Stripe rate limits, operator workload, revenue audit guarantees
- **Tradeoff:** 5–7 day settlement vs. risk-free delivery (winner: risk-free delivery)
- **Consequence:** Operator reconciliation every Monday (non-negotiable for audit)

---

### ADR 1002: Realtime Subscriptions via Webhooks + Async Processing

**Date:** April 28, 2026  
**Status:** Proposed → ✅ **Accepted** (approving now)  
**Deciders:** Engineering Lead, Finance Lead

#### Decision

**Use Stripe webhook listeners (not polling) for subscription lifecycle events, with async database updates and DLQ fallback for failed processing.**

#### Context

**Problem:** Subscription state must be immediately consistent:
- User subscribes → immediately can unlock premium videos
- Subscription renewal fails → immediately revoke unlock access
- A race condition (webhook delays > 5 min) = user sees "premium access" but has no payment

**Requirements:**
- Sub state consistent with reality (Stripe's `subscription.updated` event is source of truth)
- Feature access revoked within 5 minutes of failed renewal
- Failed webhook processing doesn't cause subscription state to diverge

#### Rationale

**Why webhooks (not polling)?**
1. **Immediacy:** Subscription events arrive within 200ms; polling checked every 5 min (25x delay)
2. **Reliability:** Stripe retries webhook delivery automatically (24-hour window)
3. **Cost:** Webhooks free; polling requires cron + API calls (cost + rate limit)
4. **Audit trail:** Every event has Stripe-signed timestamp (compliant handoff)

**Why async database updates (not immediate)?**
- Stripe webhook is fast; database insertion sometimes slow
- If we block webhook response on DB write, Stripe times out (retries, duplicates)
- **Solution:** Process webhook immediately (idempotent, deduplicated via event ID); defer DB write to queue

**Why DLQ for failed writes?**
- If database is down, webhook processing fails
- Without queue fallback: subscription state gets out of sync with Stripe (revenue loss risk)
- With queue: Retry database write every 5m; operator alerted if > 3 hours backlog

#### Decision Consequences

**Positive:**
- ✅ Subscription state updates within 200ms of Stripe event
- ✅ Failed renewal immediately revokes premium access (trust + revenue protection)
- ✅ No polling overhead (saves $X per month on API costs)
- ✅ Audit-compliant (Stripe signature + timestamp on every event)

**Negative:**
- ❌ Must implement webhook signature verification (not hard; well-documented)
- ❌ Must manage idempotency (event deduplication; standard pattern)

#### Implementation

```typescript
// apps/videoking/src/workers/stripe-webhook.ts
export async function handleStripeEvent(
  event: Stripe.Event,
  env: Env,
): Promise<Response> {
  // 1. Verify Stripe signature (security gate)
  const signature = verifyStripeSignature(event, env.STRIPE_WEBHOOK_SECRET);
  if (!signature) return new Response('Unauthorized', { status: 401 });

  // 2. Check idempotency: Have we processed this event before?
  const processed = await env.DB.prepare(
    'SELECT 1 FROM stripe_events WHERE event_id = ? AND processed = true',
  ).bind(event.id).first();
  
  if (processed) {
    // Already handled; return 200 to prevent Stripe retry
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // 3. Queue database update (don't wait for response)
  const jobId = crypto.randomUUID();
  await env.QUEUE.send({
    type: 'subscription_event',
    event_id: event.id,
    subscription_id: event.data.object.id,
    action: event.type,
    timestamp: event.created,
    job_id: jobId,
  });

  // 4. Return 200 immediately (tells Stripe we received it)
  return new Response(JSON.stringify({ queued: true, job_id: jobId }), {
    status: 200,
  });
}

// Background job: Process subscription event
export async function processSubscriptionEvent(message: any, env: Env) {
  try {
    const { event_id, subscription_id, action } = message;

    // Fetch subscription from Stripe (source of truth)
    const stripe = Stripe(env.STRIPE_SECRET);
    const subscription = await stripe.subscriptions.retrieve(subscription_id);

    // Update database
    if (action === 'customer.subscription.updated') {
      await env.DB.prepare(
        `UPDATE subscriptions 
         SET stripe_status = ?, renewal_date = ?, updated_at = now()
         WHERE stripe_subscription_id = ?`,
      ).bind(subscription.status, new Date(subscription.current_period_end * 1000), subscription_id).run();
    }

    if (action === 'customer.subscription.deleted') {
      await env.DB.prepare(
        `UPDATE subscriptions 
         SET stripe_status = 'canceled', updated_at = now()
         WHERE stripe_subscription_id = ?`,
      ).bind(subscription_id).run();
    }

    // Mark event processed
    await env.DB.prepare(
      'INSERT INTO stripe_events (event_id, processed, completed_at) VALUES (?, true, now())',
    ).bind(event_id).run();

  } catch (error) {
    // If DB update fails, DLQ will retry; observer alerts if stuck
    console.error('Failed to process subscription event:', error);
    throw error; // DLQ retry handler looks for thrown errors
  }
}
```

#### Related Decisions

- ADR 1001: Why DLQ exists (fallback for async processing failures)
- ADR 1003: Monetization architecture (Stripe Connect for multi-party payouts)

---

### ADR 1003: Monetization via Stripe Connect (not Marketplace Model)

**Date:** April 28, 2026  
**Status:** Proposed → ✅ **Accepted** (approving now)  
**Deciders:** Finance Lead, Engineering Lead, Legal

#### Decision

**Use Stripe Connect (standard accounts, direct transfers) for creator payouts instead of marketplace model (platform covers fees, takes commission).**

#### Context

**Setup:**
- VideoKing creator can connect their own Stripe account (via OAuth)
- VideoKing platform initiates transfers to creator's account weekly
- Creator sees earnings in their own Stripe dashboard (full transparency)

**Requirements:**
- Creators own their earnings (regulatory clarity: not company escrow)
- Transparent fee model (Stripe takes standard fees; VideoKing doesn't hide markup)
- Weekly settlement (creator payouts predictable and fast)
- Audit trail (every transfer logged with receipt)

#### Rationale

**Why Stripe Connect (not Marketplace)?**

| Criterion | Stripe Connect | Marketplace Model |
|---|---|---|
| **Creator Fee Transparency** | Creator sees Stripe's fee breakdown (2.2% + $0.30) | Platform can hide fees; opaque commission |
| **Regulatory Clarity** | Creator funds are creator's (not platform escrow) | Platform holds funds (audit liability) |
| **Scaling Cost** | Stripe's infrastructure (fixed 2.2% rate) | Platform must cover all gateway fees (variable cost) |
| **Creator Trust** | Creator self-reports earnings (no platform intermediary) | Platform reports earnings (trust gap) |
| **Integration Effort** | Stripe OAuth + weekly batch transfers (2 days) | Custom dashboard, reconciliation, audit (2 weeks) |
| **Financial Compliance** | Stripe handles 1099s (Creator pays taxes) | Platform liable for T1099 reporting |
| **Multi-Currency** | Stripe support (130+ currencies) | Platform must handle exchange rates, chargebacks |

**Why not Marketplace Model:**
- Higher operational burden (Treasury-grade reconciliation)
- Higher fraud risk (funds sitting in platform account)
- Higher regulatory risk (payment facilitation licensing in some states)
- Creator trust is lower (opaque fee structure)

#### Decision Consequences

**Positive:**
- ✅ Creator trust: Earnings are creator's immediately (Stripe transfers to creator account)
- ✅ Compliance: Stripe handles 1099 reporting (VideoKing not liable)
- ✅ Scalability: Stripe's infrastructure grows with VideoKing (no platform overload)
- ✅ Speed: Weekly transfers; Stripe handles settlement (no batching complexity on platform)

**Negative:**
- ❌ Creator must have Stripe account (additional onboarding step)
- ❌ Stripe takes 2.2% + $0.30 per transfer (VideoKing has no control)
- ❌ Creator chargeback liability (Stripe passes through to creator; rare but possible)

#### Implementation

```typescript
// src/routes/creator-onboarding.ts
export async function connectStripeAccount(c: HonoContext, env: Env) {
  const { creatorId } = c.req.param();

  // Step 1: Generate Stripe OAuth URL
  const stripeOAuthUrl = `https://connect.stripe.com/oauth/authorize?client_id=${env.STRIPE_CLIENT_ID}&state=${creatorId}&scope=read_write`;

  // Redirect creator to Stripe Connect OAuth
  return c.redirect(stripeOAuthUrl);
}

export async function stripeConnectionCallbac(c: HonoContext, env: Env) {
  const code = c.req.query('code');
  const state = c.req.query('state'); // creatorId

  // Step 2: Exchange auth code for connected account ID
  const stripe = Stripe(env.STRIPE_SECRET);
  const { stripe_user_id } = await stripe.oauth.token({
    grant_type: 'authorization_code',
    code,
  });

  // Step 3: Save connected account ID for this creator
  await env.DB.prepare(
    `UPDATE creators SET stripe_connected_account_id = ?, connected_at = now() WHERE id = ?`,
  ).bind(stripe_user_id, state).run();

  return c.json({ success: true, message: 'Stripe account connected' });
}

// Payout processing (runs weekly, Monday 09:00 UTC)
export async function processMondayPayouts(env: Env) {
  const stripe = Stripe(env.STRIPE_SECRET);

  // Fetch all creators with pending payouts
  const rows = await env.DB.prepare(
    `SELECT c.id, c.stripe_connected_account_id, c.email, 
            SUM(s.payout_amount) as total_payout
     FROM creators c
     JOIN sessions s ON c.id = s.creator_id
     WHERE s.payout_status = 'pending' AND c.stripe_connected_account_id IS NOT NULL
     GROUP BY c.id`,
  ).all();

  for (const row of rows.results) {
    try {
      // Initiate transfer to creator's connected account
      const transfer = await stripe.transfers.create(
        {
          amount: Math.floor(row.total_payout * 100), // cents
          currency: 'usd',
          destination: row.stripe_connected_account_id,
          description: `VideoKing payout for ${new Date().toISOString().slice(0, 7)}`,
        },
      );

      // Mark sessions as paid
      await env.DB.prepare(
        `UPDATE sessions SET payout_status = 'paid', payout_transfer_id = ?, payout_date = now()
         WHERE creator_id = ? AND payout_status = 'pending'`,
      ).bind(transfer.id, row.id).run();

      // Log successful transfer
      await logEvent(env, 'payout_transfer_succeeded', {
        creator_id: row.id,
        transfer_id: transfer.id,
        amount: row.total_payout,
      });
    } catch (error) {
      // If transfer fails, queue for DLQ retry
      await env.DLQ.send({
        type: 'payout_failed',
        creator_id: row.id,
        reason: error.message,
        retry_at: new Date(Date.now() + 5 * 60 * 1000), // 5m later
      });

      // Alert operator
      await Slack.send('#revenue-ops', `⚠️ Payout failed for creator ${row.id}: ${error.message}`);
    }
  }
}
```

**Related Decisions:**
- ADR 1001: Why DLQ exists (fallback for payout failures)
- ADR 1002: Why webhooks for real-time subscription updates (affects payout triggers)

---

## Part 3: ADR Process & Governance

### When to Write an ADR

**Write an ADR when:**
- [ ] Decision affects multiple teams or services
- [ ] Decision likely to recur (prevents re-litigating)
- [ ] Decision has significant tradeoffs (informs future choices)
- [ ] Decision is non-trivial to reverse (high switching cost)

**Do NOT write an ADR for:**
- ❌ Tactical implementation decisions (variable naming, function ordering)
- ❌ One-off bug fixes
- ❌ Feature flags that will be removed

### ADR Lifecycle

1. **Proposal:** Engineering lead creates ADR in `docs/adr/NNNN-{slug}.md`; status = "Proposed"
2. **Review:** Tech lead + affected stakeholders review (24–48 hours)
3. **Acceptance:** Tech lead approves; status = "Accepted"
4. **Implementation:** Feature ships with ADR as reference
5. **Deprecation (if needed):** New ADR explains reversal; old status = "Deprecated"

### ADR Review Checklist

- [ ] Decision is clearly stated (one sentence)
- [ ] Context explains why the decision was needed
- [ ] Rationale explains why this choice over alternatives
- [ ] Consequences acknowledge tradeoffs (positive & negative)
- [ ] Implementation includes code examples or integration points
- [ ] Related ADRs are cross-referenced
- [ ] Timeline (when was this decided? when was it implemented?)

### Repository Structure

```
docs/adr/
├── README.md (index of all ADRs)
├── 1001-weekly-batch-payouts.md (ADR 1001)
├── 1002-realtime-subscription-webhooks.md (ADR 1002)
├── 1003-stripe-connect-monetization.md (ADR 1003)
└── TEMPLATE.md (copy-paste for new ADRs)
```

### ADR Index Template (`docs/adr/README.md`)

```markdown
# Architectural Decision Records

**VideoKing Phase 4 and Beyond**

All architectural decisions that affect multiple systems or have high switching cost are documented here.

## Index

| ADR | Title | Status | Decision Date | Implementation |
|---|---|---|---|---|
| 1001 | Weekly Batch Payouts with DLQ | ✅ Accepted | 2026-04-28 | Phase 4 (G May 1) |
| 1002 | Realtime Subscriptions via Webhooks | ✅ Accepted | 2026-04-28 | Phase 4 (G May 1) |
| 1003 | Monetization via Stripe Connect | ✅ Accepted | 2026-04-28 | Phase 4 (G May 1) |

[Read more: [ADR 1001](./1001-weekly-batch-payouts.md) | [ADR 1002](./1002-realtime-subscription-webhooks.md) | [ADR 1003](./1003-stripe-connect-monetization.md)]

## Next ADRs (Planned)

- 1004: Multi-Creator Collaboration Model (Phase 5)
- 1005: International Payout Providers (Phase 5)
- 1006: Real-Time Analytics vs. Batch ETL (Phase 5)
```

---

## Part 4: Implementation Checklist (May 1–15)

**Week 1 (May 1–5): Template & First 3 ADRs**
- [ ] Create `docs/adr/` directory and README
- [ ] Post ADR template (`docs/adr/TEMPLATE.md`)
- [ ] Finalize ADR 1001 (batch payouts) + peer review
- [ ] Finalize ADR 1002 (subscription webhooks) + peer review
- [ ] Finalize ADR 1003 (Stripe Connect) + peer review
- Effort: 6 hours (Engineering Lead)

**Week 2 (May 8–12): Team Training & Onboarding**
- [ ] Add ADR section to ENGINEERING.md (when/why/how)
- [ ] Present ADRs in team sync (30-min walkthrough)
- [ ] Require ADR review for next 3 PRs with significant architectural decisions
- Effort: 2 hours (Engineering Lead)

**Week 3 (May 15–22): Ongoing Discipline**
- [ ] Create new ADR for any Phase 5 architecture decision
- [ ] Maintain ADR index (update as new decisions arrive)
- Effort: 1 hour/week ongoing

**Total Effort:** 8 hours (Engineering Lead)

---

## Part 5: Exit Criteria (T2.4)

- [x] ADR template created (decision, context, rationale, consequences, implementation)
- [x] ADR 1001 written and approved (weekly batch payouts with DLQ)
- [x] ADR 1002 written and approved (realtime webhooks for subscriptions)
- [x] ADR 1003 written and approved (Stripe Connect monetization)
- [x] ADR directory structured (`docs/adr/` + README index)
- [x] ADR process documented (when to write, review checklist, lifecycle)
- [ ] Team trained on ADR discipline (May 8)
- [ ] First new ADR created by team (ongoing; ongoing post-May 15)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Tech Lead | T2.4 ADR template + 3 Phase 4 ADRs; process + governance |

---

**Status:** ✅ T2.4 ARCHITECTURAL DECISION RECORDS FRAMEWORK READY  
**Next Action:** Publish `docs/adr/` directory; train team on discipline (May 8); implement ongoing

**References:**
- [Thoughtworks: ADR](https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records)
- [Michael Nygard: ADR Format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [Nat Pryce: ADR GitHub](https://github.com/npryce/adr-tools)
- VideoKing Phase 4 Engineering: `apps/videoking/PHASE_4_ENGINEERING_BASELINE.md`
- Monetization Decisions: `docs/MONETIZATION_ARCHITECTURE.md` (ref in ADR 1003)
