# Playbook: Documentation Standards
> Loaded by the supervisor for `docs-naming-convention` templates.

## Directory taxonomy
| Path | What lives here |
|---|---|
| `docs/architecture/` | Canonical system architecture. `FACTORY_V1.md` is the root. |
| `docs/supervisor/` | Supervisor operating model, templates, playbooks, context |
| `docs/adr/` | Architecture Decision Records — why decisions were made |
| `docs/postmortems/` | Incident postmortems — what went wrong and what changed |
| `docs/runbooks/` | Step-by-step operational procedures |
| `docs/` root | Cross-cutting standards (NAMING_CONVENTIONS, etc.) |
| `apps/<name>/docs/` | App-specific specs only |

## Required docs per app
- `README.md` — what it does, how to run, how to deploy
- `CHANGELOG.md` — semver entries, not a git log
- `capabilities.yml` — required for supervisor eligibility
- At least one runbook

## Doc lifecycle
- **Active:** no prefix
- **Superseded:** add banner, never delete
- **Archived:** move to `docs/archive/`

## ADR format (`docs/adr/NNNN-slug.md`)
```
# NNNN: Title
**Date:** YYYY-MM-DD  **Status:** Accepted|Superseded|Proposed
## Context
## Decision
## Consequences
## Alternatives considered
```

## Postmortem format (`docs/postmortems/YYYY-MM-DD-slug.md`)
```
# YYYY-MM-DD: Title
**Severity:** P0|P1|P2|P3  **Duration:** Xh Ym  **Impact:** N users
## What happened / Root cause / Timeline / What we changed / What we're monitoring
```

## Lessons learned — three layers
1. `docs/adr/` — Why things are the way they are
2. `docs/postmortems/` — What went wrong and what changed
3. `docs/supervisor/plans/` — Operational lessons as executable templates

**When something breaks:** fix it → write the postmortem → author a template so the supervisor handles it next time.
