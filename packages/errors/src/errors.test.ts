import { describe, expect, it } from 'vitest';

import {
  AuthError,
  BadRequestError,
  FactoryBaseError,
  ForbiddenError,
  InternalError,
  isFactoryError,
  NotFoundError,
  RateLimitError,
  toErrorResponse,
  ValidationError,
  withErrorBoundary,
} from './index';

type TestBoundaryContext = {
  get: (key: 'requestId') => string | undefined;
  json: (payload: unknown, status: number) => Response;
};

type TestBoundaryHandler = (
  context: TestBoundaryContext,
  next: () => Promise<unknown>,
) => Promise<Response | void>;

describe('FactoryBaseError', () => {
  it('stores name, code, status, retryable, context, and stack trace', () => {
    const error = new FactoryBaseError('TEST', 'boom', 418, true, { foo: 'bar' });

    expect(error.name).toBe('FactoryBaseError');
    expect(error.code).toBe('TEST');
    expect(error.message).toBe('boom');
    expect(error.status).toBe(418);
    expect(error.retryable).toBe(true);
    expect(error.context).toEqual({ foo: 'bar' });
    expect(error.stack).toContain('FactoryBaseError');
  });
});

describe('typed error subclasses', () => {
  it('use the expected default status and retryable flags', () => {
    expect(new NotFoundError().status).toBe(404);
    expect(new NotFoundError().retryable).toBe(false);
    expect(new AuthError().status).toBe(401);
    expect(new AuthError().retryable).toBe(false);
    expect(new ForbiddenError().status).toBe(403);
    expect(new ForbiddenError().retryable).toBe(false);
    expect(new ValidationError().status).toBe(422);
    expect(new ValidationError().retryable).toBe(false);
    expect(new BadRequestError().status).toBe(400);
    expect(new BadRequestError().retryable).toBe(false);
    expect(new InternalError().status).toBe(500);
    expect(new InternalError().retryable).toBe(true);
    expect(new RateLimitError().status).toBe(429);
    expect(new RateLimitError().retryable).toBe(true);
  });
});

describe('toErrorResponse', () => {
  it('serializes FactoryBaseError input', () => {
    const response = toErrorResponse(
      new ValidationError('bad input', { field: 'email' }),
      'req-1',
    );

    expect(response.data).toBeNull();
    expect(response.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'bad input',
      status: 422,
      retryable: false,
      context: { field: 'email' },
    });
    expect(response.meta?.requestId).toBe('req-1');
    expect(response.meta?.duration).toBe(0);
    expect(response.meta?.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('omits meta when no request id is provided for FactoryBaseError input', () => {
    const response = toErrorResponse(new ValidationError('bad input'));

    expect(response.meta).toBeUndefined();
  });

  it('serializes plain Error input', () => {
    const response = toErrorResponse(new Error('plain failure'));

    expect(response.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'plain failure',
      status: 500,
      retryable: false,
    });
    expect(response.meta).toBeUndefined();
  });

  it('falls back to the default message for empty Error messages and keeps request metadata', () => {
    const response = toErrorResponse(new Error(''), 'req-plain');

    expect(response.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      status: 500,
      retryable: false,
    });
    expect(response.meta?.requestId).toBe('req-plain');
  });

  it('serializes unknown input', () => {
    const response = toErrorResponse('oops');

    expect(response.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      status: 500,
      retryable: false,
      context: { value: 'oops' },
    });
  });

  it('omits unknown context when the value is undefined and preserves request metadata', () => {
    const response = toErrorResponse(undefined, 'req-unknown');

    expect(response.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      status: 500,
      retryable: false,
      context: undefined,
    });
    expect(response.meta?.requestId).toBe('req-unknown');
  });
});

describe('withErrorBoundary', () => {
  it('catches thrown FactoryBaseError', async () => {
    const handler = withErrorBoundary() as unknown as TestBoundaryHandler;
    const context: TestBoundaryContext = {
      get: () => 'req-123',
      json: (payload, status) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json; charset=UTF-8' },
        }),
    };
    const response = await handler(context, () =>
      Promise.reject(new NotFoundError('missing')),
    );

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error('Expected error boundary to return a response');
    }

    const body = (await response.json()) as {
      error: { code: string; status: number };
      meta?: { requestId: string };
    };

    expect(response.status).toBe(404);
    expect(body.error).toEqual({
      code: 'NOT_FOUND',
      status: 404,
      message: 'missing',
      retryable: false,
    });
    expect(body.meta?.requestId).toBe('req-123');
  });

  it('catches unknown errors', async () => {
    const handler = withErrorBoundary() as unknown as TestBoundaryHandler;
    const context: TestBoundaryContext = {
      get: () => undefined,
      json: (payload, status) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json; charset=UTF-8' },
        }),
    };
    const response = await handler(context, () => Promise.reject('broken'));

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error('Expected error boundary to return a response');
    }

    const body = (await response.json()) as {
      error: { code: string; status: number; message: string };
    };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.status).toBe(500);
    expect(body.error.message).toBe('An unexpected error occurred');
  });
});

describe('isFactoryError', () => {
  it('returns true for FactoryBaseError and false for plain Error', () => {
    expect(isFactoryError(new FactoryBaseError('X', 'y', 500))).toBe(true);
    expect(isFactoryError(new Error('nope'))).toBe(false);
  });
});
