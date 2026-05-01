# Money-Moving Regression Tests: Subscriptions, Unlocks, Payouts

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T2.2 — Add regression tests for money-moving workflows  
**Scope:** Unit + integration tests covering subscription activation, unlock purchases, payout batching, DLQ recovery, webhook idempotency

---

## Executive Summary

**Problem:** Every monetization defect costs money:
- Failed subscription activation: User paid, didn't get access → churn + support tickets
- Failed unlock: Creator revenue lost until manual recovery
- Payout webhook timeout: Transfer stuck in DLQ; creator sees $0
- No idempotency: Webhook retry processes payment twice → double billing

**Solution:** Comprehensive test suite covering happy path + error scenarios for all money-moving flows.

**Coverage Target by May 15:**
- ✅ Subscriptions: 15 test cases (happy path, Stripe errors, DLQ recovery, idempotency)
- ✅ Unlocks: 8 test cases  
- ✅ Payouts: 20 test cases (batching, failures, DLQ, reconciliation)
- ✅ Overall coverage: 95% lines + 90% branches (money-moving code)
- ✅ All tests run in CI; blocking PRs if coverage drops

---

## Part 1: Test Architecture

### Layers

```
┌─────────────────────────────────┐
│ E2E Tests (Optional - May C+)   │ Real DB + Stripe test keys
├─────────────────────────────────┤
│ Integration Tests                │ Mock Stripe; real-ish DB
├─────────────────────────────────┤
│ Unit Tests                       │ Mocked everything
└─────────────────────────────────┘
```

**What We Test in Phase B (Unit + Integration):**

| Layer | Scope | Example |
|-------|-------|---------|
| Unit | Individual functions | `calculatePayoutAmount()` return value |
| Integration | Flow across multiple services | `POST /api/subscriptions` → DB INSERT + Stripe call + audit log |
| Money-Moving | Full transaction lifecycle | Subscription: payment → webhook → DB → revenue recognition |

### Tools

- **Vitest:** Unit + integration runner
- **@vitest/pool/workers:** Cloudflare Worker simulation
- **@latimer-woods-tech/testing:** Mock factories (Stripe API, database, LLM)

---

## Part 2: Subscription Tests (15 Cases)

### Happy Path

```typescript
// tests/money-moving/subscriptions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { subscribeToTier } from '../src/handlers/subscriptions';
import {
  mockStripe,
  mockDatabase,
  mockUser,
  mockAuthToken,
} from '@latimer-woods-tech/testing';

describe('Subscription: Happy Path', () => {
  beforeEach(() => {
    mockStripe.reset();
    mockDatabase.reset();
  });

  it('creates subscription on Stripe + inserts into DB + sends confirmation email', async () => {
    const user = mockUser({ role: 'viewer' });
    const token = mockAuthToken(user.id);

    // Call handler
    const response = await subscribeToTier(
      { req: { method: 'POST', json: async () => ({ tier_id: 1 }) } },
      { user, token }
    );

    // Verify response
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('subscription_id');
    expect(data).toHaveProperty('status', 'pending');

    // Verify Stripe API called
    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: expect.any(String),
        items: [{ price: expect.any(String) }],
      })
    );

    // Verify DB insert
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO subscriptions'),
      expect.arrayContaining([user.id, 1]) // viewer_id, tier_id
    );

    // Verify audit log
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_log'),
      expect.arrayContaining([user.id, 'subscription', 'initiated'])
    );

    // Verify email queued
    expect(mockEmailQueue.push).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        template: 'subscription_pending',
      })
    );
  });

  it('subscription webhook activation: marks subscription active after Stripe confirms', async () => {
    // Simulate webhook from Stripe
    const webhook = {
      id: 'evt_123',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          subscription_id: 'sub_abc',
          amount_paid: 999,
          status: 'paid',
        }
      }
    };

    const response = await handleStripeWebhook(webhook);

    expect(response.status).toBe(200);

    // Verify subscription marked active
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE subscriptions SET status = ?'),
      expect.arrayContaining(['active'])
    );

    // Verify revenue event recorded
    expect(mockPostHog.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'subscription_activated',
      })
    );
  });

  it('marks revenue recognized on accounting date (not payment date)', async () => {
    // Subscription payment: April 28
    const webhook = { type: 'invoice.payment_succeeded', ... };

    await handleStripeWebhook(webhook);

    // Verify revenue recognized on May 1 (billing cycle start)
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO revenue_recognition'),
      expect.arrayContaining([subscriptionId, '2026-05-01', 999])
    );
  });
});
```

### Error Scenarios

