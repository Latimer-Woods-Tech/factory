import { describe, expect, it } from 'vitest';

import {
  assertDatabaseState,
  cleanupAfterTest,
  createMockFn,
  createMockCreator,
  createMockDLQEvent,
  createMockEarnings,
  createMockStripeWebhook,
  createTestRequest,
  createTestSubscription,
  createTestTenant,
  createTestUser,
  mockLLM,
  mockNeon,
  mockPostHog,
  mockResend,
  mockSentry,
  mockStripe,
  mockTelnyxWebhook,
  mockVoiceSession,
  randomId,
  seedDatabase,
  type MockStripeWebhookType,
} from './index';

describe('createMockFn', () => {
  it('records calls and returns mocked values', () => {
    const fn = createMockFn<[number, number], number>();
    fn.mockReturnValue(42);
    expect(fn(1, 2)).toBe(42);
    expect(fn.mock.calls).toEqual([[1, 2]]);
    expect(fn.mock.results).toEqual([42]);
  });

  it('uses initial implementation when provided', () => {
    const fn = createMockFn<[number], number>((n) => n * 2);
    expect(fn(3)).toBe(6);
  });

  it('throws when called without an implementation', () => {
    const fn = createMockFn<[], number>();
    expect(() => fn()).toThrow('mock has no implementation');
  });

  it('reset clears calls and restores initial impl', () => {
    const fn = createMockFn<[number], number>((n) => n + 1);
    fn(1);
    fn.mockReturnValue(99);
    expect(fn(1)).toBe(99);
    fn.reset();
    expect(fn.mock.calls).toEqual([]);
    expect(fn(2)).toBe(3);
  });

  it('supports mockImplementation chaining', () => {
    const fn = createMockFn<[string], string>();
    fn.mockImplementation((s) => s.toUpperCase());
    expect(fn('hi')).toBe('HI');
  });
});

describe('fixture builders', () => {
  it('createTestUser uses defaults and accepts overrides', () => {
    const u = createTestUser({ email: 'x@y.z' });
    expect(u.id).toBe('user_test_1');
    expect(u.email).toBe('x@y.z');
  });

  it('createTestTenant uses defaults and accepts overrides', () => {
    const t = createTestTenant({ name: 'Acme' });
    expect(t.id).toBe('tenant_test_1');
    expect(t.name).toBe('Acme');
  });

  it('createTestSubscription uses defaults and accepts overrides', () => {
    const s = createTestSubscription({ status: 'canceled' });
    expect(s.tier).toBe('pro');
    expect(s.status).toBe('canceled');
  });
});

describe('mockNeon', () => {
  it('returns query/execute/transaction stubs', async () => {
    const db = mockNeon();
    await expect(db.execute('SELECT 1')).resolves.toBeUndefined();
    await expect(db.query('SELECT 1')).resolves.toEqual({ rows: [] });
    await expect(db.transaction(() => Promise.resolve('ok'))).resolves.toBe('ok');
    expect(db.execute.mock.calls).toHaveLength(1);
  });
});

describe('mockStripe', () => {
  it('returns stub for webhooks/subscriptions/checkout', async () => {
    const s = mockStripe();
    await expect(s.subscriptions.list()).resolves.toEqual({ data: [] });
    await expect(s.checkout.sessions.create()).resolves.toEqual({
      url: 'https://checkout.stripe.com/test',
    });
    await expect(s.webhooks.constructEventAsync()).resolves.toEqual({ type: 'unknown' });
  });
});

describe('mockLLM', () => {
  it('returns canned responses in order, last response repeats', async () => {
    const llm = mockLLM(['first', 'second']);
    const a = await llm.complete();
    const b = await llm.complete();
    const c = await llm.complete();
    expect(a.data.content).toBe('first');
    expect(b.data.content).toBe('second');
    expect(c.data.content).toBe('second');
  });

  it('falls back to a default response when no list provided', async () => {
    const llm = mockLLM();
    const r = await llm.complete();
    expect(r.data.content).toBe('mock response');
  });

  it('returns empty content when responses array is empty', async () => {
    const llm = mockLLM([]);
    const r = await llm.complete();
    expect(r.data.content).toBe('');
  });
});

