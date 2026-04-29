# Admin Studio Command Plane Prompt

Use this prompt for Admin Studio API/UI, Studio Core, AI command intake, smoke runners, deployment controls, or operator console features.

## Mission

Build Admin Studio as a governed operating console, not an unsafe shortcut around engineering discipline. Every mutating capability must be policy-backed, auditable, reversible when possible, and connected to branch/PR/CI/deploy evidence.

## Required preflight

1. Read `CLAUDE.md` hard constraints.
2. Read `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md` OWR-011, OWR-012, and Admin Studio Command-Plane Requirements.
3. Read `docs/admin-studio/00-MASTER-PLAN.md` if present.
4. Inspect relevant entry points:
   - `apps/admin-studio/src/index.ts`
   - `apps/admin-studio/src/routes/`
   - `apps/admin-studio-ui/src/pages/tabs/`
   - `packages/studio-core/src/index.ts`
5. Run `git status -sb` and identify existing local changes before editing.

## Safety model

Every command-plane feature must define:

| Field | Requirement |
|---|---|
| Intent | What operator outcome is requested |
| Target | Repo, path, Worker, app, DB, workflow, or endpoint |
| Environment | local, preview, staging, production |
| Risk tier | read-only, reversible, production, destructive, money-moving |
| Auth/RBAC | Who can run it and what scope is required |
| Confirmation | Whether nonce, type-to-confirm, or two-person approval is required |
| Dry run | Preview of diff, command, payload, or deploy before mutation |
| Audit | user, request ID, target, action, result, evidence, redacted payload |
| Rollback | Branch revert, workflow retry, secret rotation, DB rollback, or manual recovery |
| Verification | Tests, smoke probes, endpoint curls, workflow runs, or runbook evidence |

## Implementation rules

- Start read-only before mutating workflows.
- Mutating source changes must go through branch + PR + CI unless explicitly an emergency rollback path.
- Never let freeform AI directly edit `main` or production data.
- All secrets must be redacted in logs, audit rows, UI payloads, and error responses.
- Smoke runners must use service registry targets and record status code, timestamp, duration, and response classification.
- Production deploy controls require CI green, direct smoke pass, approval, and rollback link.

## Quality gates

- API route tests for authorization, invalid payloads, audit writes, and failure states.
- UI tests or smoke coverage for loading, empty, error, permission denied, and success states.
- Typecheck/lint/build for both API and UI when touched.
- Direct endpoint verification for deployed Worker changes.

## Output requirements

Return:

1. Feature status: documented, implemented, deployed, or verified.
2. Risk tier and safety controls added.
3. Tests and verification performed.
4. Audit/event evidence.
5. Remaining command-plane gaps.
