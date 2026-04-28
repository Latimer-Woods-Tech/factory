-- Phase C: studio test runs.
-- One row per dispatched run; results stream into studio_test_results.
-- Both tables are append-only mostly; status transitions are the only updates.

CREATE TABLE IF NOT EXISTS studio_test_runs (
  id                    UUID         PRIMARY KEY,
  dispatched_from_env   TEXT         NOT NULL,
  gh_run_id             TEXT,
  gh_run_url            TEXT,
  suites                JSONB        NOT NULL DEFAULT '[]'::jsonb,
  filter                TEXT,
  status                TEXT         NOT NULL DEFAULT 'queued',
  started_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  finished_at           TIMESTAMPTZ,
  totals                JSONB        NOT NULL DEFAULT '{"total":0,"passed":0,"failed":0,"skipped":0}'::jsonb,
  dispatched_by         TEXT         NOT NULL,
  CONSTRAINT studio_test_runs_status_chk
    CHECK (status IN ('queued','dispatched','running','passed','failed','cancelled','timed-out'))
);

CREATE INDEX IF NOT EXISTS idx_studio_test_runs_started ON studio_test_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_test_runs_user    ON studio_test_runs (dispatched_by, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_test_runs_gh      ON studio_test_runs (gh_run_id);

CREATE TABLE IF NOT EXISTS studio_test_results (
  run_id        UUID         NOT NULL REFERENCES studio_test_runs(id) ON DELETE CASCADE,
  test_id       TEXT         NOT NULL,
  suite         TEXT         NOT NULL,
  name          TEXT         NOT NULL,
  outcome       TEXT         NOT NULL,
  duration_ms   INTEGER      NOT NULL DEFAULT 0,
  failure       JSONB,
  recorded_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, test_id),
  CONSTRAINT studio_test_results_outcome_chk
    CHECK (outcome IN ('passed','failed','skipped','todo'))
);

CREATE INDEX IF NOT EXISTS idx_studio_test_results_failed ON studio_test_results (run_id, outcome)
  WHERE outcome = 'failed';
