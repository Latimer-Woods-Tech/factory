# Factory Core — Standing Orders

## Mission
Bootstrap and evolve the Factory Core repository as the shared infrastructure layer for Factory applications.
Stage 0 produces scaffolding only; later stages implement package behavior without violating these standing orders.
- Keep package boundaries clean so apps can install only the shared infrastructure they need.
- Treat every package as reusable infrastructure, never as a home for app-specific business logic.

## Stack
- Runtime: Cloudflare Workers only
- Router: Hono (never Express, Fastify, Next.js)
- Database: Neon Postgres via Hyperdrive binding (`env.DB`)
- Auth: JWT self-managed with the Web Crypto API (never `jsonwebtoken`)
- LLM chain: Anthropic → Grok → Groq
- Telephony: Telnyx + Deepgram + ElevenLabs
- Email: Resend
- Errors: Sentry via `@factory/monitoring`
- Analytics: PostHog plus the first-party `factory_events` table
- Docs: Mintlify
- Build: tsup (ESM only)
- Test: Vitest + `@cloudflare/vitest-pool-workers`
- Language: TypeScript strict with zero `any` in public APIs

## Hard Constraints
- No `process.env` anywhere; use Hono or Worker bindings (`c.env.VAR` / `env.VAR`)
- No Node.js built-ins such as `fs`, `path`, or `crypto`; use platform-safe APIs
- No CommonJS `require()`; use ESM `import` / `export` only
- No `Buffer`; use `Uint8Array`, `TextEncoder`, or `TextDecoder`
- No raw `fetch` without explicit error handling
- No secrets in source code or in `wrangler.jsonc` `vars`

## Package Dependency Order
1. `@factory/errors` (no deps)
2. `@factory/monitoring` (deps: errors)
3. `@factory/logger` (deps: errors, monitoring)
4. `@factory/auth` (deps: errors, logger)
5. `@factory/neon` (deps: errors, logger)
6. `@factory/stripe` (deps: errors, logger, neon)
7. `@factory/llm` (deps: errors, logger)
8. `@factory/telephony` (deps: errors, logger, llm)
9. `@factory/analytics` (deps: errors, neon)
10. `@factory/deploy` (no deps; scripts only)
11. `@factory/testing` (no deps; mock factories)
12. `@factory/email` (deps: errors, logger)
13. `@factory/copy` (deps: llm)
14. `@factory/content` (deps: neon, copy)
15. `@factory/social` (deps: content)
16. `@factory/seo` (no deps)
17. `@factory/crm` (deps: neon, analytics)
18. `@factory/compliance` (deps: neon)
19. `@factory/admin` (deps: auth, analytics)

## Quality Gates
- TypeScript strict: zero errors
- ESLint: zero warnings with `--max-warnings 0`
- Unit coverage: at least 90% lines and functions, at least 85% branches
- Build: `tsup` produces `dist/` with no errors
- JSDoc: at least 90% of exported symbols documented

## Commit Format
Use `<type>(<scope>): <description>`.
Allowed types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`.
Scope must be the package name without the `@factory/` prefix.
Example: `feat(errors): add ValidationError with field-level context`

## Error Recovery Protocol
If a build fails:
1. Read the full error instead of guessing.
2. Check the Hard Constraints list first; most failures are constraint violations.
3. Fix the root cause; never suppress with `@ts-ignore` or `eslint-disable`.
4. Re-run the full quality gate sequence before continuing.
5. If blocked after two attempts, write `BLOCKED.md`, explain the blocker, and stop.

## Session Start Checklist
Before writing any code:
1. Read `CLAUDE.md` completely.
2. Read the package's existing `src/index.ts`.
3. Run `npm run typecheck` and note existing errors.
4. Run `npm test` and note the current coverage baseline.
5. Check `git log --oneline -10` to understand recent changes.
6. Confirm the phase being built by checking `/prompts/`.

## Stage Discipline
- Stage 0 stops at scaffolding and repository policy setup only.
- Do not start package implementations until the matching prompt exists in `/prompts/`.
- Preserve the documented dependency order to avoid circular imports between packages.
