# Factory Prompt Index

**Status:** Active prompt directory for current Factory execution.
**Canonical roadmap:** [../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md)
**Standing orders:** [../CLAUDE.md](../CLAUDE.md)

## Active prompts

Use these prompts for new agent work. The old `STAGE_1*.md` prompts are historical and must not be used for current implementation.

| Prompt | Use when | Required output |
|---|---|---|
| [AGENT_SUCCESS_CONTRACT.md](AGENT_SUCCESS_CONTRACT.md) | Starting any implementation or reassessment agent | Plan, evidence, quality gates, verification, and final status |
| [OWR_COORDINATOR_PROMPT.md](OWR_COORDINATOR_PROMPT.md) | Updating dashboard or Open Work Register status | Source-of-truth update with proof and unresolved items |
| [PHASE_E_VIDEO_REVENUE_PROMPT.md](PHASE_E_VIDEO_REVENUE_PROMPT.md) | Working on video, Stream/R2, render, SelfPrime embed, or revenue proof paths | End-to-end evidence and direct HTTP verification |
| [ADMIN_STUDIO_COMMAND_PLANE_PROMPT.md](ADMIN_STUDIO_COMMAND_PLANE_PROMPT.md) | Working on Admin Studio control-plane/AI/operator features | Safety model, dry-run, audit, RBAC, tests, and rollback notes |

## Success-rate rules

Every prompt must make the agent do these in order:

1. Read [../CLAUDE.md](../CLAUDE.md) and the relevant package/app entry point.
2. Inspect `git status -sb` and recent commits.
3. Confirm canonical dashboard/OWR item before editing.
4. Keep scope bounded to listed files and dependencies.
5. Run quality gates appropriate to the touched package/app.
6. For deployed services, verify with direct HTTP checks, not CI alone.
7. Update [../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) only with evidence-backed status.
8. Report unresolved risks instead of marking work complete prematurely.

## Historical prompts

- [STAGE_1.md](STAGE_1.md) — historical Stage 1 package prompt; package scope and naming are stale.
- [STAGE_1_FOUNDATION.md](STAGE_1_FOUNDATION.md) — historical duplicate; do not use for current execution.
