// src/index.ts
var ErrorCodes = {
  AUTH_TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",
  DB_CONNECTION_FAILED: "DB_CONNECTION_FAILED",
  DB_QUERY_FAILED: "DB_QUERY_FAILED",
  DB_NOT_FOUND: "DB_NOT_FOUND",
  DB_CONSTRAINT_VIOLATION: "DB_CONSTRAINT_VIOLATION",
  LLM_ALL_PROVIDERS_FAILED: "LLM_ALL_PROVIDERS_FAILED",
  LLM_RATE_LIMITED: "LLM_RATE_LIMITED",
  LLM_CONTEXT_TOO_LARGE: "LLM_CONTEXT_TOO_LARGE",
  TELEPHONY_SESSION_FAILED: "TELEPHONY_SESSION_FAILED",
  TELEPHONY_STT_FAILED: "TELEPHONY_STT_FAILED",
  TELEPHONY_TTS_FAILED: "TELEPHONY_TTS_FAILED",
  STRIPE_WEBHOOK_INVALID: "STRIPE_WEBHOOK_INVALID",
  STRIPE_PAYMENT_FAILED: "STRIPE_PAYMENT_FAILED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED"
};
var FactoryBaseError = class extends Error {
  code;
  status;
  retryable;
  context;
  constructor(code, message, status, retryable = false, context) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.context = context;
    if ("captureStackTrace" in Error && typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, new.target);
    }
  }
};
var NotFoundError = class extends FactoryBaseError {
  constructor(message = "Resource not found", context) {
    super(ErrorCodes.NOT_FOUND, message, 404, false, context);
  }
};
var AuthError = class extends FactoryBaseError {
  constructor(message = "Authentication failed", context) {
    super(ErrorCodes.AUTH_TOKEN_INVALID, message, 401, false, context);
  }
};
var ForbiddenError = class extends FactoryBaseError {
  constructor(message = "Forbidden", context) {
    super(ErrorCodes.AUTH_FORBIDDEN, message, 403, false, context);
  }
};
var ValidationError = class extends FactoryBaseError {
  constructor(message = "Validation failed", context) {
    super(ErrorCodes.VALIDATION_ERROR, message, 422, false, context);
  }
};
var InternalError = class extends FactoryBaseError {
  constructor(message = "Internal server error", context) {
    super(ErrorCodes.INTERNAL_ERROR, message, 500, true, context);
  }
};
var RateLimitError = class extends FactoryBaseError {
  constructor(message = "Rate limited", context) {
    super(ErrorCodes.RATE_LIMITED, message, 429, true, context);
  }
};
var INTERNAL_ERROR_MESSAGE = "An unexpected error occurred";
function isFactoryError(err) {
  return err instanceof FactoryBaseError;
}
function toErrorResponse(err, requestId) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  if (isFactoryError(err)) {
    return {
      data: null,
      error: {
        code: err.code,
        message: err.message,
        status: err.status,
        retryable: err.retryable,
        context: err.context
      },
      meta: requestId ? {
        requestId,
        duration: 0,
        timestamp
      } : void 0
    };
  }
  if (err instanceof Error) {
    return {
      data: null,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: err.message || INTERNAL_ERROR_MESSAGE,
        status: 500,
        retryable: false
      },
      meta: requestId ? {
        requestId,
        duration: 0,
        timestamp
      } : void 0
    };
  }
  return {
    data: null,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: INTERNAL_ERROR_MESSAGE,
      status: 500,
      retryable: false,
      context: err === void 0 ? void 0 : { value: err }
    },
    meta: requestId ? {
      requestId,
      duration: 0,
      timestamp
    } : void 0
  };
}
function withErrorBoundary() {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      const requestId = c.get("requestId");
      const response = toErrorResponse(
        err,
        typeof requestId === "string" ? requestId : void 0
      );
      const status = response.error?.status ?? 500;
      return c.json(response, status);
    }
  };
}
export {
  AuthError,
  ErrorCodes,
  FactoryBaseError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  isFactoryError,
  toErrorResponse,
  withErrorBoundary
};
//# sourceMappingURL=index.mjs.map