-- factory-supervisor 0.1.0 — memory + run history schema

CREATE TABLE IF NOT EXISTS memory (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_memory_updated ON memory(updated_at DESC);

CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  template_id TEXT,
  tier TEXT NOT NULL,
  source TEXT NOT NULL,              -- human | webhook | dreamstate | scheduled
  description TEXT NOT NULL,
  status TEXT NOT NULL,              -- planned | running | succeeded | failed | canceled
  plan_json TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  error_code TEXT,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS ix_runs_status ON runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_runs_template ON runs(template_id);

CREATE TABLE IF NOT EXISTS run_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  tool TEXT NOT NULL,
  side_effects TEXT NOT NULL,
  slots_json TEXT NOT NULL,
  status TEXT NOT NULL,              -- pending | skipped | succeeded | failed
  result_json TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  FOREIGN KEY (run_id) REFERENCES runs(run_id)
);
CREATE INDEX IF NOT EXISTS ix_steps_run ON run_steps(run_id, step_index);

CREATE TABLE IF NOT EXISTS locks_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  holder TEXT NOT NULL,
  action TEXT NOT NULL,              -- acquired | released | expired | denied
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_locks_key_at ON locks_audit(key, at DESC);