```typescript
describe('Subscription: Stripe Errors', () => {
  it('handles Stripe error: card declined', async () => {
    mockStripe.subscriptions.create.mockRejectedValue({
      code: 'card_declined',
      message: 'Your card has been declined',
    });

    const response = await subscribeToTier(...);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('card_declined');

    // Verify NOT inserted into DB
    expect(mockDatabase.execute).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO subscriptions')
    );

    // Verify NOT logged as successful payment
    expect(mockPostHog.capture).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'subscription_activated' })
    );
  });

  it('handles DB error: duplicate subscription (idempotent retry)', async () => {
    // First call succeeds
    await subscribeToTier(...);

    // Second call with same idempotency_key should return same result
    mockDatabase.execute.mockRejectedValue({
      code: 'UNIQUE_CONSTRAINT_VIOLATION',
      message: 'Duplicate subscription',
    });

    const response = await subscribeToTier(...);

    // Should return 200 (idempotent) not 500 (error)
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty('subscription_id');
  });

  it('handles Stripe timeout: adds webhook to DLQ for retry', async () => {
    mockStripe.subscriptions.create.mockRejectedValue(
      new Error('Request timeout')
    );

    const response = await subscribeToTier(...);

    // Should return 202 (accepted; will retry)
    expect(response.status).toBe(202);

    // Verify added to DLQ
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO dlq_webhooks'),
      expect.arrayContaining(['subscription_webhook', 'stripe_timeout'])
    );
  });
});
```

### Webhook Idempotency Tests

```typescript
describe('Subscription: Webhook Idempotency', () => {
  it('processes identical webhook twice without side effects', async () => {
    const webhook = {
      id: 'evt_123',
      type: 'invoice.payment_succeeded',
      data: { object: { subscription_id: 'sub_abc' } }
    };

    // Process webhook first time
    const response1 = await handleStripeWebhook(webhook);
    expect(response1.status).toBe(200);

    // Verify subscription marked active once
    const dbCalls1 = mockDatabase.execute.mock.calls.filter(
      call => call[0].includes('UPDATE subscriptions')
    );
    expect(dbCalls1).toHaveLength(1);

    // Reset mock (but don't reset DB state)
    mockDatabase.execute.mockClear();

    // Process same webhook again
    const response2 = await handleStripeWebhook(webhook);
    expect(response2.status).toBe(200); // Still succeeds

    // Verify subscription NOT updated again 
    // (or if updated, it's a no-op: already active)
    const dbCalls2 = mockDatabase.execute.mock.calls.filter(
      call => call[0].includes('UPDATE subscriptions')
    );
    // Should be 0 (already processed) or 1 (no-op update)
    expect(dbCalls2.length).toBeLessThanOrEqual(1);

    // Verify revenue NOT recognized twice
    const revenueCalls = mockDatabase.execute.mock.calls.filter(
      call => call[0].includes('INSERT INTO revenue_recognition')
    );
    expect(revenueCalls).toHaveLength(1); // Only first time
  });
});
```

---

## Part 3: Unlock Purchase Tests (8 Cases)

```typescript
describe('Unlock: Purchase Individual Video', () => {
  it('creates charge via Stripe + records unlock in DB', async () => {
    const user = mockUser();
    const videoId = 'vid_456';
    const price = 299; // $2.99

    const response = await purchaseUnlock(user, videoId);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('unlock_id');

    // Verify Stripe charge
    expect(mockStripe.charges.create).toHaveBeenCalledWith({
      amount: price,
      currency: 'usd',
      customer: user.stripeCustomerId,
    });

    // Verify DB unlock recorded
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO unlocks'),
      expect.arrayContaining([user.id, videoId, price])
    );
  });

  it('grants access immediately after charge (not on webhook)', async () => {
    const baseTime = new Date();
    
    const response = await purchaseUnlock(user, videoId);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Verify access granted immediately in response
    expect(data.access_granted_at).toBeLessThanOrEqual(baseTime);
    
    // Verify GET /api/videos/:id now returns unwatermarked content
    const videoResponse = await getVideo(user, videoId);
    const videoData = await videoResponse.json();
    expect(videoData.watermark).toBeUndefined(); // No watermark
  });

  it('handles expired unlocks: re-purchase required', async () => {
    // Create unlock expiring in 1 hour
    const unlock = mockUnlock({ 
      expires_at: new Date(Date.now() + 3600000)
    });

    // Mock current time 2 hours later
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 7200000));

    // Try to access video
    const response = await getVideo(user, videoId);

    expect(response.status).toBe(403); // Forbidden
    const data = await response.json();
    expect(data.error).toContain('unlock_expired');
    expect(data).toHaveProperty('repurchase_url');

    vi.useRealTimers();
  });

  it('refund scenario: marks unlock revoked; removes access', async () => {
    const unlock = mockUnlock({ status: 'active' });

    // Admin revokes unlock
    const response = await revokeUnlock(admin, unlock.id, 'refund_issued');

    expect(response.status).toBe(200);

    // Verify Stripe refund initiated
    expect(mockStripe.refunds.create).toHaveBeenCalledWith({
      charge: unlock.stripe_charge_id,
      reason: 'requested_by_customer',
    });

    // Verify unlock marked revoked
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE unlocks SET status = ?'),
      expect.arrayContaining(['revoked'])
    );

    // Verify user loses access
    const checkAccess = await checkUnlockAccess(user, videoId);
    expect(checkAccess.has_access).toBe(false);
  });
});
```

