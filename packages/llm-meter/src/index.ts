import {
  FactoryBaseError,
  InternalError,
  toErrorResponse,
  type FactoryResponse,
} from '@latimer-woods-tech/errors';
import type { Logger } from '@latimer-woods-tech/logger';
import {
  complete as llmComplete,
  type LLMEnv,
  type LLMMessage,
  type LLMOptions,
  type LLMProvider,
  type LLMResult,
} from '@latimer-woods-tech/llm';

/**
 * Minimal D1 binding shape we depend on. Real callers pass a Cloudflare
 * `D1Database` binding; tests pass a stub.
 */
export interface D1Like {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<{ success: boolean; meta?: unknown }>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
  };
}

/**
 * Budget configuration for a metered call.
 */
export interface BudgetConfig {
  /** Per-run hard cap in US cents. Default 500 ($5). */
  perRunCapCents?: number;
  /** Optional per-project monthly cap in US cents. No default — opt-in. */
  perProjectMonthlyCapCents?: number;
}

/**
 * Provenance stamped on every ledger row.
 */
/** Known actor values for {@link LedgerContext.actor}. */
export const KNOWN_ACTORS = ['human', 'sauna', 'copilot', 'supervisor-future', 'worker'] as const;

/** Known workload values for {@link LedgerContext.workload}. */
export const KNOWN_WORKLOADS = ['synthesis', 'planner', 'verifier', 'small'] as const;

export interface LedgerContext {
  project: string;
  /** One of {@link KNOWN_ACTORS}, or any custom string. */
  actor: string;
  runId?: string;
  /** One of {@link KNOWN_WORKLOADS}, or any custom string. */
  workload?: string;
}

/**
 * Options passed to {@link meteredComplete}. Extends {@link LLMOptions} with
 * ledger + budget fields.
 */
export interface MeteredOptions extends LLMOptions, LedgerContext {
  /** Required: overrides the optional `actor` in LLMOptions. */
  actor: string;
  /** Required: overrides the optional `project` in LLMOptions. */
  project: string;
  budget?: BudgetConfig;
}

/**
 * Row shape matching the D1 schema.
 */
export interface LedgerRow {
  project: string;
  actor: string;
  runId?: string;
  workload?: string;
  provider: LLMProvider;
  model: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  costCents: number;
  latencyMs: number;
}

export interface RunTotals {
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
}

const DEFAULT_RUN_CAP_CENTS = 500;

// Pricing in micro-dollars per 1M tokens (USD × 10_000 to keep ints).
// Keep in sync with provider pricing pages; update on price changes.
// Sources (2026-05): anthropic.com/pricing, cloud.google.com/vertex-ai/pricing, groq.com/pricing
const PRICING_UCENTS_PER_MTOK: Record<string, { input: number; output: number; cachedInput?: number }> = {
  // Anthropic
  'claude-haiku-4-20250514':   { input: 80,    output: 400,   cachedInput: 8 },
  'claude-sonnet-4-20250514':  { input: 300,   output: 1500,  cachedInput: 30 },
  'claude-opus-4-20250514':    { input: 1500,  output: 7500,  cachedInput: 150 },
  // Google
  'gemini-2.5-pro':            { input: 125,   output: 500 },
  'gemini-1.5-flash':          { input: 8,     output: 30 },
  // Groq
  'llama-3.3-70b-versatile':   { input: 59,    output: 79 },
};

/**
 * Compute cost in US cents from tokens. `cached_input_tokens` bill at a
 * discounted rate when the provider exposes one.
 */
export function computeCostCents(
  model: string,
  input: number,
  output: number,
  cachedInput = 0,
): number {
  const p = PRICING_UCENTS_PER_MTOK[model];
  if (!p) return 0; // unknown model — record 0 and log a warning upstream
  const billableInput = Math.max(0, input - cachedInput);
  const inputUcents = (billableInput / 1_000_000) * p.input;
  const cachedUcents = p.cachedInput ? (cachedInput / 1_000_000) * p.cachedInput : 0;
  const outputUcents = (output / 1_000_000) * p.output;
  const totalUcents = inputUcents + cachedUcents + outputUcents;
  return Math.ceil(totalUcents / 100); // 1 cent = 100 ucents
}

