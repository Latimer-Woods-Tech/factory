/**
 * Tests for analytics event schema contract (W360-021)
 *
 * Ensures:
 * - assertEventShape passes for well-formed events
 * - assertEventShape throws on missing required fields
 * - assertEventShape throws on wrong types
 * - Unknown events pass without error (not in critical registry)
 * - All critical journey events have at least one valid shape test
 */

import { describe, it, expect } from 'vitest';
import {
  assertEventShape,
  validateEventShape,
  getCriticalEventNames,
  CRITICAL_EVENT_SCHEMAS,
} from './event-schemas.js';

// ---------------------------------------------------------------------------
// Section 1: Core validation logic
// ---------------------------------------------------------------------------

describe('validateEventShape', () => {
  it('returns valid=true for an unknown (non-critical) event', () => {
    const result = validateEventShape('some.unregistered.event', { anything: true });
    expect(result.valid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
  });

  it('returns valid=true when all required fields are present', () => {
    const result = validateEventShape('render.completed', {
      render_job_id: 'job-001',
      customer_id: 'cust-01',
      app_id: 'prime_self',
      duration_ms: 5200,
      stream_uid: 'aa1b2c',
    });
    expect(result.valid).toBe(true);
    expect(result.missingFields).toHaveLength(0);
    expect(result.typeErrors).toHaveLength(0);
  });

  it('returns missing fields when required property is absent', () => {
    const result = validateEventShape('render.completed', {
      render_job_id: 'job-001',
      customer_id: 'cust-01',
      app_id: 'prime_self',
      // duration_ms and stream_uid intentionally missing
    });
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('duration_ms');
    expect(result.missingFields).toContain('stream_uid');
  });

  it('returns missing fields when required property is null', () => {
    const result = validateEventShape('auth.login_success', {
      user_id: null,
      app_id: 'prime_self',
    });
    expect(result.valid).toBe(false);
    expect(result.missingFields).toContain('user_id');
  });

  it('returns type errors when field has wrong type', () => {
    const result = validateEventShape('render.completed', {
      render_job_id: 42,            // should be string
      customer_id: 'cust-01',
      app_id: 'prime_self',
      duration_ms: 'slow',          // should be number
      stream_uid: 'uid-01',
    });
    expect(result.valid).toBe(false);
    expect(result.typeErrors.some((e) => e.field === 'render_job_id')).toBe(true);
    expect(result.typeErrors.some((e) => e.field === 'duration_ms')).toBe(true);
  });

  it('ignores type check when field is undefined (missing check handles absence)', () => {
    const result = validateEventShape('render.credits_debited', {
      render_job_id: 'job-001',
      customer_id: 'cust-01',
      credit_cost: 2,
      remaining_credits: 8,
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section 2: assertEventShape throws on violations
// ---------------------------------------------------------------------------

describe('assertEventShape', () => {
  it('does not throw for valid event shape', () => {
    expect(() => assertEventShape('auth.login_success', {
      user_id: 'user-001',
      app_id: 'prime_self',
    })).not.toThrow();
  });

  it('throws with descriptive message on missing fields', () => {
    expect(() => assertEventShape('booking.confirmed', {
      booking_id: 'bk-001',
      // missing experience_id, user_id, host_id, price_usd
    })).toThrow(/Missing required fields/);
  });

  it('throws with field names listed in error message', () => {
    let thrown: Error | null = null;
    try {
      assertEventShape('booking.confirmed', { booking_id: 'bk-001' });
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).not.toBeNull();
    expect(thrown!.message).toContain('experience_id');
    expect(thrown!.message).toContain('user_id');
  });

  it('throws with type error details on wrong type', () => {
    expect(() => assertEventShape('revenue.payment_received', {
      customer_id: 'cust-01',
      amount_usd: 'not-a-number',          // should be number
      stripe_payment_intent_id: 'pi_001',
    })).toThrow(/Type error/);
  });

  it('does not throw for unknown (non-critical) events', () => {
    expect(() => assertEventShape('debug.test_event', { anything: 'ok' })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Section 3: Schema completeness — every critical event has passing shape test
// ---------------------------------------------------------------------------

describe('critical event schemas — shape coverage', () => {
  // Canonical valid payloads for all registered critical events.
  // This acts as a contract test: if a schema changes, the fixture must update too.
  const VALID_FIXTURES: Record<string, Record<string, unknown>> = {
    'render.requested': { render_job_id: 'job-01', customer_id: 'cust-01', app_id: 'prime_self' },
    'render.started': { render_job_id: 'job-01', customer_id: 'cust-01', app_id: 'prime_self' },
    'render.completed': { render_job_id: 'job-01', customer_id: 'cust-01', app_id: 'prime_self', duration_ms: 8000, stream_uid: 'uid-abc' },
    'render.failed': { render_job_id: 'job-01', customer_id: 'cust-01', app_id: 'prime_self', error_message: 'OOM' },
    'render.credits_debited': { render_job_id: 'job-01', customer_id: 'cust-01', credit_cost: 2, remaining_credits: 8 },
    'render.credits_refunded': { render_job_id: 'job-01', customer_id: 'cust-01', credit_amount: 2, reason: 'job failed' },
    'subscription.created': { customer_id: 'cust-01', plan_id: 'plan-basic', stripe_subscription_id: 'sub_001', billing_cycle: 'monthly' },
    'subscription.canceled': { customer_id: 'cust-01', plan_id: 'plan-basic', stripe_subscription_id: 'sub_001' },
    'subscription.payment_failed': { customer_id: 'cust-01', stripe_subscription_id: 'sub_001', invoice_id: 'inv_001' },
    'revenue.payment_received': { customer_id: 'cust-01', amount_usd: 49, stripe_payment_intent_id: 'pi_001' },
    'revenue.refund_issued': { customer_id: 'cust-01', amount_usd: 49, stripe_refund_id: 're_001', reason: 'customer_request' },
    'auth.login_success': { user_id: 'user-01', app_id: 'prime_self' },
    'auth.login_failed': { app_id: 'prime_self', reason: 'invalid_credentials' },
    'auth.token_refreshed': { user_id: 'user-01', app_id: 'prime_self' },
    'auth.logout': { user_id: 'user-01', app_id: 'prime_self' },
    'booking.checkout_started': { experience_id: 'exp-01', user_id: 'user-01', price_usd: 75 },
    'booking.confirmed': { booking_id: 'bk-01', experience_id: 'exp-01', user_id: 'user-01', host_id: 'host-01', price_usd: 75 },
    'booking.canceled': { booking_id: 'bk-01', experience_id: 'exp-01', user_id: 'user-01', reason: 'host_canceled' },
    'webhook.received': { event_id: 'evt_001', event_type: 'customer.subscription.created', source: 'stripe' },
    'webhook.processed': { event_id: 'evt_001', event_type: 'customer.subscription.created', duration_ms: 45 },
    'webhook.failed': { event_id: 'evt_001', event_type: 'customer.subscription.created', error_message: 'DB timeout' },
    'webhook.duplicate_ignored': { event_id: 'evt_001', event_type: 'customer.subscription.created' },
  };

  const criticalEvents = getCriticalEventNames();

  it('all registered schemas have a valid fixture', () => {
    const missing = criticalEvents.filter((name) => !VALID_FIXTURES[name]);
    if (missing.length > 0) {
      throw new Error(
        `Missing valid fixture for critical events: ${missing.join(', ')}\n` +
        'Add an entry to VALID_FIXTURES in this test file.',
      );
    }
  });

  // Dynamically generate one test per critical event so failures are individually named
  for (const [eventName, fixture] of Object.entries(VALID_FIXTURES)) {
    it(`"${eventName}" valid shape passes assertEventShape`, () => {
      expect(() => assertEventShape(eventName, fixture)).not.toThrow();
    });
  }

  it('schema registry has expected number of critical events (update if adding new events)', () => {
    // This acts as a safety net: if someone removes events, tests fail.
    // Update this number when intentionally adding or removing critical events.
    expect(criticalEvents.length).toBeGreaterThanOrEqual(22);
  });
});

// ---------------------------------------------------------------------------
// Section 4: getCriticalEventNames
// ---------------------------------------------------------------------------

describe('getCriticalEventNames', () => {
  it('returns an array of strings', () => {
    const names = getCriticalEventNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    names.forEach((n) => expect(typeof n).toBe('string'));
  });

  it('includes all known journey event categories', () => {
    const names = getCriticalEventNames();
    const categories = ['render.', 'subscription.', 'revenue.', 'auth.', 'booking.', 'webhook.'];
    for (const cat of categories) {
      expect(names.some((n) => n.startsWith(cat))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 5: Verify all schemas in CRITICAL_EVENT_SCHEMAS are internally consistent
// ---------------------------------------------------------------------------

describe('CRITICAL_EVENT_SCHEMAS internal consistency', () => {
  for (const [eventName, schema] of Object.entries(CRITICAL_EVENT_SCHEMAS)) {
    it(`"${eventName}" schema required fields are strings`, () => {
      expect(Array.isArray(schema.required)).toBe(true);
      schema.required.forEach((f) => expect(typeof f).toBe('string'));
    });

    if (Object.keys(schema.types ?? {}).length > 0) {
      it(`"${eventName}" type constraints reference only declared-required or valid fields`, () => {
        const validTypes = new Set(['string', 'number', 'boolean']);
        Object.entries(schema.types!).forEach(([, t]) => {
          expect(validTypes.has(t)).toBe(true);
        });
      });
    }
  }
});
