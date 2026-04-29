/**
 * Cloudflare Worker bindings for the synthetic monitor.
 *
 * Configuration values here are non-secret. Any future alert webhook tokens must
 * be added with `wrangler secret put`, never as `wrangler.jsonc` vars.
 */
export interface Env {
  /** Runtime environment label. */
  ENVIRONMENT: string;
  /** Optional JSON array of monitor targets. Empty or invalid values fall back to defaults. */
  TARGETS_JSON?: string;
}