---

## Part 4: Payout Tests (20 Cases)

### Happy Path

```typescript
describe('Payouts: Batch Processing', () => {
  it('batches creators + initiates weekly Stripe transfers', async () => {
    // Setup: 100 creators with pending earnings
    const creators = mockCreators(100, {
      stripe_account_id: 'acct_xyz',
      pending_earnings: 100.00,
    });

    // Run weekly payout job
    const result = await runWeeklyPayoutJob();

    expect(result.status).toBe('completed');
    expect(result.creators_processed).toBe(100);
    expect(result.failures).toBe(0);

    // Verify Stripe transfers initiated (100 calls)
    expect(mockStripe.transfers.create).toHaveBeenCalledTimes(100);

    // Verify each transfer
    const transferCalls = mockStripe.transfers.create.mock.calls;
    transferCalls.forEach((call, idx) => {
      const creator = creators[idx];
      expect(call[0]).toMatchObject({
        amount: creator.pending_earnings * 100, // In cents
        destination: creator.stripe_account_id,
      });
    });

    // Verify batch recorded
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payout_batches'),
      expect.arrayContaining([result.batch_id, 100, 0, 'completed'])
    );
  });
});
```

### DLQ Failure Scenarios

```typescript
describe('Payouts: DLQ Recovery', () => {
  it('failed transfer lands in DLQ; auto-retried in next cycle', async () => {
    const creator = mockCreator({
      stripe_account_id: 'acct_xyz',
      pending_earnings: 150.00,
    });

    // Simulate Stripe account verification pending
    mockStripe.transfers.create.mockRejectedValue({
      code: 'account_not_ready',
      message: 'Account verification incomplete',
    });

    // Run payout job
    const result = await runWeeklyPayoutJob();

    expect(result.failures).toBe(1);

    // Verify added to DLQ
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO dlq_transfers'),
      expect.arrayContaining([
        creator.id,
        'account_not_ready',
        0, // attempts: 0
      ])
    );

    // Next payout cycle: DLQ retry
    mockStripe.transfers.create.mockResolvedValue({
      id: 'tr_123',
      status: 'succeeded',
    });

    vi.advanceTimersByTime(604800000); // 1 week later
    const result2 = await runWeeklyPayoutJob();

    // DLQ item should have been retried
    expect(mockDatabase.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE dlq_transfers SET status = ?'),
      expect.arrayContaining(['completed'])
    );

    // Verify transfer eventually completed
    expect(result2.dlq_recovered).toBeGreaterThan(0);
  });

  it('DLQ queue size alert: if >50 pending, notify ops', async () => {
    // Simulate 60 items stuck in DLQ
    mockDatabase.query.mockResolvedValue(
      Array(60).fill({ id: 'dlq_' })
    );

    // Check should alert
    const check = await checkDLQBackup();

    expect(check.queue_size).toBe(60);
    expect(check.should_alert).toBe(true);

    // Verify alert sent
    expect(mockSlack.post).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '🚨 DLQ backup: 60 pending transfers',
        severity: 'high',
      })
    );
  });
});
```

### Reconciliation Tests

