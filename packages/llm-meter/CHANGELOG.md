# Changelog

## 0.1.0 — 2026-05-02

Initial release. Implements **SUP-2.2** per `docs/architecture/FACTORY_V1.md § LLM substrate`
and factory#102.

### Added

- `meteredComplete()` — wrapper around `@latimer-woods-tech/llm@^0.3.0`'s `complete()` that
  enforces per-run budget before the call and records one D1 ledger row after success.
- `recordCall()`, `getRunTotal()`, `getProjectMonthTotal()`, `assertRunBudget()` — low-level
  ledger primitives for consumers that need custom flows.
- `computeCostCents()` — pure function mapping `(model, input, output, cachedInput)` to cents,
  with a `PRICING_UCENTS_PER_MTOK` catalogue covering every model the `llm` package routes to.
- `BUDGET_EXCEEDED` error code (FactoryBaseError subclass carrying `{ runId, maxCents, actual, callCount }`).
- D1 migration `migrations/0001_init.sql` — `llm_ledger` table + 3 indexes
  (`project+yyyy_mm`, `run_id`, `actor+yyyy_mm`).

### Design notes

- **Metering is never blocking on output.** If the D1 insert fails, we log `llm-meter.record.failed`
  and return the LLM response anyway. Losing a ledger row is strictly preferable to losing a completion.
- **No ledger row on LLM failure.** We only bill for work that produced content.
- **Budget check is opt-out.** Calls without `runId` skip the pre-call SELECT; callers that want
  strict project-level enforcement can `assertRunBudget` themselves.
- **Pricing rate card lives in-repo.** Provider price moves → bump the catalogue → publish a
  patch release. No runtime fetch.
