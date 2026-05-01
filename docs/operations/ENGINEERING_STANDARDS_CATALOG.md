# Factory Engineering Standards Catalog

**W360-033 · Owner: D13 (Engineering Platform), D09 (DevX), D12 (Quality)**  
**Status**: Active · Last updated: 2026-04-29  
**Related**: [CLAUDE.md](../../CLAUDE.md) · [docs/templates/](../templates/) · [docs/runbooks/](../runbooks/)

---

## How to use this catalog

Every standard has:
- **Owner**: discipline responsible for the rule
- **Required gate**: the CI check or review step that enforces it
- **Check mechanism**: how compliance is detected (lint rule, script, test, PR review)
- **Reference**: canonical doc or code location

When adding a new standard, open a PR touching this file and the corresponding gate config.

---

## 1 · Runtime & Platform

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| RT-01 | All Workers use Hono — no Express, Fastify, or Next.js | D09 | TypeScript typecheck | ESLint `no-restricted-imports` for express/fastify | [CLAUDE.md §Stack](../../CLAUDE.md) |
| RT-02 | No `process.env` — use `c.env.VAR` or `env.VAR` via Hono/Worker bindings | D09 | ESLint lint | `no-restricted-globals` / custom rule for `process.env` | [CLAUDE.md §Hard Constraints](../../CLAUDE.md) |
| RT-03 | No Node.js built-ins (`fs`, `path`, `crypto`) | D09 | ESLint lint | `no-restricted-modules` | [CLAUDE.md §Hard Constraints](../../CLAUDE.md) |
| RT-04 | No `Buffer` — use `Uint8Array`, `TextEncoder`, `TextDecoder` | D09 | ESLint lint | `no-restricted-globals` for Buffer | [CLAUDE.md §Hard Constraints](../../CLAUDE.md) |
| RT-05 | No CommonJS `require()` — ESM `import`/`export` only | D09 | TypeScript typecheck | `"module": "ESNext"` in tsconfig | [CLAUDE.md §Hard Constraints](../../CLAUDE.md) |
| RT-06 | All `wrangler.jsonc` files use `$schema`, `compatibility_date: 2025-01-01`, `nodejs_compat` | D09 | Config audit script | `scripts/check-wrangler-config.mjs` (planned) | [docs/CONFIG_NORMALIZATION_AUDIT.md](../CONFIG_NORMALIZATION_AUDIT.md) |
| RT-07 | Every Worker exposes `GET /health` and `GET /manifest` | D09 | Smoke test | Synthetic monitor probe + manifest schema validation | [apps/synthetic-monitor](../../apps/synthetic-monitor/) |

---

## 2 · Language & TypeScript

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| TS-01 | TypeScript strict — zero `any` in public APIs | D09 | TypeScript typecheck | `"strict": true`, `"noImplicitAny": true` in tsconfig | [CLAUDE.md §Quality Gates](../../CLAUDE.md) |
| TS-02 | ESLint zero warnings with `--max-warnings 0` | D09 | ESLint lint | `npm run lint` in CI | [CLAUDE.md §Quality Gates](../../CLAUDE.md) |
| TS-03 | Build via tsup in ESM-only mode | D09 | Build step | `tsup src/index.ts --format esm --dts` | [CLAUDE.md §Stack](../../CLAUDE.md) |
| TS-04 | No `@ts-ignore` or `eslint-disable` suppressions | D09 | PR review + ESLint | `no-warning-comments` + reviewer checklist | [CLAUDE.md §Error Recovery Protocol](../../CLAUDE.md) |

---

## 3 · Testing & Coverage

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| TEST-01 | Unit test coverage ≥ 90% lines + functions; ≥ 85% branches | D12 | Vitest coverage | `@vitest/coverage-v8` with thresholds in `vitest.config.ts` | [CLAUDE.md §Quality Gates](../../CLAUDE.md) |
| TEST-02 | Test framework: Vitest + `@cloudflare/vitest-pool-workers` | D12 | CI | `npm test` must pass with no failures | [CLAUDE.md §Stack](../../CLAUDE.md) |
| TEST-03 | No unit tests that call real external APIs (Stripe, PostHog, Neon) | D12 | PR review | Mock all HTTP in tests via `vi.fn()` / fetch injection | [packages/analytics/src/index.ts](../../packages/analytics/src/index.ts) |

