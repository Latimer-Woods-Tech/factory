-- @latimer-woods-tech/llm-meter 0.1.0 — D1 ledger schema
-- Apply via: wrangler d1 execute <DB> --file=node_modules/@latimer-woods-tech/llm-meter/migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS llm_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  actor TEXT NOT NULL,             -- human | sauna | copilot | supervisor-future | worker
  run_id TEXT,
  workload TEXT,                   -- synthesis | planner | verifier | small
  provider TEXT NOT NULL,          -- anthropic | gemini | groq
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  cached_input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL,
  yyyy_mm TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_llm_ledger_project_month ON llm_ledger(project, yyyy_mm);
CREATE INDEX IF NOT EXISTS ix_llm_ledger_run ON llm_ledger(run_id);
CREATE INDEX IF NOT EXISTS ix_llm_ledger_actor_month ON llm_ledger(actor, yyyy_mm);
