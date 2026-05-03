# @latimer-woods-tech/llm-meter

Per-run LLM budget enforcement + D1 ledger for the Factory platform.

## Schema

Apply the migration once per consumer D1 database:

```bash
wrangler d1 execute <DB> --file=node_modules/@latimer-woods-tech/llm-meter/migrations/0001_init.sql
```

## Usage

```ts
import { meteredComplete } from '@latimer-woods-tech/llm-meter';

const res = await meteredComplete(
  env.DB,                              // D1 binding
  [{ role: 'user', content: 'hi' }],
  env,                                 // LLMEnv (AI Gateway + Anthropic + Vertex + Groq)
  {
    project: 'prime-self',
    actor: 'worker',
    runId: 'run-abc-123',
    workload: 'synthesis',
    tier: 'balanced',
    budget: { perRunCapCents: 500 },   // $5 default
  },
);

if (res.error?.code === 'BUDGET_EXCEEDED') {
  // run hit its cap; short-circuit or escalate
}
```

## What it does

1. **Before** the LLM call: queries `SUM(cost_cents) WHERE run_id = ?`. If ≥ cap, throws `BUDGET_EXCEEDED` and the LLM call never runs.
2. **After** a successful LLM call: writes one ledger row with provider, model, tokens (incl. cached), cost in cents, latency, project, actor, run_id, workload, and `yyyy_mm`.
3. On LLM failure: no ledger row — we only bill for completed work.
4. On D1 write failure: logs `llm-meter.record.failed` and returns the LLM response anyway. Metering must never block a successful response.

## Pricing catalogue

`PRICING_UCENTS_PER_MTOK` in `src/index.ts` lists input/output/cached-input rates in micro-cents per million tokens for every model the `llm` package routes to. Keep in sync with provider pricing pages — unknown models bill at 0 and emit nothing special (budget checks still work on the $0).

## Querying spend

```sql
-- per-run total
SELECT SUM(cost_cents) / 100.0 AS dollars FROM llm_ledger WHERE run_id = 'run-abc-123';

-- per-project per-month
SELECT actor, SUM(cost_cents) / 100.0 AS dollars, COUNT(*) AS calls
FROM llm_ledger WHERE project = 'prime-self' AND yyyy_mm = '2026-05'
GROUP BY actor ORDER BY dollars DESC;
```

## Escalating the cap

The per-run cap is soft — you can pass `budget: { perRunCapCents: 2000 }` for one call. For permanent changes, wire into your supervisor config; see `docs/architecture/FACTORY_V1.md § LLM substrate`.
