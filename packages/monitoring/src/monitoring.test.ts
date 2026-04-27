import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => {
  type MockScope = {
    setContext: ReturnType<typeof vi.fn>;
    setTag: ReturnType<typeof vi.fn>;
    setUser: ReturnType<typeof vi.fn>;
  };

  const scope = {
    setContext: vi.fn(),
    setTag: vi.fn(),
    setUser: vi.fn(),
  } satisfies MockScope;

  return {
    captureException: vi.fn(() => 'event-error'),
    captureMessage: vi.fn(() => 'event-message'),
    scope,
    setContext: vi.fn(),
    setTag: vi.fn(),
    setUser: vi.fn(),
    startSpan: vi.fn(
      async (
        _options: { name: string; op: string },
        fn: () => Promise<unknown>,
      ): Promise<unknown> => fn(),
    ),
    withScope: vi.fn(<T>(callback: (scope: MockScope) => T): T => callback(scope)),
  };
});

type TestMiddlewareContext = {
  get: (key: 'requestId') => string | undefined;
  env?: Record<string, string | undefined>;
};

type TestMiddlewareHandler = (
  context: TestMiddlewareContext,
  next: () => Promise<unknown>,
) => Promise<Response | void>;

vi.mock('@sentry/cloudflare', () => sentryMocks);

import {
  captureError,
  captureMessage,
  initMonitoring,
  sentryMiddleware,
  setUserContext,
  withPerformance,
} from './index';

describe('monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initMonitoring configures Sentry with the provided settings', () => {
    initMonitoring({
      dsn: 'https://dsn.example',
      environment: 'production',
      release: '2026.04.23',
    });

    expect(sentryMocks.setContext).toHaveBeenCalledWith('monitoring', {
      dsn: 'https://dsn.example',
      environment: 'production',
      release: '2026.04.23',
      tracesSampleRate: 0.1,
    });
    expect(sentryMocks.setTag).toHaveBeenCalledWith('environment', 'production');
    expect(sentryMocks.setTag).toHaveBeenCalledWith('release', '2026.04.23');
  });

  it('captureError forwards exceptions and returns the event id', () => {
    const error = new Error('boom');
    const eventId = captureError(error, {
      userId: 'user-1',
      tenantId: 'tenant-1',
      requestId: 'req-1',
      extra: { feature: 'signup' },
    });

    expect(eventId).toBe('event-error');
    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
    expect(sentryMocks.scope.setUser).toHaveBeenCalledWith({ id: 'user-1' });
    expect(sentryMocks.scope.setTag).toHaveBeenCalledWith('tenantId', 'tenant-1');
    expect(sentryMocks.scope.setTag).toHaveBeenCalledWith('requestId', 'req-1');
    expect(sentryMocks.scope.setContext).toHaveBeenCalledWith('extra', {
      feature: 'signup',
    });
  });

  it('captureMessage forwards the message with the requested level', () => {
    const eventId = captureMessage('hello', 'warning', { route: '/health' });

    expect(eventId).toBe('event-message');
    expect(sentryMocks.captureMessage).toHaveBeenCalledWith('hello', 'warning');
    expect(sentryMocks.scope.setContext).toHaveBeenCalledWith('messageContext', {
      route: '/health',
    });
  });

  it('withPerformance resolves the provided function result', async () => {
    await expect(withPerformance('db.query', () => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
    expect(sentryMocks.startSpan).toHaveBeenCalledWith(
      { name: 'db.query', op: 'function' },
      expect.any(Function),
    );
  });

  it('withPerformance propagates rejection from the wrapped function', async () => {
    await expect(
      withPerformance('db.query', async () => Promise.reject(new Error('failed'))),
    ).rejects.toThrow('failed');
  });

  it('setUserContext binds the supplied identity to Sentry', () => {
    setUserContext({
      id: 'user-2',
      tenantId: 'tenant-2',
      email: 'user@example.com',
    });

    expect(sentryMocks.setUser).toHaveBeenCalledWith({
      id: 'user-2',
      email: 'user@example.com',
      tenantId: 'tenant-2',
    });
  });

  it('sentryMiddleware initializes Sentry, tags the request, and calls next', async () => {
    const middleware = sentryMiddleware({
      dsn: 'https://dsn.example',
      environment: 'development',
    }) as unknown as TestMiddlewareHandler;
    const next = vi.fn(() => Promise.resolve());
    const context: TestMiddlewareContext = {
      get: () => 'req-123',
    };

    await middleware(context, next);

    expect(sentryMocks.setContext).toHaveBeenCalledWith('monitoring', {
      dsn: 'https://dsn.example',
      environment: 'development',
      release: undefined,
      tracesSampleRate: 0.1,
    });
    expect(sentryMocks.setTag).toHaveBeenCalledWith('requestId', 'req-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sentryMiddleware wraps handler in a Sentry performance transaction', async () => {
    const middleware = sentryMiddleware({
      dsn: 'https://dsn.example',
      environment: 'production',
      workerName: 'my-worker',
    }) as unknown as TestMiddlewareHandler;
    const next = vi.fn(() => Promise.resolve());
    const context: TestMiddlewareContext = { get: () => undefined };

    await middleware(context, next);

    expect(sentryMocks.startSpan).toHaveBeenCalledWith(
      { name: 'my-worker', op: 'http.server' },
      expect.any(Function),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sentryMiddleware falls back to "worker" when no worker name is configured', async () => {
    const middleware = sentryMiddleware({
      dsn: 'https://dsn.example',
      environment: 'staging',
    }) as unknown as TestMiddlewareHandler;
    const next = vi.fn(() => Promise.resolve());
    const context: TestMiddlewareContext = { get: () => undefined };

    await middleware(context, next);

    expect(sentryMocks.startSpan).toHaveBeenCalledWith(
      { name: 'worker', op: 'http.server' },
      expect.any(Function),
    );
  });

  it('sentryMiddleware captures and rethrows errors', async () => {
    const middleware = sentryMiddleware({
      dsn: 'https://dsn.example',
      environment: 'development',
    }) as unknown as TestMiddlewareHandler;
    const boom = new Error('boom');
    const next = vi.fn(() => Promise.reject(boom));
    const context: TestMiddlewareContext = { get: () => 'req-err' };

    await expect(middleware(context, next)).rejects.toThrow('boom');
    expect(sentryMocks.captureException).toHaveBeenCalledWith(boom);
  });
});

import { createSentryCloudflareConfig } from './index';

describe('createSentryCloudflareConfig', () => {
  it('maps dsn and opts into a flat config object', () => {
    const config = createSentryCloudflareConfig('https://sentry.example/1', {
      tracesSampleRate: 0.5,
      sendDefaultPii: true,
      release: 'abc123',
    });

    expect(config).toEqual({
      dsn: 'https://sentry.example/1',
      tracesSampleRate: 0.5,
      sendDefaultPii: true,
      release: 'abc123',
    });
  });

  it('omits optional fields when not provided', () => {
    const config = createSentryCloudflareConfig('https://sentry.example/2', {
      tracesSampleRate: 1.0,
    });

    expect(config.dsn).toBe('https://sentry.example/2');
    expect(config.tracesSampleRate).toBe(1.0);
    expect(config.sendDefaultPii).toBeUndefined();
    expect(config.release).toBeUndefined();
  });
});