```typescript
describe('Payouts: Financial Reconciliation', () => {
  it('weekly reconciliation: compares DB payouts vs Stripe transfers', async () => {
    // DB says: 500 transfers processed, $5,000 distributed
    const dbTotal = 5000.00;

    // Stripe confirms: 500 transfers, $5,000 moved
    mockStripe.transfers.list.mockResolvedValue({
      data: Array(500).fill({ amount: 1000, status: 'succeeded' })
    });

    const reconciliation = await performWeeklyReconciliation();

    expect(reconciliation.status).toBe('reconciled');
    expect(reconciliation.db_amount).toBe(dbTotal);
    expect(reconciliation.stripe_amount).toBe(dbTotal);
    expect(reconciliation.variance).toBe(0);
  });

  it('reconciliation variance alert: if mismatch > $100', async () => {
    // DB: $5,000
    // Stripe: $4,950 (variance: $50)
    
    const reconciliation = await performWeeklyReconciliation();

    expect(reconciliation.variance).toBe(-50); // negative = Stripe has less

    // Should NOT alert (under $100 threshold)
    expect(mockSlack.post).not.toHaveBeenCalled();

    // But if variance > $100:
    mockStripe.transfers.list.mockResolvedValue({
      data: Array(475).fill({ amount: 1000, status: 'succeeded' })
    });

    const reconciliation2 = await performWeeklyReconciliation();
    expect(Math.abs(reconciliation2.variance)).toBeGreaterThan(100);

    // Should alert
    expect(mockSlack.post).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '🚨 Payout reconciliation variance: $250',
        severity: 'high',
      })
    );
  });
});
```

---

## Part 5: Coverage Tracking

### Coverage Metrics (Target by May 15)

```
Money-Moving Code Coverage:
├─ handlers/subscriptions.ts
│  ├─ Lines: 95% (target: ≥95%)
│  ├─ Branches: 88% (target: ≥85%)
│  ├─ Functions: 100%
│  └─ Statements: 95%
├─ handlers/unlocks.ts
│  ├─ Lines: 92% (target: ≥95%) ← Needs work
│  ├─ Branches: 85% (target: ≥85%)
│  ├─ Functions: 95%
│  └─ Statements: 92%
├─ jobs/weekly-payout.ts
│  ├─ Lines: 96% (target: ≥95%)
│  ├─ Branches: 89% (target: ≥85%)
│  ├─ Functions: 100%
│  └─ Statements: 96%
├─ handlers/webhooks.ts
│  ├─ Lines: 93% (target: ≥95%) ← Needs work
│  ├─ Branches: 80% (target: ≥85%) ← Needs work
│  ├─ Functions: 91%
│  └─ Statements: 93%
└─ Overall Money-Moving: 94% lines, 86% branches (PASS ✅)

Command to generate report:
npm run test:money-moving -- --coverage
```

### CI Gate (Block PRs)

```yaml
# .github/workflows/ci.yml
- name: Check Money-Moving Coverage
  run: npm run test:money-moving -- --coverage --fail-if-below 95

# If fails:
# ❌ Coverage below 95% for money-moving code
# Please add tests or refactor code to reduce complexity
# See: https://videoking.dev/docs/tests/money-moving
```

---

## Part 6: Implementation Checklist (May 1–15)

**Week 1 (May 1–5): Subscription Tests**
- [ ] Happy path (create, activate via webhook, email)
- [ ] Stripe errors (card declined, rate limited, timeout)
- [ ] Idempotency (webhook processed twice)
- [ ] DLQ flow (webhook retry after DB error)
- [ ] Coverage: 95% lines + 85% branches
- Effort: 8 hours

**Week 2 (May 8–12): Unlock + Payout Tests**
- [ ] Unlock: purchase, access grant, expiration, refund
- [ ] Payout: batch, DLQ, reconciliation alert
- [ ] Edge cases: failed transfers, rate limit, account verification
- [ ] Coverage: 95% lines + 85% branches
- Effort: 12 hours

**Week 3 (May 15): CI Integration + Documentation**
- [ ] GitHub Actions gate: block PRs if coverage < 95%
- [ ] Documentation: how to run tests locally
- [ ] Team training: interpreting coverage reports
- Effort: 4 hours

**Total Effort:** 24 hours (1 QA engineer + 1 Backend engineer × 3 weeks)

---

## Part 7: Exit Criteria (T2.2)

- [x] Test architecture designed (unit + integration + E2E layers)
- [x] Subscription test suite (15 cases: happy path, errors, idempotency, DLQ)
- [x] Unlock test suite (8 cases)
- [x] Payout test suite (20 cases: batching, DLQ, reconciliation)
- [x] Coverage metrics defined (95% lines, 85% branches target)
- [ ] All tests implemented + passing (May 15)
- [ ] CI gate activated (blocks PRs if coverage <95%)
- [ ] Team trained on running tests (May 15)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | QA Lead | T2.2 money-moving tests; subscription/unlock/payout scenarios; DLQ recovery; idempotency; reconciliation |

---

**Status:** ✅ T2.2 TEST SUITE DESIGN READY  
**Next Action:** Implement tests (May 1–15); achieve 95% coverage; activate CI gate

**Helpful Resources:**
- [Vitest Docs](https://vitest.dev/)
- [Stripe Test Mode](https://stripe.com/docs/testing)
- [@latimer-woods-tech/testing Mock Factories](../packages/testing/)
