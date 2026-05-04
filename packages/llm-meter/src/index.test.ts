import { describe, it, expect, vi } from 'vitest';
import {
  assertRunBudget,
  computeCostCents,
  getProjectMonthTotal,
  getRunTotal,
  meteredComplete,
  recordCall,
  type D1Like,
  type LedgerRow,
} from './index.js';

function makeDb(): { db: D1Like; inserts: unknown[][]; queries: Array<{ sql: string; binds: unknown[] }>; firstResult: Record<string, unknown> | null } {
  const inserts: unknown[][] = [];
  const queries: Array<{ sql: string; binds: unknown[] }> = [];
  let firstResult: Record<string, unknown> | null = { cost_cents: 0, input_tokens: 0, output_tokens: 0, call_count: 0 };
  const db: D1Like = {
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          queries.push({ sql, binds });
          return {
            first: async <T>() => firstResult as T | null,
            run: async () => {
              inserts.push(binds);
              return { success: true };
            },
            all: async <T>() => ({ results: [] as T[] }),
          };
        },
      };
    },
  };
  return {
    db,
    inserts,
    queries,
    get firstResult() { return firstResult; },
    set firstResult(v: Record<string, unknown> | null) { firstResult = v; },
  } as unknown as { db: D1Like; inserts: unknown[][]; queries: Array<{ sql: string; binds: unknown[] }>; firstResult: Record<string, unknown> | null };
}

function llmResponse(content = 'hi') {
  return new Response(
    JSON.stringify({
      content: [{ type: 'text', text: content }],
      usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 500 },
      model: 'claude-sonnet-4-20250514',
    }),
    { status: 200, headers: { 'cf-aig-request-id': 'aig-1' } },
  );
}

const ENV = {
  AI_GATEWAY_BASE_URL: 'https://gw.test',
  ANTHROPIC_API_KEY: 'ak',
  GROQ_API_KEY: 'gk',
  VERTEX_ACCESS_TOKEN: 'v',
  VERTEX_PROJECT: 'p',
  VERTEX_LOCATION: 'us-central1',
};

describe('computeCostCents', () => {
  it('bills input + output with cache discount', () => {
    const c = computeCostCents('claude-sonnet-4-20250514', 100_000, 50_000, 40_000);
    expect(c).toBeGreaterThan(0);
  });

  it('returns 0 for unknown model', () => {
    expect(computeCostCents('unknown-model', 1000, 1000)).toBe(0);
  });

  it('zero tokens bills zero', () => {
    expect(computeCostCents('claude-sonnet-4-20250514', 0, 0)).toBe(0);
  });
});

describe('recordCall', () => {
  it('writes a ledger row', async () => {
    const { db, inserts } = makeDb();
    const row: LedgerRow = {
      project: 'p1',
      actor: 'worker',
      runId: 'r-1',
      workload: 'synthesis',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      cachedInputTokens: 100,
      outputTokens: 200,
      costCents: 3,
      latencyMs: 120,
    };
    await recordCall(db, row, { now: () => 1_700_000_000_000 });
    expect(inserts).toHaveLength(1);
    expect(inserts[0][0]).toBe('p1');
    expect(inserts[0][1]).toBe('worker');
  });

  it('swallows db errors and logs', async () => {
    const error = vi.fn();
    const db: D1Like = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
          run: async () => { throw new Error('boom'); },
          all: async () => ({ results: [] }),
        }),
      }),
    };
    await recordCall(db, {
      project: 'p', actor: 'w', provider: 'anthropic', model: 'm',
      inputTokens: 0, outputTokens: 0, costCents: 0, latencyMs: 0,
    }, { logger: { error } as unknown as import('@latimer-woods-tech/logger').Logger });
    expect(error).toHaveBeenCalledOnce();
  });
});

describe('getRunTotal and assertRunBudget', () => {
  it('reads run totals from SUM query', async () => {
    const harness = makeDb();
    harness.firstResult = { cost_cents: 250, input_tokens: 10_000, output_tokens: 500, call_count: 3 };
    const totals = await getRunTotal(harness.db, 'r-1');
    expect(totals.costCents).toBe(250);
    expect(totals.callCount).toBe(3);
  });

  it('assertRunBudget passes under cap', async () => {
    const h = makeDb();
    h.firstResult = { cost_cents: 100, input_tokens: 0, output_tokens: 0, call_count: 1 };
    await expect(assertRunBudget(h.db, 'r-1', 500)).resolves.toBeUndefined();
  });

  it('assertRunBudget throws BUDGET_EXCEEDED at cap', async () => {
    const h = makeDb();
    h.firstResult = { cost_cents: 500, input_tokens: 0, output_tokens: 0, call_count: 10 };
    await expect(assertRunBudget(h.db, 'r-1', 500)).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' });
  });
});

describe('getProjectMonthTotal', () => {
  it('returns 0 when no rows', async () => {
    const h = makeDb();
    h.firstResult = { cost_cents: 0 };
    expect(await getProjectMonthTotal(h.db, 'p1', '2026-05')).toBe(0);
  });
});

describe('meteredComplete', () => {
  it('records a ledger row on success', async () => {
    const h = makeDb();
    const fetchImpl = vi.fn(() => Promise.resolve(llmResponse()));
    const res = await meteredComplete(
      h.db,
      [{ role: 'user', content: 'hi' }],
      ENV,
      { project: 'prime-self', actor: 'worker', runId: 'r-42', tier: 'balanced' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.error).toBeNull();
    // First query: budget check (SELECT SUM), second: INSERT
    const insertCall = h.queries.find(q => q.sql.includes('INSERT'));
    expect(insertCall).toBeTruthy();
  });

  it('short-circuits with BUDGET_EXCEEDED when cap hit', async () => {
    const h = makeDb();
    h.firstResult = { cost_cents: 600, input_tokens: 0, output_tokens: 0, call_count: 5 };
    const fetchImpl = vi.fn();
    const res = await meteredComplete(
      h.db,
      [{ role: 'user', content: 'hi' }],
      ENV,
      { project: 'prime-self', actor: 'worker', runId: 'r-42', tier: 'balanced', budget: { perRunCapCents: 500 } },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.data).toBeNull();
    expect(res.error!.code).toBe('BUDGET_EXCEEDED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('skips budget check when no runId', async () => {
    const h = makeDb();
    const fetchImpl = vi.fn(() => Promise.resolve(llmResponse()));
    const res = await meteredComplete(
      h.db,
      [{ role: 'user', content: 'hi' }],
      ENV,
      { project: 'prime-self', actor: 'worker', tier: 'balanced' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.error).toBeNull();
    // No SELECT-for-budget query; only INSERT
    const selects = h.queries.filter(q => q.sql.includes('SELECT') && q.sql.includes('run_id'));
    expect(selects).toHaveLength(0);
  });

  it('does not record on LLM failure', async () => {
    const h = makeDb();
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('nope', { status: 400 })));
    const res = await meteredComplete(
      h.db,
      [{ role: 'user', content: 'hi' }],
      ENV,
      { project: 'prime-self', actor: 'worker', tier: 'balanced' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.error).not.toBeNull();
    const inserts = h.queries.filter(q => q.sql.includes('INSERT'));
    expect(inserts).toHaveLength(0);
  });
});
