# Playbook: Dependency Management
> Loaded by the supervisor for `deps-bump-minor-patch` templates.

## Semver is a promise, not a guarantee
- **Patch**: safe to auto-merge after CI green
- **Minor**: read the CHANGELOG — API removals happen in minor versions
- **Major**: never auto-merge, Red-tier, human review required

## Before merging any `@cloudflare/*` bump
Always read the CHANGELOG. Breaking changes in minor bumps:
- `workers-types` v4 renamed `ScheduledEvent` → `ScheduledController`
- `vitest-pool-workers` v0.15 changed peer dep requirements

## Batch merge danger
Merging 5 Dependabot PRs at once causes lockfile conflicts. Merge one at a time and wait for CI green, or switch deploy CI to `npm install` to self-heal.

## Lockfile desync recovery
If `npm ci` fails with `EUSAGE: lock file does not satisfy`:
1. Switch to `npm install --legacy-peer-deps` as a band-aid
2. File a follow-up to regenerate the lockfile

## Always typecheck after `@cloudflare/*` bumps
Run `npm run typecheck` before considering the bump done.

## Incident (2026-05-02)
Batch-merged 5 PRs. Three compounding failures: lockfile desync, `ScheduledEvent` rename, `stream` export removal from llm@0.3.0. ~1.5h to resolve across 6 fix PRs.
