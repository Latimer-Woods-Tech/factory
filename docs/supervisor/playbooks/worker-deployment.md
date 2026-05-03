# Playbook: Worker Deployment
> Loaded by the supervisor for `reusable-workflow-rollout` and `wrangler-config-drift-fix` templates.

## Schema before code
Deploy schema changes first, then code that uses them. Never together.

## Wrangler config checklist
- [ ] `compatibility_date` tested against
- [ ] All bindings declared (KV, R2, D1, Hyperdrive, service bindings)
- [ ] Secrets via `wrangler secret put`, never in `vars`
- [ ] `nodejs_compat` flag if using Node APIs
- [ ] KV namespace IDs match prod namespaces
- [ ] Service binding names match the target worker's `name` field

## KV namespace provisioning
KV namespace must exist in Cloudflare BEFORE the worker binding references it.

## Service bindings
Use for worker-to-worker calls, not HTTP. Faster, no network hop, no auth token needed.

## Canary gate
`_app-prod-canary.yml` runs health + smoke checks after deploy. Sentry spike in first 60 minutes → rollback.

## ScheduledEvent → ScheduledController
`workers-types` v4 renamed the scheduled handler parameter. Check on every workers-types bump.
