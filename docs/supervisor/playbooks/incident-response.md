# Playbook: Incident Response & Sentry Triage
> Loaded by the supervisor for `sentry-triage-new-issue` templates.

## Severity
| Level | Definition | Response |
|---|---|---|
| P0 | Production down, data loss, billing broken | Pushover critical immediately |
| P1 | Degraded for paying users | Fix within hours |
| P2 | Some users affected, workaround exists | Fix within 24h |
| P3 | Non-customer-facing, cosmetic | Normal queue |

## Triage checklist
1. Error class + message — known pattern?
2. First seen vs last seen — new or recurring?
3. Event count + affected users
4. Stack trace — which worker, which function?
5. PR already fixing this?

## Common patterns
- `DatabaseError: column X does not exist` → P1. Migration not applied.
- `DatabaseError: bind message supplies N params, requires M` → P1. Query/caller out of sync.
- `Stripe event parked: invoice.paid` → P3. checkout.session.completed handled correctly.
- WebSocket 429 → P2. CF Workers rate limit.
- CSP violation → P2. Inline script hash stale. See security.md.

## What to put in Sentry comment
Root cause (one sentence), affected user count, proposed fix, link to fix PR.
