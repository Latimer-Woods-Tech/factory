/**
 * Worker bindings — declared here so every module gets typed access.
 * Secrets must be set via `wrangler secret put`, never in vars.
 */
export interface Env {
  // ── Vars (non-secret, in wrangler.jsonc) ────────────────────────────────
  STUDIO_ENV: 'local' | 'staging' | 'production';
  ALLOWED_ORIGINS: string;

  // ── Bindings ────────────────────────────────────────────────────────────
  DB: Hyperdrive;

  // ── Secrets (wrangler secret put) ───────────────────────────────────────
  /** Signing key for Studio-issued JWTs */
  JWT_SECRET: string;
  /** Personal access token used to dispatch GH Actions workflows */
  GITHUB_TOKEN: string;
  /** Anthropic API key for AI chat */
  ANTHROPIC_API_KEY: string;
  /** Grok fallback */
  XAI_API_KEY?: string;
  /** Groq fallback */
  GROQ_API_KEY?: string;
  /** Sentry DSN for error reporting */
  SENTRY_DSN?: string;

  // ── Phase B: observability proxy secrets (all optional) ─────────────────
  /** Cloudflare API token (Workers Scripts:Read) for deploy-version reads */
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  /** Sentry user-auth token used to read recent issues */
  SENTRY_AUTH_TOKEN?: string;
  SENTRY_ORG?: string;
  SENTRY_PROJECT?: string;
  /** PostHog personal API key for HogQL queries */
  POSTHOG_API_KEY?: string;
  POSTHOG_PROJECT_ID?: string;
  POSTHOG_HOST?: string;
}
