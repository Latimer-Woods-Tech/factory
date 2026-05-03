# Playbook: Database Migrations
> Loaded by the supervisor for `db-migration-gap-fix` templates.

## Cardinal rule
Never ship code referencing a column and the migration creating it in the same deploy. Schema first, code second, separate deploys.

## Safe column addition
1. Add nullable with DEFAULT: `ADD COLUMN IF NOT EXISTS foo TEXT DEFAULT ''`
2. Deploy. Verify column exists in prod.
3. Add NOT NULL constraint only after all rows backfilled, in a later deploy.

## Safe column removal
1. Remove all code references. Deploy.
2. In a later PR, drop the column. Never combine steps.

## Safe rename
1. Add new column, dual-write, deploy. 2. Backfill. 3. Switch reads. 4. Drop old column.

## Rollback SQL
Every migration must have a paired down migration.

## Zero-downtime on Neon/Hyperdrive
- Migrations run before code deploys
- Always use `IF NOT EXISTS` — migrations must be idempotent
- `ALTER TABLE ... ADD COLUMN` is non-blocking on Postgres 11+

## Drift detection
SUP-1.4 added migration drift guard. Missing column → auto-files `db-migration-gap` issue.

## Acceptance gate
Verify column exists in prod via Neon HTTP SQL endpoint before closing the issue.

## Incident: psn.shared_at (2026-05-02)
Migration existed in codebase. Never applied to prod. Result: 14 Sentry errors/day. Fix: 15 minutes via Neon HTTP SQL API. Prevention: drift guard.
