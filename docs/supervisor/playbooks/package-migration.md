# Playbook: Package Migration
> Loaded by the supervisor for `package-version-migration` templates.

## The migration pattern
1. Read `packages/<name>/src/index.ts` — don't guess the API
2. Check what inline implementation does vs package — they may differ
3. Update `package.json`, install
4. Update imports one file at a time
5. Run `npm run typecheck` before committing
6. Delete inline file only after all callers updated and typecheck clean
7. Validate on 20 historical requests

## The llm@0.3.0 incident (2026-05-02)
- `stream` export removed — any `import { stream }` broke
- `complete()` signature changed: `0.2.x` was `complete(env, options)`, `0.3.0` is `complete(messages, env, opts)`
- Returns `FactoryResponse<LLMResult>` — extract via `result.data?.content ?? ''`

**Lesson:** Read the function signature, not just the version number.

## Acceptance gate
All tests pass AND typecheck is clean.
