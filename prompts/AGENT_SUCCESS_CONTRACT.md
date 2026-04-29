# Agent Success Contract Prompt

Use this as the first prompt for any implementation, verification, or reassessment agent.

## Mission

Complete one bounded Factory work item with mature engineering discipline. Do not optimize for speed over evidence. Do not mark work complete until implementation, validation, docs, and verification are all satisfied.

## Required preflight

1. Read `CLAUDE.md` fully.
2. Read `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md` and identify the matching OWR/WCA/phase item.
3. Run `git status -sb` and `git log --oneline -10`.
4. List touched paths before editing.
5. Confirm generated artifacts such as `node_modules/`, `dist/`, and build info will not be staged.

## Scope contract

Before editing, write a short plan with:

| Field | Required content |
|---|---|
| Work item | Dashboard ID or explicit user request |
| Owner mode | Coordinator, platform, app, UI, security, ops, or docs |
| Paths | Exact files/directories allowed for edits |
| Dependencies | Packages, Workers, workflows, secrets, or app repos touched |
| Risk tier | Low, medium, high, production, or money-moving |
| Verification | Commands, tests, curls, workflow runs, or review evidence required |
| Rollback | How to undo safely if validation fails |

## Implementation rules

- Keep edits minimal and cohesive.
- Preserve package boundaries and Worker constraints.
- No `process.env` in Worker runtime code.
- No Node built-ins in Worker runtime code.
- No raw `fetch` without explicit response handling.
- No secrets in source or `wrangler.jsonc` vars.
- Do not use `@ts-ignore`, unqualified `eslint-disable`, or public API `any`.
- Do not create root summary files as task boards; update the dashboard or scoped docs instead.

## Quality gates

Run the tightest relevant gate set:

| Change type | Minimum gates |
|---|---|
| Docs/dashboard | Markdown diagnostics clean; source-of-truth references correct |
| Package | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` |
| Worker | Lint/typecheck/test/build plus deploy workflow if applicable and direct `/health` curl |
| UI | Typecheck/build plus smoke/a11y where available |
| Workflow | Syntax review, dry run/manual dispatch if safe, concurrency and permissions reviewed |
| Security/revenue | Negative tests, audit event, idempotency/replay or rollback evidence |

## Completion rules

A task is complete only if:

1. All relevant gates pass or unresolved blockers are documented.
2. Deployed surfaces are verified by direct HTTP status checks where applicable.
3. Dashboard status is updated with proof links or left unchanged if not proven.
4. `git diff --stat` contains only intentional files.
5. The final response lists what changed, what passed, what remains unresolved, and whether it is safe to proceed.
