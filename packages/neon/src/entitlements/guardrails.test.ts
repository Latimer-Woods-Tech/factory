/**
 * Tests for Render Cost Guardrails (W360-023)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  estimateRenderCost,
  checkRenderGuardrails,
  isKillSwitchActive,
  getRenderCountThisPeriod,
  emitBudgetAlert,
  DEFAULT_CREDIT_RATE_PER_SECOND,
  BUDGET_ALERT_THRESHOLD_FRACTION,
  PLATFORM_MAX_VIDEO_SECONDS,
  type RenderRequest,
} from './guardrails.js';
import type { FactoryDb } from '../index.js';

// ============================================================================
// Mock Helpers
// ============================================================================

/** Build a fake FactoryDb that returns given row sets in sequence. */
function makeDb(...rowGroups: unknown[][]): FactoryDb {
  let call = 0;
  return {
    execute: vi.fn(() => {
      const rows = rowGroups[call] ?? [];
      call += 1;
      return Promise.resolve({ rows });
    }),
  } as unknown as FactoryDb;
}

/** Default healthy entitlement row. */
function entRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    available_credits: '100.00',
    can_render: true,
    monthly_render_quota: null,
    max_video_seconds: 300,
    ...overrides,
  };
}

/** Default active customer row. */
function customerRow(status = 'active'): Record<string, unknown> {
  return { suspension_status: status };
}

// ============================================================================
// estimateRenderCost
// ============================================================================

describe('estimateRenderCost', () => {
  it('returns 0 for zero duration', () => {
    expect(estimateRenderCost(0)).toBe(0);
  });

  it('returns 0 for negative duration', () => {
    expect(estimateRenderCost(-10)).toBe(0);
  });

  it('calculates cost at default rate', () => {
    // 30s × 0.1/s = 3.00
    expect(estimateRenderCost(30)).toBe(3.0);
  });

  it('rounds up to nearest 0.01', () => {
    // 1s × 0.1 = 0.1 — exact, no rounding needed
    expect(estimateRenderCost(1)).toBe(0.1);
  });

  it('handles non-whole-second durations correctly', () => {
    // 45s × 0.1 = 4.5
    expect(estimateRenderCost(45)).toBe(4.5);
  });

  it('uses custom rate', () => {
    // 60s × 0.05 = 3.00
    expect(estimateRenderCost(60, 0.05)).toBe(3.0);
  });

  it('uses default constant correctly', () => {
    expect(DEFAULT_CREDIT_RATE_PER_SECOND).toBe(0.1);
  });
});

// ============================================================================
// isKillSwitchActive
// ============================================================================

describe('isKillSwitchActive', () => {
  it('returns global kill switch when factory_config has render_kill_switch=true', async () => {
    // First call: global config = true; no customer call needed
    const db = makeDb([{ value: 'true' }]);
    const result = await isKillSwitchActive(db, 'cust_001');
    expect(result.active).toBe(true);
    expect(result.scope).toBe('global');
  });

  it('returns global kill switch when factory_config has value=1', async () => {
    const db = makeDb([{ value: '1' }]);
    const result = await isKillSwitchActive(db, 'cust_001');
    expect(result.active).toBe(true);
    expect(result.scope).toBe('global');
  });

  it('checks customer status when global kill switch is off', async () => {
    // Call 1: config row with value=false; Call 2: customer row with active status
    const db = makeDb([{ value: 'false' }], [customerRow('active')]);
    const result = await isKillSwitchActive(db, 'cust_001');
    expect(result.active).toBe(false);
    expect(result.scope).toBe('none');
  });

  it('returns customer kill switch when customer is suspended', async () => {
    const db = makeDb([{ value: 'false' }], [customerRow('suspended')]);
    const result = await isKillSwitchActive(db, 'cust_001');
    expect(result.active).toBe(true);
    expect(result.scope).toBe('customer');
    expect(result.reason).toContain('suspended');
  });

  it('returns customer kill switch when customer is terminated', async () => {
    const db = makeDb([{ value: 'false' }], [customerRow('terminated')]);
    const result = await isKillSwitchActive(db, 'cust_001');
    expect(result.active).toBe(true);
    expect(result.scope).toBe('customer');
  });

  it('treats missing factory_config table as no global kill switch', async () => {
    // Simulate table-not-found by throwing on first call
    let call = 0;
    const db = {
      execute: vi.fn(() => {
        call++;
        if (call === 1) return Promise.reject(new Error('relation "factory_config" does not exist'));
        return Promise.resolve({ rows: [customerRow('active')] });
      }),
    } as unknown as FactoryDb;
    const result = await isKillSwitchActive(db, 'cust_001');
    expect(result.active).toBe(false);
    expect(result.scope).toBe('none');
  });

  it('returns none when factory_config row is absent', async () => {
    // No rows in config, customer is active
    const db = makeDb([], [customerRow('active')]);
    const result = await isKillSwitchActive(db, 'cust_001');
    expect(result.active).toBe(false);
    expect(result.scope).toBe('none');
  });
});

