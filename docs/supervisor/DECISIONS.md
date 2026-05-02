# Factory Supervisor — Open Decisions

Decisions that block forward progress. Closed either via CODEOWNER ✅ reaction on the linked issue OR a merged PR updating this file.

**Canonical reference:** `docs/supervisor/ARCHITECTURE.md` §12

## Currently open

| # | Decision | Issue | Blocks | Recommendation |
|---|---|---|---|---|
| O1 | Supervisor runtime location: new `apps/supervisor` worker vs extend `factory-admin` | [factory#110](https://github.com/Latimer-Woods-Tech/factory/issues/110) | SUP-3.4 scaffold (factory#107) | New `apps/supervisor` |
| O2 | Memory backend default: CF Agent Memory vs D1 primary (dual-write either way) | [factory#111](https://github.com/Latimer-Woods-Tech/factory/issues/111) | SUP-3.4 scaffold (factory#107) | Agent Memory primary |

## How to resolve

React ✅ on the issue → a followup PR updates this file to move the row to the "Resolved" section below AND replaces the "Recommendation" column with the outcome.

OR open a PR updating this file directly, linking to the discussion in the PR body.

## Resolved decisions (archive)

| # | Decision | Outcome | When | Where |
|---|---|---|---|---|
| D1 | Long-context LLM fallback | **Gemini 2.5 Pro via Vertex AI** on `factory-495015`. Grok dropped. | 2026-05-02 | `ARCHITECTURE.md` §6 |
| D2 | Template blessed threshold | **3 successful runs, 0 reverts, 0 human overrides** | 2026-05-02 | `ARCHITECTURE.md` §5.5 |
| D3 | Lock primitive | **`LockDO` Durable Object singleton per app, D1 as audit log** | 2026-05-02 | `ARCHITECTURE.md` §5.8 |
| D4 | Capability mutation flag | **Graded `side_effects` levels (none/read-external/write-app/write-external)**, not boolean `mutating` | 2026-05-02 | `ARCHITECTURE.md` §7 |
| O3 | Template authoring surface | **YAML in `docs/supervisor/plans/`, versioned with code; code-review applies; test harness on PR.** Notion option rejected. | 2026-05-02 | `ARCHITECTURE.md` §12 |
