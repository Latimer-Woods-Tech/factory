# Open Work Register Coordinator Prompt

Use this prompt when reassessing Factory status or updating `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md`.

## Mission

Maintain one evidence-backed source of truth. Reconcile recent commits, workflow runs, deployed endpoints, docs, and unresolved risks into the dashboard without hiding ambiguity.

## Inputs to inspect

1. `git status -sb`
2. `git log --oneline -20`
3. `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md`
4. `docs/service-registry.yml`
5. `.github/workflows/`
6. `scripts/phase-6-orchestrator.mjs`
7. `scripts/phase-7-validate.js`
8. Recent workflow runs relevant to touched services
9. Direct endpoint health checks for live Workers/Pages

## Required output format

For each finding, use this table shape:

| ID | Domain | Reality | Gap | Recommendation | Evidence | Verification |
|---|---|---|---|---|---|---|

Rules:

- Use `documented`, `implemented`, `deployed`, or `verified` status language.
- Never mark a deployed service complete without a direct HTTP status check.
- Never mark a workflow complete solely because the file exists.
- Link evidence to file paths, workflow run IDs, commit SHAs, endpoint results, or docs.
- Keep old root summary files historical; do not promote them to task-board status.

## Reassessment checklist

- [ ] Identify what changed since the last dashboard update.
- [ ] Identify items that were previously unresolved and are now done.
- [ ] Identify items still unresolved despite recent progress.
- [ ] Identify newly introduced risks from recent commits.
- [ ] Update the Open Work Register with next verification, not vague next steps.
- [ ] Record prompt or workflow gaps that caused previous low success rates.

## Status update rule

Use this pattern for OWR rows:

`Current state`: `DONE` only when proof exists; otherwise use `In progress`, `Blocked`, `Waiting`, or `Required`.

`Next verification`: concrete command, workflow, endpoint, or artifact required to close the item.

## Safe-proceed check

Before handing off, report:

- tracked modified files,
- untracked/generated artifacts risk,
- latest commit and branch alignment,
- whether `git add .` is unsafe,
- exact files intentionally changed.