---

## 4 · Documentation

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| DOC-01 | ≥ 90% of exported symbols have JSDoc | D13 | TypeScript build | TSDoc-to-Mintlify pipeline (planned) | [CLAUDE.md §Quality Gates](../../CLAUDE.md) |
| DOC-02 | Every new architectural decision gets an ADR | D13 | PR review | Template at `docs/templates/adr/template.md`; linked from PR | [docs/templates/adr/template.md](../templates/adr/template.md) |
| DOC-03 | Every public Worker API has an OpenAPI 3.1.0 spec | D13 | PR review | Template at `docs/templates/openapi/template.yaml` | [docs/templates/openapi/template.yaml](../templates/openapi/template.yaml) |
| DOC-04 | Every new Worker starts from the canonical template | D13 | PR review | Template at `docs/templates/worker-basic/` | [docs/templates/worker-basic/](../templates/worker-basic/) |
| DOC-05 | Commit format: `<type>(<scope>): <description>` | D13 | Commitlint (planned) | Allowed types: feat/fix/docs/test/refactor/chore/perf | [CLAUDE.md §Commit Format](../../CLAUDE.md) |

---

## 5 · Auth & Security

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| AUTH-01 | JWT is self-managed with Web Crypto API — never `jsonwebtoken` | D05 | ESLint lint | `no-restricted-imports` for jsonwebtoken | [packages/auth/](../../packages/auth/) |
| AUTH-02 | No secrets in source code or `wrangler.jsonc` `vars` block | D05 | PR review + secret scan | GitHub secret scanning; peer review | [CLAUDE.md §Hard Constraints](../../CLAUDE.md) |
| AUTH-03 | Stripe webhook signature verification via HMAC-SHA256 | D05 | Unit tests | `packages/neon/src/entitlements/webhook.test.ts` | [packages/neon/src/entitlements/webhook.ts](../../packages/neon/src/entitlements/webhook.ts) |
| AUTH-04 | All money-touching routes require JWT auth middleware | D05 | PR review + authz tests | `packages/studio-core` authz test patterns | [docs/runbooks/lessons-learned.md](../runbooks/lessons-learned.md) |

---

## 6 · Money & Payments

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| MONEY-01 | Stripe client created via `createStripeClient()` from `@adrper79-dot/stripe` | D07 | PR review | No raw `new Stripe(...)` outside the package | [packages/stripe/src/index.ts](../../packages/stripe/src/index.ts) |
| MONEY-02 | Credit guardrails applied before every render dispatch | D07 | Unit tests | `checkRenderGuardrails()` must be called; enforce via PR review | [packages/neon/src/entitlements/guardrails.ts](../../packages/neon/src/entitlements/guardrails.ts) |
| MONEY-03 | Stripe webhook idempotency — duplicate events must not double-apply | D07 | Unit tests | `processedEvents` table check in webhook handler | [packages/neon/src/entitlements/webhook.ts](../../packages/neon/src/entitlements/webhook.ts) |
| MONEY-04 | All Stripe test-card flows verified via `curl` before marking complete | D07 | Manual gate | `curl -X POST .../stripe/webhook` with test event | [CLAUDE.md §Verification Requirement](../../CLAUDE.md) |

---

## 7 · AI / LLM

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| AI-01 | LLM chain priority: Anthropic → Grok → Groq | D11 | PR review | `packages/llm` implements fallback chain | [packages/llm/](../../packages/llm/) |
| AI-02 | No raw `fetch` to LLM APIs — use `@adrper79-dot/llm` | D11 | PR review + ESLint | No hardcoded `https://api.anthropic.com` in app code | [packages/llm/src/index.ts](../../packages/llm/src/index.ts) |
| AI-03 | LLM prompts version-controlled as `.prompt.md` or TypeScript string constants | D11 | PR review | No prompt strings assembled at runtime without log | [CLAUDE.md §Stack](../../CLAUDE.md) |

