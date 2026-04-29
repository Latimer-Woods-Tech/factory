import type { Context, MiddlewareHandler } from 'hono';

/**
 * Generates a new correlationId (UUID v4).
 * This ID traces a request through the entire system:
 * frontend → worker → database → Sentry → DLQ.
 */
export function generateCorrelationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

declare module 'hono' {
  interface ContextVariableMap {
    correlationId: string;
  }
}

/**
 * Middleware that ensures every request has a correlationId.
 *
 * Extraction order:
 * 1. x-correlation-id header (from client/frontend)
 * 2. x-request-id header (fallback)
 * 3. Generate new correlationId
 *
 * All subsequent logs, database queries, and error reports include this ID.
 * Exception logs preserve original correlationId for tracing chains.
 *
 * @param headerName - Optional custom header name (defaults to 'x-correlation-id')
 * @returns Middleware that attaches correlationId to context
 */
export function correlationIdMiddleware(
  headerName = 'x-correlation-id',
): MiddlewareHandler {
  return async (c, next) => {
    const correlationId =
      c.req.header(headerName) ??
      c.req.header('x-request-id') ??
      generateCorrelationId();

    c.set('correlationId', correlationId);
    c.res.headers.set('x-correlation-id', correlationId);

    return next();
  };
}

/**
 * Extracts and returns the current correlationId from context.
 * Used in request handlers, database operations, error reports.
 */
export function getCorrelationId(ctx: Context): string {
  return ctx.get('correlationId') ?? generateCorrelationId();
}

/**
 * Attaches correlationId to query context for database logging.
 * Example usage in Drizzle:
 *   db.select().from(users).with({ correlationId }).sql()
 *
 * When slow query logging is enabled (> 200ms), the correlationId
 * appears in logs, allowing ops to retrieve full request history.
 */
export interface QueryContext {
  correlationId: string;
  userId?: string;
  tenantId?: string;
  timestamp?: Date;
}

/**
 * Creates a query context with correlationId for database tracing.
 * Pass this to Drizzle query metadata or logging middleware.
 */
export function createQueryContext(
  correlationId: string,
  userId?: string,
  tenantId?: string,
): QueryContext {
  return {
    correlationId,
    userId,
    tenantId,
    timestamp: new Date(),
  };
}
