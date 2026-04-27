import type { Hyperdrive } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker bindings for the schedule-worker.
 *
 * Secrets are injected via `wrangler secret put` — never put secrets in
 * wrangler.jsonc vars.
 */
export interface Env {
  /** Neon Postgres via Hyperdrive — set via wrangler.jsonc `hyperdrive` binding. */
  DB: Hyperdrive;
  /**
   * Bearer token that the render-video workflow (and cron Worker) must send
   * in the `Authorization: Bearer <token>` header when calling PATCH /jobs/:id.
   * Set via: `wrangler secret put WORKER_API_TOKEN`
   */
  WORKER_API_TOKEN: string;
  /** Worker environment label (development | staging | production). */
  ENVIRONMENT: string;
}