describe('mockTelnyxWebhook', () => {
  it('builds a Request with the given event_type', async () => {
    const req = mockTelnyxWebhook('call.answered');
    expect(req.method).toBe('POST');
    expect(req.headers.get('content-type')).toBe('application/json');
    const body = (await req.json()) as { data: { event_type: string } };
    expect(body.data.event_type).toBe('call.answered');
  });
});

describe('mockVoiceSession', () => {
  it('returns no-op start/processAudio/end', async () => {
    const v = mockVoiceSession();
    await expect(v.start()).resolves.toBeUndefined();
    await expect(v.processAudio(new ArrayBuffer(0))).resolves.toBeUndefined();
    await expect(v.end()).resolves.toEqual([]);
  });
});

describe('mockResend', () => {
  it('returns a stub with a fixed email id', async () => {
    const r = mockResend();
    await expect(r.send()).resolves.toEqual({ id: 'email_test_1' });
  });
});

describe('mockPostHog', () => {
  it('records capture/identify calls', () => {
    const ph = mockPostHog();
    ph.capture('event_a', { x: 1 });
    ph.identify('user_a', { plan: 'pro' });
    expect(ph.capture.mock.calls).toHaveLength(1);
    expect(ph.identify.mock.calls).toHaveLength(1);
  });
});

describe('mockSentry', () => {
  it('records captureException/captureMessage', () => {
    const s = mockSentry();
    expect(s.captureException(new Error('x'))).toBe('event_test_1');
    expect(s.captureMessage('hi')).toBe('event_test_1');
  });
});

describe('createTestRequest', () => {
  it('builds a JSON request with default content-type', async () => {
    const req = createTestRequest({
      method: 'POST',
      path: '/api/x',
      body: { hello: 'world' },
    });
    expect(req.url).toBe('https://example.test/api/x');
    expect(req.method).toBe('POST');
    expect(req.headers.get('content-type')).toBe('application/json');
    const body = (await req.json()) as { hello: string };
    expect(body.hello).toBe('world');
  });

  it('respects an absolute URL in path', () => {
    const req = createTestRequest({ method: 'GET', path: 'https://other.test/x' });
    expect(req.url).toBe('https://other.test/x');
  });

  it('passes a string body verbatim and merges custom headers', async () => {
    const req = createTestRequest({
      method: 'POST',
      path: '/raw',
      body: 'plain',
      headers: { 'content-type': 'text/plain', 'x-extra': '1' },
    });
    expect(req.headers.get('content-type')).toBe('text/plain');
    expect(req.headers.get('x-extra')).toBe('1');
    await expect(req.text()).resolves.toBe('plain');
  });

  it('attaches user payload as x-test-user header', () => {
    const req = createTestRequest({
      method: 'GET',
      path: '/me',
      user: { sub: 'user_1', tenantId: 'tenant_1', roles: ['admin'] },
    });
    const raw = req.headers.get('x-test-user');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '{}') as { sub: string; tenantId: string; roles?: string[] };
    expect(parsed.sub).toBe('user_1');
    expect(parsed.roles).toEqual(['admin']);
  });

  it('omits a body when none is provided', () => {
    const req = createTestRequest({ method: 'GET', path: '/ping' });
    expect(req.headers.get('content-type')).toBeNull();
  });
});

