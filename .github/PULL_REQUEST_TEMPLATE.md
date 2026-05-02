## Summary

_What does this PR do in one sentence?_

## Blast radius

_Which apps, services, or users are affected? What happens if this breaks?_

## Tier (pick one)

- [ ] **Green** — `docs/**`, `*.md`, `session/**`
- [ ] **Yellow** — `apps/web/**`, non-critical worker routes
- [ ] **Red** — `.github/workflows/**`, `packages/**`, `migrations/**`, Stripe code, prod Wrangler config

## Fridge checklist (`docs/supervisor/FRIDGE.md`)

- [ ] Not touching wordis-bond
- [ ] No credentials in the diff (credential-scrub CI will enforce)
- [ ] Red-tier changes have CODEOWNER review requested
- [ ] `/admin` mutations have out-of-band approval comment if applicable
- [ ] Irreversible actions have explicit approval
- [ ] Related `capabilities.yml` declares correct `side_effects` level if this touches `/admin`

## Validation

- [ ] CI green (typecheck, lint, test, credential-scrub, capabilities-lint where applicable)
- [ ] For runtime changes: curl / smoke test observed with expected status code
- [ ] For production deploys: canary plan noted below

## Related issues

_Closes, fixes, refs._

## Rollback plan

_If this breaks after merge, how do we revert? For migrations: is it reversible?_