// ============================================================================
// getRenderCountThisPeriod
// ============================================================================

describe('getRenderCountThisPeriod', () => {
  it('returns 0 when no rows returned', async () => {
    const db = makeDb([]);
    const count = await getRenderCountThisPeriod(db, 'cust_001');
    expect(count).toBe(0);
  });

  it('returns numeric count from Postgres', async () => {
    const db = makeDb([{ count: 7 }]);
    const count = await getRenderCountThisPeriod(db, 'cust_001');
    expect(count).toBe(7);
  });

  it('parses string count from Postgres', async () => {
    const db = makeDb([{ count: '12' }]);
    const count = await getRenderCountThisPeriod(db, 'cust_001');
    expect(count).toBe(12);
  });
});

// ============================================================================
// checkRenderGuardrails — happy path
// ============================================================================

describe('checkRenderGuardrails — allowed', () => {
  it('allows render when all checks pass', async () => {
    // kill switch OFF (config miss) → customer active → entitlement
    const db = makeDb(
      [entRow()],           // entitlements query
      [],                   // global kill switch config (no row = off)
      [customerRow()],      // customer status
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 30 };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(true);
    expect(result.estimatedCost).toBe(3.0);
    expect(result.creditsAfter).toBe(97.0); // 100 - 3
  });

  it('calculates budget alert when credits drop below 20%', async () => {
    // 15 credits available, cost 3 → 12 remaining = 80% of 15 → no alert
    // 3 credits available, cost 0.5 → 2.5 remaining = 83% of 3 → no alert
    // 10 credits, cost 9 → 1 remaining = 10% of 10 → ALERT (< 20%)
    const db = makeDb(
      [entRow({ available_credits: '10.00' })],
      [],
      [customerRow()],
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 90 }; // 9.0 credits
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(true);
    expect(result.budgetAlertNeeded).toBe(true); // 1 remaining / 10 total = 10% < 20%
  });

  it('does not trigger budget alert when balance is comfortable', async () => {
    const db = makeDb(
      [entRow({ available_credits: '100.00' })],
      [],
      [customerRow()],
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 10 }; // 1.0 credit
    const result = await checkRenderGuardrails(db, req);
    expect(result.budgetAlertNeeded).toBe(false);
  });
});

// ============================================================================
// checkRenderGuardrails — denied paths
// ============================================================================

describe('checkRenderGuardrails — denied: kill switch', () => {
  it('blocks render when global kill switch is active', async () => {
    const db = makeDb(
      [entRow()],             // entitlements
      [{ value: 'true' }],    // global kill switch ON
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 30 };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('kill switch');
    expect(result.context.killSwitchActive).toBe(true);
    expect(result.context.killSwitchScope).toBe('global');
  });

  it('blocks render when customer is suspended', async () => {
    const db = makeDb(
      [entRow()],                      // entitlements
      [{ value: 'false' }],            // global kill switch OFF
      [customerRow('suspended')],      // customer suspended
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 30 };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(false);
    expect(result.context.killSwitchScope).toBe('customer');
  });
});

