## [Unreleased]

## [0.2.3] - 2026-04-29

- Replace Neon HTTP driver wiring with a Hyperdrive-compatible Postgres.js adapter.
- Normalize Drizzle `execute()` results to the existing `{ rows }` shape consumed by Factory packages.
- Preserve `rowCount` metadata expected by downstream packages.
- Move migration driver loading behind `runMigrations()` to keep Worker bundles free of Drizzle migrator Node built-ins.
