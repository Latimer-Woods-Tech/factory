import type { MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

/**
 * Standard Factory error payload context.
 */
export type ErrorContext = Record<string, unknown>;

/**
 * Enumerates common Factory error codes.
 */
export const ErrorCodes = {
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_NOT_FOUND: 'DB_NOT_FOUND',
  DB_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  LLM_ALL_PROVIDERS_FAILED: 'LLM_ALL_PROVIDERS_FAILED',
  LLM_RATE_LIMITED: 'LLM_RATE_LIMITED',
  LLM_CONTEXT_TOO_LARGE: 'LLM_CONTEXT_TOO_LARGE',
  TELEPHONY_SESSION_FAILED: 'TELEPHONY_SESSION_FAILED',
  TELEPHONY_STT_FAILED: 'TELEPHONY_STT_FAILED',
  TELEPHONY_TTS_FAILED: 'TELEPHONY_TTS_FAILED',
  STRIPE_WEBHOOK_INVALID: 'STRIPE_WEBHOOK_INVALID',
  STRIPE_PAYMENT_FAILED: 'STRIPE_PAYMENT_FAILED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

/**
 * Valid Factory error code values.
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Serialized error shape returned to clients.
 */
export interface FactoryErrorShape {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  context?: ErrorContext;
}

/**
 * Standard API response envelope.
 */
export interface FactoryResponse<T> {
  data: T | null;
  error: FactoryErrorShape | null;
  meta?: {
    requestId: string;
    duration: number;
    timestamp: string;
  };
}

/**
 * Base error used across Factory packages.
 */
export class FactoryBaseError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly retryable: boolean;
  public readonly context?: ErrorContext;

  public constructor(
    code: string,
    message: string,
    status: number,
    retryable = false,
    context?: ErrorContext,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.context = context;

    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, new.target);
    }
  }
}

/**
 * Resource not found error.
 */
export class NotFoundError extends FactoryBaseError {
  public constructor(message = 'Resource not found', context?: ErrorContext) {
    super(ErrorCodes.NOT_FOUND, message, 404, false, context);
  }
}

/**
 * Authentication failure error.
 */
export class AuthError extends FactoryBaseError {
  public constructor(message = 'Authentication failed', context?: ErrorContext) {
    super(ErrorCodes.AUTH_TOKEN_INVALID, message, 401, false, context);
  }
}

/**
 * Authorization failure error.
 */
export class ForbiddenError extends FactoryBaseError {
  public constructor(message = 'Forbidden', context?: ErrorContext) {
    super(ErrorCodes.AUTH_FORBIDDEN, message, 403, false, context);
  }
}

/**
 * Validation failure error.
 */
export class ValidationError extends FactoryBaseError {
  public constructor(message = 'Validation failed', context?: ErrorContext) {
    super(ErrorCodes.VALIDATION_ERROR, message, 422, false, context);
  }
}

/**
 * Internal system failure error.
 */
export class InternalError extends FactoryBaseError {
  public constructor(message = 'Internal server error', context?: ErrorContext) {
    super(ErrorCodes.INTERNAL_ERROR, message, 500, true, context);
  }
}

/**
 * Rate-limit error.
 */
export class RateLimitError extends FactoryBaseError {
  public constructor(message = 'Rate limited', context?: ErrorContext) {
    super(ErrorCodes.RATE_LIMITED, message, 429, true, context);
  }
}

const INTERNAL_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Checks whether an unknown value is a Factory error.
 */
export function isFactoryError(err: unknown): err is FactoryBaseError {
  return err instanceof FactoryBaseError;
}

/**
 * Serializes unknown errors into the Factory response envelope.
 */
export function toErrorResponse(err: unknown, requestId?: string): FactoryResponse<never> {
  const timestamp = new Date().toISOString();

  if (isFactoryError(err)) {
    return {
      data: null,
      error: {
        code: err.code,
        message: err.message,
        status: err.status,
        retryable: err.retryable,
        context: err.context,
      },
      meta: requestId
        ? {
            requestId,
            duration: 0,
            timestamp,
          }
        : undefined,
    };
  }

  if (err instanceof Error) {
    return {
      data: null,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: err.message || INTERNAL_ERROR_MESSAGE,
        status: 500,
        retryable: false,
      },
      meta: requestId
        ? {
            requestId,
            duration: 0,
            timestamp,
          }
        : undefined,
    };
  }

  return {
    data: null,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: INTERNAL_ERROR_MESSAGE,
      status: 500,
      retryable: false,
      context: err === undefined ? undefined : { value: err },
    },
    meta: requestId
      ? {
          requestId,
          duration: 0,
          timestamp,
        }
      : undefined,
  };
}

/**
 * Hono middleware that normalizes uncaught errors to Factory responses.
 */
export function withErrorBoundary(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      const requestId = c.get('requestId');
      const response = toErrorResponse(
        err,
        typeof requestId === 'string' ? requestId : undefined,
      );
      const status = (response.error?.status ?? 500) as ContentfulStatusCode;

      return c.json(response, status);
    }
  };
}
