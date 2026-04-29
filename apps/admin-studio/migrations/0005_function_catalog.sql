-- Phase E — Function catalog.
--
-- One row per (app, env, method, path). Studio's catalog crawler upserts
-- this on every refresh of an app's /manifest. firstSeenAt stays pinned
-- so we can show how long an endpoint has existed; lastSeenAt rolls
-- forward on every successful crawl.

CREATE TABLE IF NOT EXISTS function_catalog (
  id              uuid        PRIMARY KEY,
  app             text        NOT NULL,
  env             text        NOT NULL,
  method          text        NOT NULL,
  path            text        NOT NULL,
  auth            text        NOT NULL,
  summary         text        NOT NULL,
  owner           text,
  reversibility   text,
  slo_p95_ms      integer,
  slo_error_rate  double precision,
  tags            jsonb       NOT NULL DEFAULT '[]'::jsonb,
  smoke           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  build_sha       text,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app, env, method, path)
);

CREATE INDEX IF NOT EXISTS function_catalog_app_env_idx
  ON function_catalog (app, env);

CREATE INDEX IF NOT EXISTS function_catalog_last_seen_idx
  ON function_catalog (last_seen_at DESC);
