/**
 * Result of a Worker health check.
 */
export interface HealthCheckResult {
  url: string;
  status: number;
  ok: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Shape of a secret descriptor used during deployment verification.
 */
export interface SecretDescriptor {
  name: string;
  required: boolean;
  description: string;
}

/**
 * Standard Factory GitHub Secrets every Worker app must have.
 */
export const REQUIRED_WORKER_SECRETS: SecretDescriptor[] = [
  { name: 'CF_API_TOKEN', required: true, description: 'Cloudflare API token for wrangler deploy' },
  { name: 'CF_ACCOUNT_ID', required: true, description: 'Cloudflare account ID' },
  { name: 'NODE_AUTH_TOKEN', required: true, description: 'GitHub Packages npm auth token' },
  { name: 'SENTRY_DSN', required: true, description: 'Sentry DSN for error reporting' },
  { name: 'POSTHOG_KEY', required: true, description: 'PostHog analytics write key' },
  { name: 'JWT_SECRET', required: true, description: 'HMAC secret for JWT signing (min 32 chars)' },
  { name: 'NEON_URL', required: true, description: 'Neon Postgres connection string' },
] as const;

/**
 * Extra secrets required when Stripe is integrated.
 */
export const STRIPE_SECRETS: SecretDescriptor[] = [
  { name: 'STRIPE_SECRET_KEY', required: true, description: 'Stripe API secret key (sk_...)' },
  { name: 'STRIPE_WEBHOOK_SECRET', required: true, description: 'Stripe webhook signing secret (whsec_...)' },
] as const;

/**
 * Extra secrets required for the video production pipeline.
 */
export const VIDEO_SECRETS: SecretDescriptor[] = [
  { name: 'ANTHROPIC_API_KEY', required: true, description: 'Anthropic API key for LLM script generation' },
  { name: 'ELEVENLABS_API_KEY', required: true, description: 'ElevenLabs API key for TTS narration' },
  { name: 'CF_STREAM_TOKEN', required: true, description: 'Cloudflare Stream API token' },
  { name: 'R2_ACCESS_KEY_ID', required: true, description: 'R2 S3-compatible access key' },
  { name: 'R2_SECRET_ACCESS_KEY', required: true, description: 'R2 S3-compatible secret key' },
  { name: 'R2_BUCKET_NAME', required: true, description: 'R2 bucket name for video storage' },
  { name: 'R2_PUBLIC_DOMAIN', required: true, description: 'R2 public URL domain' },
  { name: 'SCHEDULE_WORKER_URL', required: true, description: 'Schedule Worker HTTPS endpoint' },
  { name: 'WORKER_API_TOKEN', required: true, description: 'Bearer token for schedule Worker PATCH endpoint' },
] as const;

/**
 * Builds the canonical workers.dev URL for a given Worker name.
 * All Factory Workers live at `{name}.adrper79.workers.dev`.
 */
export function buildWorkerUrl(name: string, accountSubdomain = 'adrper79'): string {
  return `https://${name}.${accountSubdomain}.workers.dev`;
}

/** @internal fetch type for injection */
export type FetchFn = typeof fetch;

/** Dependencies for deploy helpers (allows test injection). */
export interface DeployDeps {
  fetch?: FetchFn;
}

/**
 * Performs a single HTTP health check against a Worker's `/health` endpoint.
 */
export async function checkHealth(
  workerUrl: string,
  deps: DeployDeps = {},
): Promise<HealthCheckResult> {
  const url = `${workerUrl.replace(/\/$/, '')}/health`;
  const fetchFn = deps.fetch ?? fetch;
  const start = Date.now();

  try {
    const res = await fetchFn(url);
    const durationMs = Date.now() - start;

    return {
      url,
      status: res.status,
      ok: res.ok,
      durationMs,
    };
  } catch (err) {
    return {
      url,
      status: 0,
      ok: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Retries a health check until it passes or exhausts retries.
 * Uses exponential back-off (doubling delay each attempt).
 */
export async function waitForHealth(
  workerUrl: string,
  retries = 5,
  initialDelayMs = 1000,
  deps: DeployDeps = {},
): Promise<HealthCheckResult> {
  let delay = initialDelayMs;

  for (let attempt = 0; attempt < retries; attempt++) {
    const result = await checkHealth(workerUrl, deps);
    if (result.ok) return result;

    if (attempt < retries - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  return checkHealth(workerUrl, deps);
}

/**
 * Validates that a set of environment bindings contains all required secrets.
 * Returns the list of missing secret names.
 */
export function validateSecrets(
  env: Record<string, string | undefined>,
  descriptors: SecretDescriptor[],
): string[] {
  return descriptors
    .filter((d) => d.required && !env[d.name])
    .map((d) => d.name);
}

