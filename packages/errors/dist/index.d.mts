import { MiddlewareHandler } from 'hono';

declare module 'hono' {
    interface ContextVariableMap {
        requestId: string;
    }
}
/**
 * Standard Factory error payload context.
 */
type ErrorContext = Record<string, unknown>;
/**
 * Enumerates common Factory error codes.
 */
declare const ErrorCodes: {
    readonly AUTH_TOKEN_MISSING: "AUTH_TOKEN_MISSING";
    readonly AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED";
    readonly AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID";
    readonly AUTH_FORBIDDEN: "AUTH_FORBIDDEN";
    readonly DB_CONNECTION_FAILED: "DB_CONNECTION_FAILED";
    readonly DB_QUERY_FAILED: "DB_QUERY_FAILED";
    readonly DB_NOT_FOUND: "DB_NOT_FOUND";
    readonly DB_CONSTRAINT_VIOLATION: "DB_CONSTRAINT_VIOLATION";
    readonly LLM_ALL_PROVIDERS_FAILED: "LLM_ALL_PROVIDERS_FAILED";
    readonly LLM_RATE_LIMITED: "LLM_RATE_LIMITED";
    readonly LLM_CONTEXT_TOO_LARGE: "LLM_CONTEXT_TOO_LARGE";
    readonly TELEPHONY_SESSION_FAILED: "TELEPHONY_SESSION_FAILED";
    readonly TELEPHONY_STT_FAILED: "TELEPHONY_STT_FAILED";
    readonly TELEPHONY_TTS_FAILED: "TELEPHONY_TTS_FAILED";
    readonly STRIPE_WEBHOOK_INVALID: "STRIPE_WEBHOOK_INVALID";
    readonly STRIPE_PAYMENT_FAILED: "STRIPE_PAYMENT_FAILED";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly RATE_LIMITED: "RATE_LIMITED";
};
/**
 * Valid Factory error code values.
 */
type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
/**
 * Serialized error shape returned to clients.
 */
interface FactoryErrorShape {
    code: string;
    message: string;
    status: number;
    retryable: boolean;
    context?: ErrorContext;
}
/**
 * Standard API response envelope.
 */
interface FactoryResponse<T> {
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
declare class FactoryBaseError extends Error {
    readonly code: string;
    readonly status: number;
    readonly retryable: boolean;
    readonly context?: ErrorContext;
    constructor(code: string, message: string, status: number, retryable?: boolean, context?: ErrorContext);
}
/**
 * Resource not found error.
 */
declare class NotFoundError extends FactoryBaseError {
    constructor(message?: string, context?: ErrorContext);
}
/**
 * Authentication failure error.
 */
declare class AuthError extends FactoryBaseError {
    constructor(message?: string, context?: ErrorContext);
}
/**
 * Authorization failure error.
 */
declare class ForbiddenError extends FactoryBaseError {
    constructor(message?: string, context?: ErrorContext);
}
/**
 * Validation failure error.
 */
declare class ValidationError extends FactoryBaseError {
    constructor(message?: string, context?: ErrorContext);
}
/**
 * Internal system failure error.
 */
declare class InternalError extends FactoryBaseError {
    constructor(message?: string, context?: ErrorContext);
}
/**
 * Rate-limit error.
 */
declare class RateLimitError extends FactoryBaseError {
    constructor(message?: string, context?: ErrorContext);
}
/**
 * Checks whether an unknown value is a Factory error.
 */
declare function isFactoryError(err: unknown): err is FactoryBaseError;
/**
 * Serializes unknown errors into the Factory response envelope.
 */
declare function toErrorResponse(err: unknown, requestId?: string): FactoryResponse<never>;
/**
 * Hono middleware that normalizes uncaught errors to Factory responses.
 */
declare function withErrorBoundary(): MiddlewareHandler;

export { AuthError, type ErrorCode, ErrorCodes, type ErrorContext, FactoryBaseError, type FactoryErrorShape, type FactoryResponse, ForbiddenError, InternalError, NotFoundError, RateLimitError, ValidationError, isFactoryError, toErrorResponse, withErrorBoundary };
