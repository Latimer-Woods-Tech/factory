import * as Sentry from '@sentry/cloudflare';
import type { MiddlewareHandler } from 'hono';

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
  };
}
