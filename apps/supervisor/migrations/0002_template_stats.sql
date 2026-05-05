-- factory-supervisor 0.2.0 — template quality tracking (§5.9)
-- Tracks hit-rate and revert-rate per template so the supervisor can
-- auto-bless (≥3 clean runs) or demote (revert-rate > 20%) templates.

CREATE TABLE IF NOT EXISTS template_stats (
  template_id      TEXT    NOT NULL,
  template_version INTEGER NOT NULL,
  runs_attempted   INTEGER NOT NULL DEFAULT 0,
  runs_passed_intent_verification INTEGER NOT NULL DEFAULT 0,
  runs_merged      INTEGER NOT NULL DEFAULT 0,
  runs_reverted    INTEGER NOT NULL DEFAULT 0,
  runs_human_overridden INTEGER NOT NULL DEFAULT 0,
  last_run_at      INTEGER,
  blessed_at       INTEGER,   -- set when runs_merged >= 3 AND runs_reverted = 0 AND runs_human_overridden = 0
  demoted_at       INTEGER,   -- set when runs_reverted / runs_merged > 0.2 over last 20 runs
  PRIMARY KEY (template_id, template_version)
);
CREATE INDEX IF NOT EXISTS ix_template_stats_blessed ON template_stats(blessed_at) WHERE blessed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_template_stats_demoted ON template_stats(demoted_at) WHERE demoted_at IS NOT NULL;
