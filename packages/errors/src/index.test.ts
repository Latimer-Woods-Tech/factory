import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import {
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
  withErrorBoundary,
} from './index.js';

// ---------------------------------------------------------------------------
// FactoryBaseError
// ---------------------------------------------------------------------------

describe('FactoryBaseError', () => {
  it('sets all fields from constructor', () => {
    const err = new FactoryBaseError('MY_CODE', 'my message', 418, true, { foo: 'bar' });
    expect(err.code).toBe('MY_CODE');
    expect(err.message).toBe('my message');
    expect(err.status).toBe(418);
    expect(err.retryable).toBe(true);
    expect(err.context).toEqual({ foo: 'bar' });
    expect(err.name).toBe('FactoryBaseError');
  });

  it('defaults retryable to false when omitted', () => {
    const err = new FactoryBaseError('CODE', 'msg', 400);
    expect(err.retryable).toBe(false);
  });

  it('context is undefined when not supplied', () => {
    const err = new FactoryBaseError('CODE', 'msg', 400);
    expect(err.context).toBeUndefined();
  });

  it('is an instance of Error', () => {
    expect(new FactoryBaseError('C', 'm', 400)).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Concrete error subclasses
// ---------------------------------------------------------------------------

describe('NotFoundError', () => {
  it('has correct code, status, and default message', () => {
    const err = new NotFoundError();
    expect(err.code).toBe(ErrorCodes.NOT_FOUND);
    expect(err.status).toBe(404);
    expect(err.message).toBe('Resource not found');
    expect(err.retryable).toBe(false);
  });

  it('accepts custom message and context', () => {
    const err = new NotFoundError('User not found', { id: '123' });
    expect(err.message).toBe('User not found');
    expect(err.context).toEqual({ id: '123' });
  });

  it('is instanceof FactoryBaseError', () => {
    expect(new NotFoundError()).toBeInstanceOf(FactoryBaseError);
  });
});

describe('AuthError', () => {
  it('has correct code and status', () => {
    const err = new AuthError();
    expect(err.code).toBe(ErrorCodes.AUTH_TOKEN_INVALID);
    expect(err.status).toBe(401);
    expect(err.retryable).toBe(false);
  });

  it('accepts custom message', () => {
    expect(new AuthError('Token expired').message).toBe('Token expired');
  });
});

describe('ForbiddenError', () => {
  it('has correct code and status', () => {
    const err = new ForbiddenError();
    expect(err.code).toBe(ErrorCodes.AUTH_FORBIDDEN);
    expect(err.status).toBe(403);
  });
});

describe('ValidationError', () => {
  it('has correct code and status', () => {
    const err = new ValidationError();
    expect(err.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(err.status).toBe(422);
  });

  it('accepts context with field-level detail', () => {
    const err = new ValidationError('Invalid email', { field: 'email' });
    expect(err.context).toEqual({ field: 'email' });
  });
});

describe('InternalError', () => {
  it('is retryable with status 500', () => {
    const err = new InternalError();
    expect(err.status).toBe(500);
    expect(err.retryable).toBe(true);
    expect(err.code).toBe(ErrorCodes.INTERNAL_ERROR);
  });
});

describe('RateLimitError', () => {
  it('has status 429 and is retryable', () => {
    const err = new RateLimitError();
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
    expect(err.code).toBe(ErrorCodes.RATE_LIMITED);
  });
});

// ---------------------------------------------------------------------------
// isFactoryError
// ---------------------------------------------------------------------------

describe('isFactoryError', () => {
  it('returns true for FactoryBaseError instances', () => {
    expect(isFactoryError(new NotFoundError())).toBe(true);
    expect(isFactoryError(new InternalError())).toBe(true);
  });

  it('returns false for regular Errors', () => {
    expect(isFactoryError(new Error('oops'))).toBe(false);
  });

  it('returns false for non-errors', () => {
    expect(isFactoryError(null)).toBe(false);
    expect(isFactoryError('string')).toBe(false);
    expect(isFactoryError(42)).toBe(false);
    expect(isFactoryError(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toErrorResponse
// ---------------------------------------------------------------------------

describe('toErrorResponse', () => {
  it('converts a FactoryBaseError to the standard envelope', () => {
    const err = new ValidationError('Bad input', { field: 'email' });
    const response = toErrorResponse(err);
    expect(response.data).toBeNull();
    expect(response.error?.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(response.error?.message).toBe('Bad input');
    expect(response.error?.status).toBe(422);
    expect(response.error?.retryable).toBe(false);
    expect(response.error?.context).toEqual({ field: 'email' });
    expect(response.meta).toBeUndefined();
  });

  it('includes meta when requestId is provided', () => {
    const err = new NotFoundError();
    const response = toErrorResponse(err, 'req-abc');
    expect(response.meta?.requestId).toBe('req-abc');
    expect(response.meta?.timestamp).toBeDefined();
  });

  it('converts a plain Error to an internal error shape', () => {
    const err = new Error('something broke');
    const response = toErrorResponse(err);
    expect(response.error?.code).toBe(ErrorCodes.INTERNAL_ERROR);
    expect(response.error?.message).toBe('something broke');
    expect(response.error?.status).toBe(500);
  });

  it('handles a plain Error with requestId', () => {
    const response = toErrorResponse(new Error('boom'), 'req-xyz');
    expect(response.meta?.requestId).toBe('req-xyz');
  });

  it('handles a non-Error primitive (string)', () => {
    const response = toErrorResponse('unexpected string');
    expect(response.error?.code).toBe(ErrorCodes.INTERNAL_ERROR);
    expect(response.error?.status).toBe(500);
    expect(response.data).toBeNull();
  });

  it('handles undefined', () => {
    const response = toErrorResponse(undefined);
    expect(response.error?.code).toBe(ErrorCodes.INTERNAL_ERROR);
    expect(response.error?.context).toBeUndefined();
  });

  it('handles a non-Error object', () => {
    const response = toErrorResponse({ weird: true });
    expect(response.error?.code).toBe(ErrorCodes.INTERNAL_ERROR);
  });
});

// ---------------------------------------------------------------------------
// withErrorBoundary
// ---------------------------------------------------------------------------

describe('withErrorBoundary', () => {
  function makeApp() {
    const app = new Hono();
    app.use('*', withErrorBoundary());
    return app;
  }

  it('passes through successful responses unchanged', async () => {
    const app = makeApp();
    app.get('/ok', (c) => c.json({ hello: 'world' }));
    const res = await app.request('/ok');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ hello: 'world' });
  });

  it('catches NotFoundError and returns 404 JSON', async () => {
    const app = makeApp();
    app.get('/missing', () => {
      throw new NotFoundError('Item gone');
    });
    const res = await app.request('/missing');
    expect(res.status).toBe(404);
    const body = await res.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe(ErrorCodes.NOT_FOUND);
    expect(body.error.message).toBe('Item gone');
  });

  it('catches ValidationError and returns 422', async () => {
    const app = makeApp();
    app.post('/validate', () => {
      throw new ValidationError('Required field missing');
    });
    const res = await app.request('/validate', { method: 'POST' });
    expect(res.status).toBe(422);
  });

  it('catches InternalError and returns 500', async () => {
    const app = makeApp();
    app.get('/boom', () => {
      throw new InternalError();
    });
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
  });

  it('catches generic Error and returns 500', async () => {
    const app = makeApp();
    app.get('/crash', () => {
      throw new Error('unexpected');
    });
    // withErrorBoundary uses toErrorResponse which maps plain Error to 500
    // But it relies on error.status which plain Error won't have — it falls
    // back to 500 via the null-coalescing default.
    const res = await app.request('/crash');
    expect(res.status).toBe(500);
  });

  it('uses requestId from context when set', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      // Simulate requestId middleware setting the value
      c.set('requestId', 'test-request-id');
      await next();
    });
    app.use('*', withErrorBoundary());
    app.get('/err', () => {
      throw new AuthError('Not allowed');
    });
    const res = await app.request('/err');
    expect(res.status).toBe(401);
    const body = await res.json() as { meta?: { requestId: string } };
    expect(body.meta?.requestId).toBe('test-request-id');
  });
});

// ---------------------------------------------------------------------------
// ErrorCodes exhaustiveness
// ---------------------------------------------------------------------------

describe('ErrorCodes', () => {
  it('exposes all expected codes', () => {
    const expected = [
      'AUTH_TOKEN_MISSING',
      'AUTH_TOKEN_EXPIRED',
      'AUTH_TOKEN_INVALID',
      'AUTH_FORBIDDEN',
      'DB_CONNECTION_FAILED',
      'DB_QUERY_FAILED',
      'DB_NOT_FOUND',
      'DB_CONSTRAINT_VIOLATION',
      'LLM_ALL_PROVIDERS_FAILED',
      'LLM_RATE_LIMITED',
      'LLM_CONTEXT_TOO_LARGE',
      'TELEPHONY_SESSION_FAILED',
      'TELEPHONY_STT_FAILED',
      'TELEPHONY_TTS_FAILED',
      'STRIPE_WEBHOOK_INVALID',
      'STRIPE_PAYMENT_FAILED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
      'NOT_FOUND',
      'RATE_LIMITED',
    ] as const;

    for (const code of expected) {
      expect(ErrorCodes[code]).toBe(code);
    }
  });
});
