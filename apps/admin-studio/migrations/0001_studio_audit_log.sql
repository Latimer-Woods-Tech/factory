-- Studio audit log table.
-- Run against each environment's database (local / staging / production).
-- All Studio mutations append a row here. Reads from /audit routes (Phase D).

CREATE TABLE IF NOT EXISTS studio_audit_log (
  id              UUID         PRIMARY KEY,
  occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  user_id         TEXT         NOT NULL,
  user_email      TEXT         NOT NULL,
  user_role       TEXT         NOT NULL,
  session_id      TEXT         NOT NULL,
  env             TEXT         NOT NULL CHECK (env IN ('local','staging','production')),
  action          TEXT         NOT NULL,
  resource        TEXT,
  resource_id     TEXT,
  reversibility   TEXT         NOT NULL CHECK (reversibility IN ('trivial','reversible','manual-rollback','irreversible')),
  payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  result          TEXT         NOT NULL CHECK (result IN ('success','failure','dry-run')),
  result_detail   JSONB,
  ip_address      TEXT,
  user_agent      TEXT,
  request_id      TEXT         NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_studio_audit_occurred_at ON studio_audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_audit_user        ON studio_audit_log (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_audit_action      ON studio_audit_log (action, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_audit_env         ON studio_audit_log (env, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_audit_request     ON studio_audit_log (request_id);

-- Append-only by policy. Restrict UPDATE/DELETE except for the migrator role.
-- (RLS lands with the @latimer-woods-tech/neon integration in Phase B.)