describe('money-flow fixtures', () => {
  it.each<MockStripeWebhookType>([
    'invoice.paid',
    'invoice.payment_failed',
    'charge.succeeded',
    'charge.failed',
    'charge.refunded',
    'customer.subscription.created',
    'customer.subscription.deleted',
    'payment_intent.succeeded',
    'payment_intent.canceled',
  ])('createMockStripeWebhook builds %s events', (type) => {
    const webhook = createMockStripeWebhook(type, {
      amount: 1234,
      customerId: 'cus_test',
      creatorId: 'creator_test',
      unlockId: 'unlock_test',
      metadata: { source: 'unit-test' },
      eventData: { extra: 'value' },
    });

    expect(webhook.id).toMatch(/^evt_/);
    expect(webhook.type).toBe(type);
    expect(webhook.data.object.extra).toBe('value');
  });

  it('createMockStripeWebhook rejects unsupported event types at runtime', () => {
    expect(() => createMockStripeWebhook('unknown.event' as MockStripeWebhookType)).toThrow('Unknown webhook type');
  });

  it('createMockStripeWebhook uses default nested values when overrides are omitted', () => {
    const subscription = createMockStripeWebhook('customer.subscription.created');
    const paymentIntent = createMockStripeWebhook('payment_intent.succeeded');

    expect(subscription.data.object.customer).toMatch(/^cus_/);
    expect(paymentIntent.data.object.amount).toBe(999);
  });

  it('fixture builders use defaults when overrides are omitted', () => {
    expect(createMockCreator().subscriptionStatus).toBe('none');
    expect(createMockEarnings('creator_test', 100).status).toBe('pending');
    expect(createMockDLQEvent('webhook_malformed').retryCount).toBe(0);
  });

  it('createMockCreator uses defaults and accepts overrides', () => {
    const creator = createMockCreator({
      name: 'Video Pro',
      subscriptionStatus: 'active',
      earningsBalance: 500,
      stripeConnectComplete: false,
    });

    expect(creator.id).toMatch(/^creator_/);
    expect(creator.name).toBe('Video Pro');
    expect(creator.subscriptionStatus).toBe('active');
    expect(creator.earningsBalance).toBe(500);
    expect(creator.stripeConnectComplete).toBe(false);
  });

  it('createMockEarnings uses defaults and accepts overrides', () => {
    const earnings = createMockEarnings('creator_test', 2500, {
      status: 'paid',
      payoutBatchId: 'batch_test',
      source: 'unlock',
    });

    expect(earnings.id).toMatch(/^earnings_/);
    expect(earnings.creatorId).toBe('creator_test');
    expect(earnings.amount).toBe(2500);
    expect(earnings.status).toBe('paid');
    expect(earnings.source).toBe('unlock');
  });

  it('createMockDLQEvent uses defaults and accepts overrides', () => {
    const event = createMockDLQEvent('transfer_failed', {
      payload: { transferId: 'tr_test' },
      error: 'Transfer failed',
      retryCount: 2,
    });

    expect(event.id).toMatch(/^dlq_/);
    expect(event.eventType).toBe('transfer_failed');
    expect(event.payload.transferId).toBe('tr_test');
    expect(event.retryCount).toBe(2);
  });

  it('seedDatabase tracks IDs for all supplied fixture records', async () => {
    const creator = createMockCreator({ id: 'creator_test' });
    const earnings = createMockEarnings('creator_test', 100, { id: 'earnings_test' });
    const dlq = createMockDLQEvent('webhook_timeout', { id: 'dlq_test' });

    const seed = await seedDatabase({}, {
      creators: [creator],
      earnings: [earnings],
      dlqEvents: [dlq],
    });

    expect(seed).toEqual({
      creatorIds: ['creator_test'],
      earningsIds: ['earnings_test'],
      dlqEventIds: ['dlq_test'],
    });
  });

  it('cleanupAfterTest resolves for tracked seed records', async () => {
    await expect(cleanupAfterTest({}, {
      creatorIds: ['creator_test'],
      earningsIds: ['earnings_test'],
      dlqEventIds: ['dlq_test'],
    })).resolves.toBeUndefined();
  });

  it('assertDatabaseState resolves for empty assertions and throws detailed mismatches', async () => {
    await expect(assertDatabaseState({}, {})).resolves.toBeUndefined();
    await expect(assertDatabaseState({}, {
      creatorId: 'creator_test',
      expectedEarnings: 500,
      dlqEventCount: 1,
    })).rejects.toThrow('Database state assertions failed');
  });

  it('randomId returns the requested number of lowercase alphanumeric characters', () => {
    expect(randomId(16)).toMatch(/^[a-z0-9]{16}$/);
  });
});