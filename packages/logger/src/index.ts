import { captureError } from '@adrper79-dot/monitoring';
import type { MiddlewareHandler } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    logger: Logger;
    requestId: string;
  }
}

/**
 * Structured logger context.
 */
export interface LogContext {
  workerId: string;
  requestId: string;
  userId?: string;
  tenantId?: string;
  environment?: 'development' | 'staging' | 'production';
  [key: string]: unknown;
}

/**
 * Structured logger interface.
 */
export interface Logger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, err?: unknown, ctx?: Record<string, unknown>): void;
  debug(msg: string, ctx?: Record<string, unknown>): void;
  child(ctx: Partial<LogContext>): Logger;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const reportCapturedError = captureError as (err: unknown, context?: {
  userId?: string;
  tenantId?: string;
  requestId?: string;
  extra?: Record<string, unknown>;
}) => string;

function emit(level: LogLevel, msg: string, context: LogContext, extra?: Record<string, unknown>): void {
  if (level === 'debug' && context.environment === 'production') {
    return;
  }

  console.log(
    JSON.stringify({
      level,
      msg,
      ts: new Date().toISOString(),
      ...context,
      ...extra,
      workerId: context.workerId,
      requestId: context.requestId,
    }),
  );
}

/**
 * Creates a structured JSON logger.
 */
export function createLogger(ctx: LogContext): Logger {
  const baseContext: LogContext = { ...ctx };

  return {
    info(msg, extra) {
      emit('info', msg, baseContext, extra);
    },
    warn(msg, extra) {
      emit('warn', msg, baseContext, extra);
    },
    error(msg, err, extra) {
      if (err !== undefined) {
        reportCapturedError(err, {
          requestId: baseContext.requestId,
          userId: typeof baseContext.userId === 'string' ? baseContext.userId : undefined,
          tenantId:
            typeof baseContext.tenantId === 'string' ? baseContext.tenantId : undefined,
          extra,
        });
      }

      const errorContext =
        err instanceof Error
          ? {
              errorMessage: err.message,
              errorName: err.name,
            }
          : err === undefined
            ? undefined
            : { error: err };

      emit('error', msg, baseContext, {
        ...errorContext,
        ...extra,
      });
    },
    debug(msg, extra) {
      emit('debug', msg, baseContext, extra);
    },
    child(extraContext) {
      return createLogger({
        ...baseContext,
        ...extraContext,
      });
    },
  };
}

/**
 * Adds a request id and bound logger to the current Hono context.
 */
export function withRequestId(): MiddlewareHandler {
  return async (c, next) => {
    const requestId = crypto.randomUUID();
    const workerIdHeader = c.req.header('x-worker-id');
    const logger = createLogger({
      workerId: workerIdHeader ?? 'unknown-worker',
      requestId,
    });

    c.set('requestId', requestId);
    c.set('logger', logger);

    await next();
  };
}

// Re-export correlation ID utilities for full-stack tracing
export {
  correlationIdMiddleware,
  generateCorrelationId,
  getCorrelationId,
  createQueryContext,
  type QueryContext,
} from './correlation';
