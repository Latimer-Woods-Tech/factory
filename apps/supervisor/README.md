# factory-supervisor

Phase 1 scaffold of the Factory supervisor plane, per SUP-3.4 and the canonical architecture in `docs/architecture/FACTORY_V1.md`.

## Status: scaffold (SUP-3.4)

This worker **does not run yet**. It ships the file layout, DO classes, and stubs so SUP-3.5 can wire the execution leg without re-litigating the skeleton. Deploying it today would give you a working `/health` endpoint and noop `/scheduled` heartbeat — nothing more.

## Layout

```
apps/supervisor/
├── wrangler.jsonc              # routes, DO bindings, D1 bindings, env
├── src/
│   ├── index.ts                # Worker fetch + scheduled entry
│   ├── supervisor.do.ts        # SupervisorDO (singleton)
│   ├── lock.do.ts              # LockDO (D3 primitive)
│   ├── tools/
│   │   └── registry.ts         # ToolRegistry + Tool type
│   ├── memory/
│   │   └── d1.ts               # readMemory / writeMemory / listMemoryKeys
│   └── planner/
│       ├── match.ts            # matchTemplate (keyword scoring)
│       ├── parameterize.ts     # slot fill (literal)
│       └── load.ts             # template loader (seed only)
└── migrations/
    └── 0001_init.sql           # memory + run history tables
```

## Endpoints (Phase 1)

- `GET  /health`      — liveness + registered tool count
- `GET  /state`       — last scheduled tick, tool names
- `POST /scheduled`   — heartbeat; logs to memory
- `POST /plan`        — dry-run matchTemplate + parameterize, returns plan without executing
- `POST /run`         — **501 NOT_IMPLEMENTED** until SUP-3.5

## Blocked on decisions

- **O1** (`factory#110`) — runtime location: new `apps/supervisor` (this) vs embedding in each app
- **O2** (`factory#111`) — memory backend: D1 (this) vs CF Agent Memory primary
- **O3** (`factory#112`) — template authoring surface: YAML in factory repo (this) vs Notion-backed

Merging this PR **picks defaults** for all three (new worker, D1, YAML). If you resolve a decision differently, revert the relevant module before SUP-3.5.

## Provisioning (before first deploy)

```bash
wrangler d1 create factory-supervisor-memory
wrangler d1 create factory-supervisor-ledger
# copy both database_ids into wrangler.jsonc
wrangler d1 execute factory-supervisor-memory \
  --file=apps/supervisor/migrations/0001_init.sql
wrangler d1 execute factory-supervisor-ledger \
  --file=node_modules/@latimer-woods-tech/llm-meter/migrations/0001_init.sql
```

## What SUP-3.5 adds

- Populates `ToolRegistry` from `apps/*/capabilities.yml` at boot
- Wires `meteredComplete` into the plan execution loop
- Adds `POST /run` end-to-end
- Loads templates from `docs/supervisor/plans/*.yml` at build time
- Scheduled cron → daily reconciliation loop
- Pushover alerts on budget exceeded / extra-guard denied
