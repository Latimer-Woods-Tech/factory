# Changelog

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

- Gemini 2.5 Pro via Vertex AI as long-context fallback (`VERTEX_ACCESS_TOKEN`, `VERTEX_PROJECT`, `VERTEX_LOCATION`).
- Anthropic prompt caching (auto-enabled for system prompts ≥ 4096 chars; override via `LLMOptions.promptCache`).
- Per-call cancellation via `LLMOptions.signal: AbortSignal`.
- 3-attempt exponential backoff (250ms · 2^n + jitter) on retryable status (408, 425, 429, 5xx).
- Ledger stamping: `LLMOptions.{runId, project, actor}` propagated to logger for downstream
  consumption by `@latimer-woods-tech/llm-meter`.
- `LLMResult.{model, tier, attempts, gatewayRequestId, tokens.cacheRead, tokens.cacheWrite}` for
  observability and budget accounting.

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
