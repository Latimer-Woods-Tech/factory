# Changelog

## 0.3.1 — 2026-05-02 PM

### Added (no breaking changes)

- **Grok opt-in provider.** `LLMProvider` now includes `'grok'`. Call with `{ model: 'grok-4-fast' }` or `{ model: 'grok-3-mini-latest' }` to route to xAI. Not in default tier routing — explicit model override only.
- `LLMEnv.GROK_API_KEY` is **optional**; required only when a caller opts in via a `grok-*` model override.
- `MODELS.grok.{fast, mini}` added to the catalogue.

### Rationale

Reversal of the 0.3.0 partial decision (D1 in `docs/supervisor/DECISIONS.md`): Grok stays available for workloads that benefit from its quirks — cheap experimental prompting in the xico-city user economy, artist-platform surface, etc. It does not compete with Anthropic / Gemini / Groq for the tier slots; it sits alongside as a per-call opt-in.

### Consumers

- Downstream packages do not need to declare `GROK_API_KEY` unless a route explicitly sends Grok model overrides. Existing code that dropped the key on 0.3.0 migration continues to work.


## 0.3.0 — 2026-05-02

### Breaking

- **Grok removed.** `LLMProvider` no longer includes `grok`; `LLMEnv.GROK_API_KEY` removed.
- **AI Gateway mandatory.** `LLMEnv.AI_GATEWAY_BASE_URL` is required. All provider traffic flows through
  Cloudflare AI Gateway for unified logging, rate limiting, and cost telemetry.
- **Tier-based routing.** `LLMOptions.tier` (`fast | balanced | smart | verifier`) replaces the
  flat Anthropic → Grok → Groq failover chain. Routing is workload-split:
  - `fast` → Anthropic Haiku (latency-sensitive, short completions)
  - `balanced` → Anthropic Sonnet (default)
  - `smart` → Anthropic Opus; Gemini 2.5 Pro for long-context (>150k tokens est.)
  - `verifier` → Groq Llama 3.3 70B (cheap second opinion, no fallback)
- **Dependency declarations fixed.** `@latimer-woods-tech/errors` and `@latimer-woods-tech/logger`
  now declared as `^0.2.0` instead of `file:../*` so external consumers can install the package.

### Added

### Fixed
- Restored `@latimer-woods-tech/errors` and `@latimer-woods-tech/logger` as runtime dependencies so published consumers resolve package imports correctly.

### Changed

- Default model constants renamed and grouped under exported `MODELS` catalogue. Kept in sync with
  `docs/architecture/FACTORY_V1.md § LLM substrate`.
- Empty provider responses now surface as leg failures and trigger fallback rather than returning
  an empty `LLMResult`.

### Migration

Replace:

```ts
const res = await complete(msgs, { ANTHROPIC_API_KEY, GROK_API_KEY, GROQ_API_KEY }, { model: 'claude-sonnet-4-...' });
```

With:

```ts
const res = await complete(
  msgs,
  {
    AI_GATEWAY_BASE_URL: env.AI_GATEWAY_BASE_URL,
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    GROQ_API_KEY: env.GROQ_API_KEY,
    VERTEX_ACCESS_TOKEN: env.VERTEX_ACCESS_TOKEN, // minted via JWT-bearer flow
    VERTEX_PROJECT: env.VERTEX_PROJECT,
    VERTEX_LOCATION: env.VERTEX_LOCATION,
  },
  { tier: 'balanced', runId, project: 'prime-self', actor: 'worker' },
);
```

## 0.2.0

Initial public release of the failover orchestrator.