function currentYyyyMm(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Write one ledger row. Swallows D1 errors and logs — metering must never
 * block a successful LLM call from returning.
 */
export async function recordCall(
  db: D1Like,
  row: LedgerRow,
  deps: { logger?: Logger; now?: () => number } = {},
): Promise<void> {
  const now = deps.now?.() ?? Date.now();
  try {
    await db
      .prepare(
        `INSERT INTO llm_ledger
         (project, actor, run_id, workload, provider, model,
          input_tokens, cached_input_tokens, output_tokens,
          cost_cents, latency_ms, at, yyyy_mm)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.project,
        row.actor,
        row.runId ?? null,
        row.workload ?? null,
        row.provider,
        row.model,
        row.inputTokens,
        row.cachedInputTokens ?? 0,
        row.outputTokens,
        row.costCents,
        row.latencyMs,
        now,
        currentYyyyMm(new Date(now)),
      )
      .run();
  } catch (e) {
    deps.logger?.error?.('llm-meter.record.failed', {
      error: e instanceof Error ? e.message : String(e),
      row,
    });
  }
}

/**
 * Get cost + token totals for a run so far.
 */
export async function getRunTotal(db: D1Like, runId: string): Promise<RunTotals> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(cost_cents), 0) AS cost_cents,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COUNT(*) AS call_count
       FROM llm_ledger WHERE run_id = ?`,
    )
    .bind(runId)
    .first<{ cost_cents: number; input_tokens: number; output_tokens: number; call_count: number }>();
  return {
    costCents: Number(row?.cost_cents ?? 0),
    inputTokens: Number(row?.input_tokens ?? 0),
    outputTokens: Number(row?.output_tokens ?? 0),
    callCount: Number(row?.call_count ?? 0),
  };
}

/**
 * Get cost total for a (project, yyyy-mm) bucket.
 */
export async function getProjectMonthTotal(
  db: D1Like,
  project: string,
  yyyyMm: string,
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(cost_cents), 0) AS cost_cents
       FROM llm_ledger WHERE project = ? AND yyyy_mm = ?`,
    )
    .bind(project, yyyyMm)
    .first<{ cost_cents: number }>();
  return Number(row?.cost_cents ?? 0);
}

/**
 * Throws `BUDGET_EXCEEDED` if the run's running total already equals or
 * exceeds the cap. Called before executing an LLM call.
 */
export async function assertRunBudget(
  db: D1Like,
  runId: string,
  maxCents = DEFAULT_RUN_CAP_CENTS,
): Promise<void> {
  const totals = await getRunTotal(db, runId);
  if (totals.costCents >= maxCents) {
    throw new FactoryBaseError(
      'BUDGET_EXCEEDED',
      `run ${runId} hit $${(maxCents / 100).toFixed(2)} cap (spent $${(totals.costCents / 100).toFixed(2)} across ${String(totals.callCount)} calls)`,
      429,
      false,
      { runId, maxCents, actual: totals.costCents, callCount: totals.callCount },
    );
  }
}

/**
 * Metered wrapper around `@latimer-woods-tech/llm`'s `complete`. Checks the
 * per-run budget before the call (short-circuits with `BUDGET_EXCEEDED` if
 * exceeded), then records one ledger row after success.
 *
 * On LLM failure, no ledger row is written — we only bill for completed work.
 */
export async function meteredComplete(
  db: D1Like,
  messages: LLMMessage[],
  env: LLMEnv,
  opts: MeteredOptions,
  deps: { fetch?: typeof fetch; logger?: Logger; now?: () => number } = {},
): Promise<FactoryResponse<LLMResult>> {
  const cap = opts.budget?.perRunCapCents ?? DEFAULT_RUN_CAP_CENTS;
  if (opts.runId) {
    try {
      await assertRunBudget(db, opts.runId, cap);
    } catch (e) {
      if (e instanceof FactoryBaseError) return toErrorResponse(e);
      return toErrorResponse(
        new InternalError('budget check failed', { error: e instanceof Error ? e.message : String(e) }),
      );
    }
  }

  const llmResp = await llmComplete(messages, env, opts, deps);
  if (llmResp.error || !llmResp.data) return llmResp;

  const d = llmResp.data;
  const cost = computeCostCents(d.model, d.tokens.input, d.tokens.output, d.tokens.cacheRead ?? 0);
  await recordCall(
    db,
    {
      project: opts.project,
      actor: opts.actor,
      runId: opts.runId,
      workload: opts.workload,
      provider: d.provider,
      model: d.model,
      inputTokens: d.tokens.input,
      cachedInputTokens: d.tokens.cacheRead ?? 0,
      outputTokens: d.tokens.output,
      costCents: cost,
      latencyMs: d.latency,
    },
    { logger: deps.logger, now: deps.now },
  );

  return llmResp;
}

export { PRICING_UCENTS_PER_MTOK, DEFAULT_RUN_CAP_CENTS };
