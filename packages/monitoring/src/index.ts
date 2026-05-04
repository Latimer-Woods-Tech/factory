import * as Sentry from '@sentry/cloudflare';
import type { MiddlewareHandler } from 'hono';

// ---------------------------------------------------------------------------
// PostHog — lightweight HTTP wrapper for Cloudflare Workers
// ---------------------------------------------------------------------------

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

/** @internal Looser fetch signature compatible with vi.fn mocks. */
type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Initialization settings for the PostHog client.
 */
export interface PostHogConfig {
  /** PostHog project API key (e.g. `phc_...`). Never hardcode; read from `env.POSTHOG_KEY`. */
  apiKey: string;
  /**
   * PostHog ingest host. Defaults to `https://us.i.posthog.com`.
   * Override for EU region (`https://eu.i.posthog.com`) or self-hosted deployments.
   */
  host?: string;
}

/**
 * Injected dependencies for {@link initPostHog} — primarily for testing.
 */
export interface PostHogDeps {
  fetch?: FetchFn;
}

/**
 * Lightweight PostHog client returned by {@link initPostHog}.
 * All methods are fire-and-forget safe: failures are captured as Sentry
 * warnings rather than thrown, so monitoring never crashes the application.
 */
export interface PostHogClient {
  /**
   * Captures a custom event.
   *
   * @param event - Event name (e.g. `'page_view'`, `'button_clicked'`).
   * @param distinctId - User or session identifier. Use `'anonymous'` when unknown.
   * @param properties - Arbitrary key/value properties attached to the event.
   */
  capture(event: string, distinctId: string, properties?: Record<string, unknown>): Promise<void>;
  /**
   * Identifies a user and attaches profile properties.
   *
   * @param distinctId - The user's stable identifier.
   * @param properties - Profile traits to set (e.g. `{ email, plan }`).
   */
  identify(distinctId: string, properties?: Record<string, unknown>): Promise<void>;
}

/**
 * Initialises a PostHog HTTP client compatible with Cloudflare Workers.
 * Uses the PostHog `/capture/` HTTP endpoint; no Node.js SDK dependency.
 *
 * Failures are logged as Sentry warnings so they never crash the host app.
 *
 * @example
 * ```typescript
 * import { initPostHog } from '@latimer-woods-tech/monitoring';
 *
 * const posthog = initPostHog({ apiKey: env.POSTHOG_KEY });
 * await posthog.capture('video.watched', userId, { videoId, durationMs });
 * ```
 */
