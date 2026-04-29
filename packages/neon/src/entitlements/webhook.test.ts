/**
 * Tests for Stripe webhook ingestion and entitlement synchronization (W360-005)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  verifyStripeSignature,
  isEventProcessed,
  recordProcessedEvent,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  refreshEntitlements,
  handleStripeWebhook,
  type StripeEvent,
} from './webhook.js';
import type { FactoryDb } from '../index.js';

type DbRow = Record<string, unknown>;

function makeDb(options: { responses?: DbRow[][]; throwAtCall?: number } = {}): FactoryDb {
  const responses = options.responses ?? [];
  let call = 0;

  return {
    execute: vi.fn(() => {
      if (options.throwAtCall !== undefined && call === options.throwAtCall) {
        call += 1;
        return Promise.reject(new Error('db failure'));
      }

      const rows = responses[call] ?? [];
      call += 1;
      return { rows, rowCount: rows.length };
    }),
  } as unknown as FactoryDb;
}

function makeSubscription(overrides: Partial<StripeEvent['data']['object']> = {}): StripeEvent['data']['object'] {
  return {
    id: 'sub_123',
    customer: 'cus_123',
    items: { data: [{ price: { id: 'price_basic' } }] },
    status: 'active',
    current_period_start: 1714000000,
    current_period_end: 1716592000,
    trial_end: null,
    canceled_at: null,
    ...overrides,
  };
}

function makeEvent(
  type: StripeEvent['type'],
  overrides: Partial<StripeEvent['data']['object']> = {},
): StripeEvent {
  return {
    id: 'evt_123',
    type,
    created: 1714000000,
    data: { object: makeSubscription(overrides) },
  };
}

async function signPayload(body: string, secret: string, timestamp = '1714000000'): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const payload = `${timestamp}.${body}`;
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `t=${timestamp},v1=${hex}`;
}

describe('verifyStripeSignature', () => {
  it('returns true for a valid signature', async () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const secret = 'whsec_test';
    const signature = await signPayload(body, secret);

    await expect(verifyStripeSignature(body, signature, secret)).resolves.toBe(true);
  });

  it('returns false for malformed signature header', async () => {
    await expect(verifyStripeSignature('{"x":1}', 'v1=abc', 'whsec_test')).resolves.toBe(false);
  });

  it('returns false for invalid signature', async () => {
    const body = JSON.stringify({ id: 'evt_1' });
    const signature = await signPayload(body, 'whsec_good');
    await expect(verifyStripeSignature(body, signature, 'whsec_bad')).resolves.toBe(false);
  });
});

describe('idempotency helpers', () => {
  it('isEventProcessed returns true when a row exists', async () => {
    const db = makeDb({ responses: [[{ one: 1 }]] });
    await expect(isEventProcessed(db, 'evt_123')).resolves.toBe(true);
  });

  it('isEventProcessed returns false on db error', async () => {
    const db = makeDb({ throwAtCall: 0 });
    await expect(isEventProcessed(db, 'evt_123')).resolves.toBe(false);
  });

  it('recordProcessedEvent swallows db errors', async () => {
    const db = makeDb({ throwAtCall: 0 });
    await expect(recordProcessedEvent(db, 'evt_123', 'customer.subscription.created')).resolves.toBeUndefined();
  });
});

describe('handleSubscriptionCreated', () => {
  it('creates a subscription for an existing customer and refreshes entitlements', async () => {
    const db = makeDb({
      responses: [
        [
          {
            id: 'plan_1',
            included_credits: 50,
            monthly_render_quota: 100,
            max_video_seconds: 300,
            max_retries_per_job: 3,
            public_publish_allowed: true,
          },
        ],
        [{ id: 'cust_1' }],
        [],
        [],
        [
          {
            monthly_render_quota: 100,
            max_video_seconds: 300,
            max_retries_per_job: 3,
            public_publish_allowed: true,
          },
        ],
        [{ total: '25' }],
        [{ status: 'active' }],
        [{ suspension_status: 'active' }],
        [],
      ],
    });

    await expect(handleSubscriptionCreated(db, makeEvent('customer.subscription.created'))).resolves.toBeUndefined();
    expect((db.execute as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(9);
  });

  it('creates customer when missing', async () => {
    const db = makeDb({
      responses: [
        [
          {
            id: 'plan_1',
            included_credits: 25,
            monthly_render_quota: null,
            max_video_seconds: 120,
            max_retries_per_job: 2,
            public_publish_allowed: false,
          },
        ],
        [],
        [],
        [],
        [],
        [
          {
            monthly_render_quota: null,
            max_video_seconds: 120,
            max_retries_per_job: 2,
            public_publish_allowed: false,
          },
        ],
        [{ total: '5' }],
        [{ status: 'active' }],
        [{ suspension_status: 'active' }],
        [],
      ],
    });

    await expect(handleSubscriptionCreated(db, makeEvent('customer.subscription.created'))).resolves.toBeUndefined();
  });

  it('throws when plan does not exist', async () => {
    const db = makeDb({ responses: [[]] });
    await expect(handleSubscriptionCreated(db, makeEvent('customer.subscription.created'))).rejects.toThrow('unknown Stripe price');
  });

  it('throws when event has no price', async () => {
    const db = makeDb();
    const event = makeEvent('customer.subscription.created', { items: { data: [] } });
    await expect(handleSubscriptionCreated(db, event)).rejects.toThrow('no price found');
  });
});

describe('handleSubscriptionUpdated', () => {
  it('updates subscription and refreshes entitlements when plan is found', async () => {
    const db = makeDb({
      responses: [
        [{ customer_id: 'cust_1' }],
        [{ id: 'plan_2' }],
        [],
        [
          {
            monthly_render_quota: 100,
            max_video_seconds: 300,
            max_retries_per_job: 3,
            public_publish_allowed: true,
          },
        ],
        [{ total: '10' }],
        [{ status: 'active' }],
        [{ suspension_status: 'active' }],
        [],
      ],
    });

    await expect(handleSubscriptionUpdated(db, makeEvent('customer.subscription.updated'))).resolves.toBeUndefined();
  });

  it('throws when subscription does not exist', async () => {
    const db = makeDb({ responses: [[]] });
    await expect(handleSubscriptionUpdated(db, makeEvent('customer.subscription.updated'))).rejects.toThrow('not found');
  });
});

describe('handleSubscriptionDeleted', () => {
  it('marks subscription canceled and refreshes entitlements', async () => {
    const db = makeDb({
      responses: [
        [{ id: 'sub_db_1', customer_id: 'cust_1', plan_id: 'plan_1' }],
        [],
        [
          {
            monthly_render_quota: 100,
            max_video_seconds: 300,
            max_retries_per_job: 3,
            public_publish_allowed: true,
          },
        ],
        [{ total: '0' }],
        [],
        [{ suspension_status: 'active' }],
        [],
      ],
    });

    await expect(handleSubscriptionDeleted(db, makeEvent('customer.subscription.deleted'))).resolves.toBeUndefined();
  });

  it('throws when subscription does not exist', async () => {
    const db = makeDb({ responses: [[]] });
    await expect(handleSubscriptionDeleted(db, makeEvent('customer.subscription.deleted'))).rejects.toThrow('not found');
  });
});

describe('refreshEntitlements', () => {
  it('computes entitlements with active subscription and positive credits', async () => {
    const db = makeDb({
      responses: [
        [
          {
            monthly_render_quota: 100,
            max_video_seconds: 180,
            max_retries_per_job: 5,
            public_publish_allowed: true,
          },
        ],
        [{ total: '42' }],
        [{ status: 'active' }],
        [{ suspension_status: 'active' }],
        [],
      ],
    });

    await expect(refreshEntitlements(db, 'cust_1', 'plan_1')).resolves.toBeUndefined();
  });

  it('falls back to active subscription lookup when no planId provided', async () => {
    const db = makeDb({
      responses: [
        [{ plan_id: 'plan_1' }],
        [
          {
            monthly_render_quota: null,
            max_video_seconds: 300,
            max_retries_per_job: 3,
            public_publish_allowed: false,
          },
        ],
        [{ total: '0' }],
        [{ status: 'trialing' }],
        [{ suspension_status: 'active' }],
        [],
      ],
    });

    await expect(refreshEntitlements(db, 'cust_2')).resolves.toBeUndefined();
  });
});

describe('handleStripeWebhook', () => {
  const secret = 'whsec_test';

  it('returns 400 when signature header is missing', async () => {
    const db = makeDb();
    const result = await handleStripeWebhook('{}', undefined, db, secret);
    expect(result.statusCode).toBe(400);
  });

  it('returns 401 when signature verification fails', async () => {
    const db = makeDb();
    const result = await handleStripeWebhook('{"id":"evt_1"}', 't=1,v1=bad', db, secret);
    expect(result.statusCode).toBe(401);
  });

  it('returns 400 on invalid JSON with valid signature', async () => {
    const db = makeDb();
    const body = '{"id":';
    const signature = await signPayload(body, secret);

    const result = await handleStripeWebhook(body, signature, db, secret);
    expect(result.statusCode).toBe(400);
  });

  it('returns duplicate acknowledgement for already-processed event', async () => {
    const event = makeEvent('customer.subscription.created');
    const body = JSON.stringify(event);
    const signature = await signPayload(body, secret);
    const db = makeDb({ responses: [[{ one: 1 }]] });

    const result = await handleStripeWebhook(body, signature, db, secret);
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('duplicate');
  });

  it('returns acknowledged for unknown event type and records it', async () => {
    const event = { ...makeEvent('customer.subscription.created'), type: 'invoice.paid' } as unknown as StripeEvent;
    const body = JSON.stringify(event);
    const signature = await signPayload(body, secret);
    const db = makeDb({ responses: [[], []] });

    const result = await handleStripeWebhook(body, signature, db, secret);
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('acknowledged');
  });

  it('returns handler error as acknowledged response', async () => {
    const event = makeEvent('customer.subscription.created', { items: { data: [] } });
    const body = JSON.stringify(event);
    const signature = await signPayload(body, secret);
    const db = makeDb({ responses: [[]] });

    const result = await handleStripeWebhook(body, signature, db, secret);
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('error');
  });
});