---

## 8 · Analytics & Observability

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| OBS-01 | All errors reported to Sentry via `@adrper79-dot/monitoring` | D10 | PR review | No direct `Sentry.captureException()` outside monitoring package | [packages/monitoring/](../../packages/monitoring/) |
| OBS-02 | All analytics events use canonical event schemas from `@adrper79-dot/analytics` | D10 | Unit tests | `assertEventShape()` validates shape at emit time | [packages/analytics/src/event-schemas.ts](../../packages/analytics/src/event-schemas.ts) |
| OBS-03 | Revenue/subscription events go to `factory_events` only — not PostHog | D10 | Unit tests | `isBusinessEvent()` routing enforced in `initAnalytics()` | [packages/analytics/src/index.ts](../../packages/analytics/src/index.ts) |
| OBS-04 | SLO targets defined for all user journeys; synthetic monitor proxies active | D10 | Synthetic monitor | `apps/synthetic-monitor` target list includes all live workers | [docs/operations/USER_JOURNEY_SLOS.md](USER_JOURNEY_SLOS.md) |

---

## 9 · Database & Config

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| DB-01 | Database accessed via Hyperdrive binding `env.DB` — no raw connection strings | D09 | PR review | No `postgres://` or `DATABASE_URL` as string in source | [docs/runbooks/database.md](../runbooks/database.md) |
| DB-02 | Schema migrations via Drizzle ORM only — no raw DDL in app code | D09 | PR review | Migrations in `migrations/` directory; Drizzle `db:migrate` script | [docs/runbooks/database.md](../runbooks/database.md) |
| DB-03 | All Worker `package.json` files have `"private": true`, `"license": "MIT"`, and `"repository"` block | D09 | Config audit | `docs/CONFIG_NORMALIZATION_AUDIT.md` checklist | [docs/CONFIG_NORMALIZATION_AUDIT.md](../CONFIG_NORMALIZATION_AUDIT.md) |

---

## 10 · Release & Deployment

| ID | Standard | Owner | Required gate | Check mechanism | Reference |
|----|----------|-------|--------------|-----------------|-----------|
| REL-01 | A fix is done when `curl /health` returns 200 — CI green is not enough | D09 | Post-deploy manual gate | Standing rule: `curl https://{name}.adrper79.workers.dev/health` | [CLAUDE.md §Verification Requirement](../../CLAUDE.md) |
| REL-02 | Worker renames require full consumer-URL update before deployment | D09 | Pre-deploy checklist | Worker Rename Protocol in CLAUDE.md | [CLAUDE.md §Worker Rename Protocol](../../CLAUDE.md) |
| REL-03 | Dependency updates managed by Renovate — no manual version bumps without a PR | D09 | Renovate config | `renovate.json` grouping rules | [renovate.json](../../renovate.json) |
| REL-04 | Every package publishes a `dist/` via `tsup` before dependents can consume it | D09 | Build gate | `npm run build` in CI; dependents gate on dist existence | [CLAUDE.md §Package Dependency Order](../../CLAUDE.md) |

---

## Enforcement gap register

Items below are not yet automated — enforcement is currently by PR review only:

| ID | Standard | Planned automation | Target sprint |
|----|----------|--------------------|--------------|
| RT-02 | No `process.env` | Custom ESLint rule or `no-process-env` | Sprint 2 |
| DOC-01 | ≥ 90% JSDoc coverage | TSDoc-to-Mintlify coverage report in CI | Sprint 3 |
| DOC-05 | Commit format | Commitlint in `.github/workflows/` | Sprint 2 |
| AUTH-04 | Authz route coverage | Automated authz matrix test generator | Sprint 4 |
