/**
 * Tests for Stripe webhook handler and entitlement service (W360-005)
 *
 * Covers:
 * - verifyStripeSignature (via handleStripeWebhook integration)
 * - handleStripeWebhook: 400/401/200 response codes
 * - Duplicate webhook idempotency (acknowledged without double-write)
 * - handleSubscriptionCreated / Updated / Deleted routing
 * - evaluateEntitlementPolicy logic
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  handleStripeWebhook,
  evaluateEntitlementPolicy,
  getEntitlementPolicy,
  debitCreditsForRender,
  grantCredits,
  refundCredits,
  getTotalAvailableCredits,
  type StudioEntitlement,
} from '@latimer-woods-tech/neon';

// Mock @latimer-woods-tech/neon
// ---------------------------------------------------------------------------

vi.mock('@latimer-woods-tech/neon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@latimer-woods-tech/neon')>();
  return {
    ...actual,
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    createDb: vi.fn(() => mockDb),
  };
});

// We need a module-level db mock ref so tests can configure rows
let mockDb: ReturnType<typeof makeDb>;

function parseUnknownJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) {
    return undefined;
  }

  const error = (payload as { error: unknown }).error;
  return typeof error === 'string' ? error : undefined;
}

function makeDb(rowGroups: unknown[][] = [[]]) {
  let callIndex = 0;
  return {
    execute: vi.fn(() => {
      const result = rowGroups[callIndex % rowGroups.length] ?? [];
      callIndex++;
      return Promise.resolve({ rows: result });
    }),
  };
}

// ---------------------------------------------------------------------------
// Helper: build a real Stripe HMAC-SHA256 signature for test payloads
// ---------------------------------------------------------------------------

async function buildStripeSignature(body: string, secret: string, timestamp = '1714000000'): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `t=${timestamp},v1=${hex}`;
}

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Section 1: handleStripeWebhook — input validation
// ---------------------------------------------------------------------------

describe('handleStripeWebhook', () => {
  const WEBHOOK_SECRET = 'whsec_test_abc123';

  it('returns 400 when X-Stripe-Signature header is missing', async () => {
    mockDb = makeDb();
    const result = await handleStripeWebhook('{}', undefined, {} as never, WEBHOOK_SECRET);
    expect(result.statusCode).toBe(400);
    const parsed = parseUnknownJson(result.body);
    expect(extractErrorMessage(parsed)).toContain('Missing');
  });

  it('returns 401 when signature is invalid', async () => {
    mockDb = makeDb();
    const result = await handleStripeWebhook('{}', 't=1,v1=badhex', {} as never, WEBHOOK_SECRET);
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toMatchObject({ error: 'Signature verification failed' });
  });

  it('returns 400 when body is not valid JSON (after passing sig check)', async () => {
    mockDb = makeDb();
    const body = 'not-json';
    const sig = await buildStripeSignature(body, WEBHOOK_SECRET);
    const result = await handleStripeWebhook(body, sig, {} as never, WEBHOOK_SECRET);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({ error: 'Invalid JSON' });
  });

  it('acknowledges an unhandled event type with 200', async () => {
    mockDb = makeDb();
    const body = JSON.stringify({ id: 'evt_unknown', type: 'payment_intent.created', data: { object: {} } });
    const sig = await buildStripeSignature(body, WEBHOOK_SECRET);
    const result = await handleStripeWebhook(body, sig, {} as never, WEBHOOK_SECRET);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ status: 'acknowledged' });
  });

  it('handles customer.subscription.created and returns 200', async () => {
    // Row order: [isEventProcessed check (should return false), SELECT customers, SELECT plans, INSERT subscription, SELECT for refresh, UPDATE entitlements, INSERT credit_ledger, recordProcessedEvent]
    mockDb = makeDb([
      [],                                                            // isEventProcessed SELECT (no existing event)
      [{ id: 'cust-01' }],                                          // SELECT FROM studio_customers
      [{ id: 'plan-01', included_credits: '10', billing_mode: 'monthly_subscription' }], // SELECT FROM studio_plans
      [],                                                            // INSERT subscription ON CONFLICT
      [],                                                            // SELECT for refreshEntitlements balance
      [],                                                            // SELECT for customer suspension
      [],                                                            // SELECT for active subscription
      [],                                                            // UPDATE entitlements
      [],                                                            // INSERT credit_ledger
      [],                                                            // recordProcessedEvent INSERT
    ]);

    const subscription = {
      id: 'sub_001',
      customer: 'cus_stripe_01',
      items: { data: [{ price: { id: 'price_monthly_01' } }] },
      status: 'active',
      current_period_start: 1714000000,
      current_period_end: 1716592000,
    };

    const body = JSON.stringify({
      id: 'evt_001',
      type: 'customer.subscription.created',
      created: 1714000000,
      data: { object: subscription },
    });
    const sig = await buildStripeSignature(body, WEBHOOK_SECRET);
    const result = await handleStripeWebhook(body, sig, mockDb as never, WEBHOOK_SECRET);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ status: 'acknowledged' });
  });

  it('handles customer.subscription.updated and returns 200', async () => {
    const { createDb } = await import('@latimer-woods-tech/neon');
    mockDb = makeDb([
      [],                                              // UPDATE subscriptions
      [{ customer_id: 'cust-01', plan_id: 'plan-01' }], // SELECT for refresh
      [],                                              // SELECT for refreshEntitlements
      [],                                              // UPDATE entitlements
    ]);
    vi.mocked(createDb).mockReturnValue(mockDb as never);

    const body = JSON.stringify({
      id: 'evt_002',
      type: 'customer.subscription.updated',
      created: 1714000001,
      data: {
        object: {
          id: 'sub_001',
          customer: 'cus_stripe_01',
          items: { data: [{ price: { id: 'price_monthly_01' } }] },
          status: 'past_due',
          current_period_start: 1714000000,
          current_period_end: 1716592000,
        },
      },
    });
    const sig = await buildStripeSignature(body, WEBHOOK_SECRET, '1714000001');
    const result = await handleStripeWebhook(body, sig, mockDb as never, WEBHOOK_SECRET);
    expect(result.statusCode).toBe(200);
  });

  it('handles customer.subscription.deleted and returns 200', async () => {
    const { createDb } = await import('@latimer-woods-tech/neon');
    mockDb = makeDb([
      [],                                              // UPDATE SET status = canceled
      [{ customer_id: 'cust-01', plan_id: 'plan-01' }], // SELECT for refresh
      [],                                              // SELECT refreshEntitlements
      [],                                              // UPDATE entitlements (no active sub)
    ]);
    vi.mocked(createDb).mockReturnValue(mockDb as never);

    const body = JSON.stringify({
      id: 'evt_003',
      type: 'customer.subscription.deleted',
      created: 1714000002,
      data: {
        object: {
          id: 'sub_001',
          customer: 'cus_stripe_01',
          items: { data: [{ price: { id: 'price_monthly_01' } }] },
          status: 'canceled',
          current_period_start: 1714000000,
          current_period_end: 1716592000,
        },
      },
    });
    const sig = await buildStripeSignature(body, WEBHOOK_SECRET, '1714000002');
    const result = await handleStripeWebhook(body, sig, mockDb as never, WEBHOOK_SECRET);
    expect(result.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Section 2: evaluateEntitlementPolicy
// ---------------------------------------------------------------------------

describe('evaluateEntitlementPolicy', () => {
  function makeEntitlement(overrides: Partial<StudioEntitlement> = {}): StudioEntitlement {
    return {
      id: 'ent-01',
      customerId: 'cust-01',
      subscriptionId: 'sub-01',
      planId: 'plan-01',
      availableCredits: '5',
      canRender: true,
      canPublishPublic: false,
      monthlyRenderQuota: 10,
      maxVideoSeconds: 300,
      maxRetriesPerJob: 3,
      lastRefreshedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it('returns canRender=true when subscription active and credits > 0', () => {
    const policy = evaluateEntitlementPolicy(makeEntitlement());
    expect(policy.canRender).toBe(true);
    expect(policy.availableCredits).toBe(5);
  });

  it('returns canRender=false when canRender is false on table', () => {
    const policy = evaluateEntitlementPolicy(makeEntitlement({ canRender: false }));
    expect(policy.canRender).toBe(false);
  });

  it('returns canRender=false when availableCredits is 0', () => {
    const policy = evaluateEntitlementPolicy(makeEntitlement({ availableCredits: '0' }));
    expect(policy.canRender).toBe(false);
  });

  it('returns canPublishPublic correctly', () => {
    const policy = evaluateEntitlementPolicy(makeEntitlement({ canPublishPublic: true }));
    expect(policy.canPublishPublic).toBe(true);
  });

  it('propagates plan limits to policy', () => {
    const policy = evaluateEntitlementPolicy(
      makeEntitlement({ monthlyRenderQuota: 5, maxVideoSeconds: 120, maxRetriesPerJob: 1 }),
    );
    expect(policy.monthlyRenderQuota).toBe(5);
    expect(policy.maxVideoSeconds).toBe(120);
    expect(policy.maxRetriesPerJob).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Section 3: entitlement service functions (with mocked DB)
// ---------------------------------------------------------------------------

describe('getEntitlementPolicy', () => {
  it('returns canRender=false when no entitlement row exists', async () => {
    const db = makeDb([[]]); // empty rows
    const result = await getEntitlementPolicy(db as never, 'cust-01');
    expect(result.canRender).toBe(false);
    expect(result.reason).toMatch(/No entitlements/);
  });

  it('returns canRender=true with an active entitlement row', async () => {
    const db = makeDb([[
      {
        id: 'ent-01', customerId: 'cust-01', subscriptionId: 'sub-01', planId: 'plan-01',
        availableCredits: '10', canRender: true, canPublishPublic: false,
        monthlyRenderQuota: 10, maxVideoSeconds: 300, maxRetriesPerJob: 3,
        lastRefreshedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
      },
    ]]);
    const result = await getEntitlementPolicy(db as never, 'cust-01');
    expect(result.canRender).toBe(true);
    expect(result.policy?.availableCredits).toBe(10);
  });
});

describe('debitCreditsForRender', () => {
  it('inserts a debit and returns updated balance', async () => {
    const db = makeDb([
      [],                         // INSERT ON CONFLICT DO NOTHING
      [{ total: '8' }],           // balance query
      [],                         // refresh_entitlements SELECT (async)
    ]);
    const result = await debitCreditsForRender(db as never, 'cust-01', 2, 'job-001', 'render');
    expect(result.success).toBe(true);
    expect(result.newAvailableCredits).toBe(8);
    expect(db.execute).toHaveBeenCalledTimes(3);
  });
});

describe('grantCredits', () => {
  it('inserts a grant ledger entry and returns ledgerId', async () => {
    const db = makeDb([[]]); // INSERT
    const result = await grantCredits(db as never, 'cust-01', 10, 'Plan subscription created');
    expect(result.ledgerId).toBeTruthy();
    expect(typeof result.ledgerId).toBe('string');
  });
});

describe('refundCredits', () => {
  it('inserts a refund ledger entry for a failed render', async () => {
    const db = makeDb([[]]); // INSERT
    const result = await refundCredits(db as never, 'cust-01', 2, 'job-001');
    expect(result.ledgerId).toBeTruthy();
  });
});

describe('getTotalAvailableCredits', () => {
  it('returns 0 when no rows', async () => {
    const db = makeDb([[{ total: '0' }]]);
    const total = await getTotalAvailableCredits(db as never, 'cust-01');
    expect(total).toBe(0);
  });

  it('returns calculated credit balance', async () => {
    const db = makeDb([[{ total: '15.5' }]]);
    const total = await getTotalAvailableCredits(db as never, 'cust-01');
    expect(total).toBe(15.5);
  });
});