export function initPostHog(config: PostHogConfig, deps: PostHogDeps = {}): PostHogClient {
  const host = config.host ?? DEFAULT_POSTHOG_HOST;
  const fetchImpl: FetchFn = deps.fetch ?? fetch;

  async function send(payload: Record<string, unknown>): Promise<void> {
    let res: Response;
    try {
      res = await fetchImpl(`${host}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      captureMessage(
        `PostHog request failed: ${err instanceof Error ? err.message : String(err)}`,
        'warning',
        { host },
      );
      return;
    }

    if (!res.ok) {
      captureMessage(`PostHog capture returned ${String(res.status)}`, 'warning', { host });
    }
  }

  return {
    async capture(event, distinctId, properties = {}): Promise<void> {
      await send({
        api_key: config.apiKey,
        event,
        distinct_id: distinctId,
        properties,
        timestamp: new Date().toISOString(),
      });
    },

    async identify(distinctId, properties = {}): Promise<void> {
      await send({
        api_key: config.apiKey,
        event: '$identify',
        distinct_id: distinctId,
        properties: { $set: properties },
        timestamp: new Date().toISOString(),
      });
    },
  };
}

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

/**
 * Supported runtime environments for monitoring.
 */
export type MonitoringEnvironment = 'development' | 'staging' | 'production';

/**
 * Initialization settings for Sentry.
 */
export interface MonitoringConfig {
  dsn: string;
  environment: MonitoringEnvironment;
  release?: string;
  tracesSampleRate?: number;
  /**
   * Worker name used as the root span name in Sentry performance transactions.
   * If omitted, the middleware attempts to read `WORKER_NAME` from the Cloudflare
   * env binding; if that is also absent, it falls back to `'worker'`.
   */
  workerName?: string;
}

/**
 * Extra context supplied when reporting errors.
 */
export interface ErrorCaptureContext {
  userId?: string;
  tenantId?: string;
  requestId?: string;
  extra?: Record<string, unknown>;
}

/**
 * User identity attached to Sentry scope.
 */
export interface MonitoringUserContext {
  id: string;
  tenantId: string;
  email?: string;
}

const DEFAULT_TRACE_SAMPLE_RATE = 0.1;
let currentConfig: MonitoringConfig | null = null;
/**
 * Initializes Sentry with Factory defaults.
 */
export function initMonitoring(config: MonitoringConfig): void {
  currentConfig = {
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate ?? DEFAULT_TRACE_SAMPLE_RATE,
  };
  Sentry.setContext('monitoring', { ...currentConfig });
  Sentry.setTag('environment', currentConfig.environment);
  if (currentConfig.release) {
    Sentry.setTag('release', currentConfig.release);
  }
}

/**
 * Captures an error and enriches it with request context.
 */
export function captureError(err: unknown, context?: ErrorCaptureContext): string {
  return Sentry.withScope((scope) => {
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.tenantId) {
      scope.setTag('tenantId', context.tenantId);
    }
    if (context?.requestId) {
      scope.setTag('requestId', context.requestId);
    }
    if (context?.extra) {
      scope.setContext('extra', context.extra);
    }

    return Sentry.captureException(err);
  });
}

/**
 * Captures a structured message with an optional level and context.
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>,
): string {
  return Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('messageContext', context);
    }

    return Sentry.captureMessage(message, level);
  });
}

/**
 * Runs an async operation inside a Sentry span.
 */
export async function withPerformance<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op: 'function',
    },
    fn,
  );
}

/**
 * Binds the current user to the active Sentry scope.
 */
export function setUserContext(user: MonitoringUserContext): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
  });
}

/**
 * Configuration for the Cloudflare Worker Sentry wrapper.
 * All fields mirror `@sentry/cloudflare` options; DSN must come from
 * `env.SENTRY_DSN` — never hardcode it.
 */
export interface SentryCloudflareConfig {
  /** Fraction of transactions to send to Sentry (0–1). Required for MCP monitoring. */
  tracesSampleRate: number;
  /** Attach request headers / user IP to events. Required for MCP monitoring. */
  sendDefaultPii?: boolean;
  /** Release string, e.g. `git rev-parse --short HEAD`. */
  release?: string;
}

/**
 * Creates `withSentry` config from a Cloudflare Worker env object.
 * Pass the result to `withSentry()` at the Worker entry point.
 *
 * @example
 * ```typescript
 * import { withSentry, createSentryCloudflareConfig } from '@latimer-woods-tech/monitoring';
 * import app from './app.js';
 * import type { Env } from './env.js';
 *
 * export default withSentry(
 *   (env: Env) => createSentryCloudflareConfig(env.SENTRY_DSN, { tracesSampleRate: 1.0, sendDefaultPii: true }),
 *   app,
 * );
 * ```
 */
export function createSentryCloudflareConfig(
  dsn: string,
  opts: SentryCloudflareConfig,
): { dsn: string; tracesSampleRate: number; sendDefaultPii?: boolean; release?: string } {
  return {
    dsn,
    tracesSampleRate: opts.tracesSampleRate,
    sendDefaultPii: opts.sendDefaultPii,
    release: opts.release,
  };
}

/**
 * Wraps a Cloudflare Worker (or Hono app) with Sentry monitoring.
 * Enables automatic error capture, performance tracing, and MCP span recording.
 * Must be used at the Worker entry point — not inside middleware.
 *
 * Re-exported directly from `@sentry/cloudflare`.
 *
 * @example
 * ```typescript
 * export default withSentry(
 *   (env: Env) => ({ dsn: env.SENTRY_DSN, tracesSampleRate: 1.0, sendDefaultPii: true }),
 *   app,
 * );
 * ```
 */
export { withSentry } from '@sentry/cloudflare';

/**
 * Wraps an MCP server with Sentry monitoring.
 * Automatically captures spans for every MCP tool call, resource read, and prompt.
 * Requires `tracesSampleRate > 0` in the Sentry config.
 *
 * Re-exported directly from `@sentry/cloudflare`.
 *
 * @example
 * ```typescript
 * import { wrapMcpServerWithSentry } from '@latimer-woods-tech/monitoring';
 * import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
 *
 * const server = wrapMcpServerWithSentry(
 *   new McpServer({ name: 'factory-mcp', version: '1.0.0' }),
 * );
 * ```
 */
export { wrapMcpServerWithSentry } from '@sentry/cloudflare';

/**
 * Initializes Sentry for each request, wraps the full handler in a Sentry
 * performance transaction, and captures uncaught errors.
 */
export function sentryMiddleware(config: MonitoringConfig): MiddlewareHandler {
  let initialized = false;

  return async (c, next) => {
    if (!initialized) {
      initMonitoring(config);
      initialized = true;
    }

    const envBinding = c.env as { WORKER_NAME?: string } | undefined;
    const workerName = config.workerName ?? envBinding?.WORKER_NAME ?? 'worker';

    const requestId = c.get('requestId');
    if (requestId) {
      Sentry.setTag('requestId', requestId);
    }

    await Sentry.startSpan({ name: workerName, op: 'http.server' }, async () => {
      try {
        await next();
      } catch (err) {
        captureError(err, { requestId });
        throw err;
      }
    });

    // In Hono 4.x, route handler errors are caught by compose and stored on
    // c.error instead of propagating through next(). Capture them here.
    if (c.error) {
      captureError(c.error, { requestId });
    }
  };
}
