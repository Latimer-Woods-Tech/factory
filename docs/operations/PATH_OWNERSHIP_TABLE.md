# Path Ownership Table

**Last updated:** 2026-04-29  
**Purpose:** prevent multi-agent write collisions by assigning primary ownership for high-risk paths.

## Current Ownership

| Path scope | Primary owner lane | Reviewer lane | Notes |
|---|---|---|---|
| `.github/workflows/**` | D09 Platform/DevOps | D12 QA | Production-impacting workflow changes require deploy-gate evidence |
| `apps/admin-studio/**` | D05 Backend/API | D11 Security | Control-plane routes and auth boundaries |
| `apps/admin-studio-ui/**` | D04 Frontend | D03 UX | Operator UX and environment safety |
| `packages/studio-core/**` | D05 Backend/API | D12 QA | Shared manifests and command contracts |
| `apps/schedule-worker/**` | D08 AI/Video | D10 Observability | Video pipeline entrypoint |
| `apps/video-cron/**` | D08 AI/Video | D09 Platform/DevOps | Dispatch workflow and scheduling |
| `apps/synthetic-monitor/**` | D10 Observability | D09 Platform/DevOps | Synthetic checks and SLO probes |
| `packages/design-tokens/**` | D03 UX | D12 QA | Shared semantic tokens and accessibility defaults |
| `packages/ui/**` | D04 Frontend | D03 UX | Shared UI primitives and accessibility behavior |
| `docs/operations/**` | D01 Program coordination | D13 Docs | Canonical W360 execution board and hardening plans |
| `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md` | D01 Program coordination | D13 Docs | Parent open-work register |
| `docs/service-registry.yml` | D09 Platform/DevOps | D10 Observability | URL authority and consumer mapping |

## Mutation Rules

1. One active owner at a time per path scope.
2. Cross-scope changes require at least one reviewer lane from the table.
3. Workflow or deployment changes must include direct HTTP verification evidence.
4. If ownership conflict appears, coordinator lane D01 resolves before further edits.