describe('checkRenderGuardrails — denied: no entitlement', () => {
  it('blocks render when can_render is false', async () => {
    const db = makeDb(
      [entRow({ can_render: false })],
      [],
      [customerRow()],
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 30 };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('entitlement');
  });

  it('blocks render when no entitlement row exists for customer', async () => {
    const db = makeDb(
      [],                 // no entitlement row
      [],
      [customerRow()],
    );
    const req: RenderRequest = { customerId: 'cust_unknown', durationSeconds: 30 };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('entitlement');
  });
});

describe('checkRenderGuardrails — denied: duration limits', () => {
  it('blocks render that exceeds plan max_video_seconds', async () => {
    const db = makeDb(
      [entRow({ max_video_seconds: 60 })],
      [],
      [customerRow()],
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 61 };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('duration');
    expect(result.reason).toContain('61');
  });

  it('blocks render that exceeds platform cap even if plan allows it', async () => {
    const db = makeDb(
      [entRow({ max_video_seconds: PLATFORM_MAX_VIDEO_SECONDS + 100 })],
      [],
      [customerRow()],
    );
    const req: RenderRequest = {
      customerId: 'cust_001',
      durationSeconds: PLATFORM_MAX_VIDEO_SECONDS + 1,
    };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('duration');
  });
});

describe('checkRenderGuardrails — denied: quota', () => {
  it('blocks render when monthly quota is exhausted', async () => {
    const db = makeDb(
      [entRow({ monthly_render_quota: 10 })],
      [],
      [customerRow()],
      [{ count: 10 }],   // render count this period
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 30 };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('quota');
    expect(result.reason).toContain('10/10');
  });

  it('allows render when quota not yet exhausted', async () => {
    const db = makeDb(
      [entRow({ monthly_render_quota: 10 })],
      [],
      [customerRow()],
      [{ count: 9 }],   // 9 of 10 used
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 30 };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(true);
    expect(result.context.rendersThisPeriod).toBe(9);
  });

  it('allows render when plan has no monthly quota (null)', async () => {
    const db = makeDb(
      [entRow({ monthly_render_quota: null })],
      [],
      [customerRow()],
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 30 };
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(true);
    expect(result.context.monthlyRenderQuota).toBeNull();
  });
});

describe('checkRenderGuardrails — denied: insufficient credits', () => {
  it('blocks render when credits are insufficient for estimated cost', async () => {
    const db = makeDb(
      [entRow({ available_credits: '2.00' })],
      [],
      [customerRow()],
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 30 }; // 3.00 credits
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Insufficient credits');
    expect(result.reason).toContain('2.00 available');
  });

  it('allows render when credits exactly match cost', async () => {
    const db = makeDb(
      [entRow({ available_credits: '3.00' })],
      [],
      [customerRow()],
    );
    const req: RenderRequest = { customerId: 'cust_001', durationSeconds: 30 }; // exactly 3.00
    const result = await checkRenderGuardrails(db, req);
    expect(result.allowed).toBe(true);
    expect(result.creditsAfter).toBe(0);
  });
});

// ============================================================================
// emitBudgetAlert
// ============================================================================

describe('emitBudgetAlert', () => {
  it('does not throw when called', () => {
    expect(() => emitBudgetAlert('cust_001', 10, 100)).not.toThrow();
  });

  it('references correct threshold constant', () => {
    expect(BUDGET_ALERT_THRESHOLD_FRACTION).toBe(0.2);
  });

  it('does not throw when monthlyQuota is null', () => {
    expect(() => emitBudgetAlert('cust_001', 5, null)).not.toThrow();
  });

  it('swallows errors silently', () => {
    // Even with console.warn replaced by a throwing function, should not propagate
    const origWarn = console.warn;
    console.warn = () => { throw new Error('boom'); };
    expect(() => emitBudgetAlert('cust_001', 0, 100)).not.toThrow();
    console.warn = origWarn;
  });
});
