# Factory Supervisor — Open Decisions

Decisions that block forward progress. Closed either via CODEOWNER ✅ reaction on the linked issue OR a merged PR updating this file.

**Canonical reference:** `docs/supervisor/ARCHITECTURE.md` §12

## Currently open

| # | Decision | Issue | Blocks | Recommendation |
|---|---|---|---|---|
| O2 | Memory backend default: CF Agent Memory vs D1 primary (dual-write either way) | [factory#111](https://github.com/Latimer-Woods-Tech/factory/issues/111) | SUP-3.4 scaffold (factory#107) | Agent Memory primary |
| O3 | Template authoring surface: YAML in factory repo vs Notion-synced | [factory#112](https://github.com/Latimer-Woods-Tech/factory/issues/112) | SUP-3.3 template bootstrap (factory#106) | YAML in repo |

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
| O1 | Supervisor runtime location | **New `apps/supervisor` worker — keep `factory-admin` read-only.** Independent deploy/rollback; no coupling of dashboard with mutator operations. | 2026-05-02 | [factory#110](https://github.com/Latimer-Woods-Tech/factory/issues/110) |

---

## Partial reversal: D1-Grok-opt-in (2026-05-02 PM)

**Context:** Original D1 resolution (2026-05-02 AM) dropped Grok entirely in favor of Gemini 2.5 Pro (long-context) + Groq Llama (verifier). Adrian reversed partially after shipping `llm@0.3.0`.

**New resolution:** Grok **stays available** in `@latimer-woods-tech/llm` as an explicit opt-in provider. Callers invoke it via `{ model: 'grok-4-fast' }` or `{ model: 'grok-3-mini-latest' }` — it is **not** in the default tier routing (fast / balanced / smart / verifier remain Anthropic + Gemini + Groq).

**Rationale:** xico-city's artist-platform user economy may want cheap experimental prompting where Grok's quirks are a feature rather than a bug. Keeping it callable but off the hot path preserves the clean routing for production workloads.

**Implementation:** `llm@0.3.1` (factory PR forthcoming). `GROK_API_KEY` becomes optional in `LLMEnv`; only required when caller opts in.

**Non-effects:** Groq (verifier) stays. Gemini (long-context fallback) stays. Anthropic (primary) stays. No change to steady-state cost model.
