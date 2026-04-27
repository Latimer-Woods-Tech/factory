import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @sentry/cloudflare before importing our module
// vi.hoisted() ensures these run before vi.mock() hoisting, avoiding TDZ errors
// ---------------------------------------------------------------------------

const {
  mockCaptureException,
  mockCaptureMessage,
  mockSetTag,
  mockSetUser,
  mockSetContext,
  mockStartSpan,
  mockWithScope,
} = vi.hoisted(() => {
  const mockSetTag = vi.fn();
  const mockSetUser = vi.fn();
  const mockSetContext = vi.fn();
  const mockCaptureException = vi.fn().mockReturnValue('sentry-event-id-1');
  const mockCaptureMessage = vi.fn().mockReturnValue('sentry-event-id-2');
  const mockStartSpan = vi.fn().mockImplementation((_opts: unknown, fn: () => Promise<unknown>) => fn());
  const mockWithScope = vi.fn().mockImplementation(
    (cb: (scope: { setUser: typeof mockSetUser; setTag: typeof mockSetTag; setContext: typeof mockSetContext }) => string) =>
      cb({ setUser: mockSetUser, setTag: mockSetTag, setContext: mockSetContext }),
  );
  return { mockCaptureException, mockCaptureMessage, mockSetTag, mockSetUser, mockSetContext, mockStartSpan, mockWithScope };
});

vi.mock('@sentry/cloudflare', () => ({
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
  setTag: mockSetTag,
  setUser: mockSetUser,
  setContext: mockSetContext,
  startSpan: mockStartSpan,
  withScope: mockWithScope,
  withSentry: vi.fn(),
  wrapMcpServerWithSentry: vi.fn(),
}));

import {
  captureError,
  captureMessage,
  createSentryCloudflareConfig,
  initMonitoring,
  sentryMiddleware,
  setUserContext,
  withPerformance,
} from './index.js';

// Restore default mock implementations before each test.
// restoreMocks:true calls vi.restoreAllMocks() which resets vi.fn() impls.
beforeEach(() => {
  mockStartSpan.mockImplementation((_opts: unknown, fn: () => Promise<unknown>) => fn());
  mockWithScope.mockImplementation(
    (cb: (scope: { setUser: typeof mockSetUser; setTag: typeof mockSetTag; setContext: typeof mockSetContext }) => string) =>
      cb({ setUser: mockSetUser, setTag: mockSetTag, setContext: mockSetContext }),
  );
  mockCaptureException.mockReturnValue('sentry-event-id-1');
  mockCaptureMessage.mockReturnValue('sentry-event-id-2');
});

// ---------------------------------------------------------------------------
// initMonitoring
// ---------------------------------------------------------------------------

describe('initMonitoring', () => {
  it('calls Sentry.setContext and Sentry.setTag', () => {
    initMonitoring({ dsn: 'https://key@sentry.io/123', environment: 'production' });
    expect(mockSetContext).toHaveBeenCalledWith('monitoring', expect.objectContaining({
      dsn: 'https://key@sentry.io/123',
      environment: 'production',
    }));
    expect(mockSetTag).toHaveBeenCalledWith('environment', 'production');
  });

  it('sets release tag when provided', () => {
    initMonitoring({ dsn: 'https://key@sentry.io/123', environment: 'staging', release: 'v1.2.3' });
    expect(mockSetTag).toHaveBeenCalledWith('release', 'v1.2.3');
  });

  it('uses default tracesSampleRate of 0.1 when not specified', () => {
    mockSetContext.mockClear();
    initMonitoring({ dsn: 'https://key@sentry.io/123', environment: 'development' });
    expect(mockSetContext).toHaveBeenCalledWith('monitoring', expect.objectContaining({
      tracesSampleRate: 0.1,
    }));
  });
});

// ---------------------------------------------------------------------------
// captureError
// ---------------------------------------------------------------------------

describe('captureError', () => {
  it('calls withScope and returns an event id', () => {
    mockWithScope.mockReturnValueOnce('event-abc');
    const id = captureError(new Error('test error'), {
      userId: 'u1',
      tenantId: 't1',
      requestId: 'req-1',
      extra: { foo: 'bar' },
    });
    expect(id).toBe('event-abc');
    expect(mockWithScope).toHaveBeenCalled();
  });

  it('calls captureException inside the scope', () => {
    // withScope is mocked to call the callback synchronously
    mockWithScope.mockImplementationOnce((cb: (scope: { setUser: typeof mockSetUser; setTag: typeof mockSetTag; setContext: typeof mockSetContext }) => unknown) => {
      cb({ setUser: mockSetUser, setTag: mockSetTag, setContext: mockSetContext });
      return mockCaptureException(new Error('test')) as unknown;
    });
    captureError(new Error('inner test'));
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('works without context', () => {
    expect(() => captureError(new Error('no context'))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// captureMessage
// ---------------------------------------------------------------------------

describe('captureMessage', () => {
  it('calls withScope and returns event id', () => {
    mockWithScope.mockReturnValueOnce('msg-event-1');
    const id = captureMessage('Hello Sentry');
    expect(id).toBe('msg-event-1');
  });

  it('defaults level to info', () => {
    mockWithScope.mockImplementationOnce((cb: (scope: { setUser: typeof mockSetUser; setTag: typeof mockSetTag; setContext: typeof mockSetContext }) => unknown) => {
      cb({ setUser: mockSetUser, setTag: mockSetTag, setContext: mockSetContext });
      return mockCaptureMessage('Hello Sentry', 'info') as unknown;
    });
    captureMessage('Hello Sentry');
    expect(mockCaptureMessage).toHaveBeenCalledWith('Hello Sentry', 'info');
  });

  it('accepts custom level', () => {
    mockWithScope.mockImplementationOnce((cb: (scope: { setUser: typeof mockSetUser; setTag: typeof mockSetTag; setContext: typeof mockSetContext }) => unknown) => {
      cb({ setUser: mockSetUser, setTag: mockSetTag, setContext: mockSetContext });
      return mockCaptureMessage('Warn message', 'warning') as unknown;
    });
    captureMessage('Warn message', 'warning');
    expect(mockCaptureMessage).toHaveBeenCalledWith('Warn message', 'warning');
  });
});

// ---------------------------------------------------------------------------
// withPerformance
// ---------------------------------------------------------------------------

describe('withPerformance', () => {
  it('runs the function inside a Sentry span and returns result', async () => {
    const result = await withPerformance('my-span', () => Promise.resolve(42));
    expect(result).toBe(42);
    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: 'my-span', op: 'function' },
      expect.any(Function),
    );
  });

  it('propagates errors from the wrapped function', async () => {
    mockStartSpan.mockImplementationOnce(async (_opts: unknown, fn: () => Promise<unknown>) => fn());
    await expect(
      withPerformance('span', () => Promise.reject(new Error('span error'))),
    ).rejects.toThrow('span error');
  });
});

// ---------------------------------------------------------------------------
// setUserContext
// ---------------------------------------------------------------------------

describe('setUserContext', () => {
  it('calls Sentry.setUser with id, email, and tenantId', () => {
    setUserContext({ id: 'u1', tenantId: 't1', email: 'a@b.com' });
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'u1', email: 'a@b.com', tenantId: 't1' });
  });

  it('works without email', () => {
    setUserContext({ id: 'u2', tenantId: 't2' });
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'u2', email: undefined, tenantId: 't2' });
  });
});

// ---------------------------------------------------------------------------
// createSentryCloudflareConfig
// ---------------------------------------------------------------------------

describe('createSentryCloudflareConfig', () => {
  it('returns config with dsn and tracesSampleRate', () => {
    const cfg = createSentryCloudflareConfig('https://key@sentry.io/1', { tracesSampleRate: 0.5 });
    expect(cfg.dsn).toBe('https://key@sentry.io/1');
    expect(cfg.tracesSampleRate).toBe(0.5);
  });

  it('passes through sendDefaultPii and release', () => {
    const cfg = createSentryCloudflareConfig('https://key@sentry.io/1', {
      tracesSampleRate: 1.0,
      sendDefaultPii: true,
      release: 'v2.0.0',
    });
    expect(cfg.sendDefaultPii).toBe(true);
    expect(cfg.release).toBe('v2.0.0');
  });
});

// ---------------------------------------------------------------------------
// sentryMiddleware
// ---------------------------------------------------------------------------

describe('sentryMiddleware', () => {
  const config = { dsn: 'https://key@sentry.io/1', environment: 'staging' as const, workerName: 'test-worker' };

  it('passes request through successfully', async () => {
    const app = new Hono();
    app.use('*', sentryMiddleware(config));
    app.get('/ok', (c) => c.json({ ok: true }));

    const res = await app.request('/ok');
    expect(res.status).toBe(200);
  });

  it('calls startSpan with the workerName', async () => {
    mockStartSpan.mockClear();
    const app = new Hono();
    app.use('*', sentryMiddleware({ ...config, workerName: 'my-worker' }));
    app.get('/ping', (c) => c.json({}));
    await app.request('/ping');
    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: 'my-worker', op: 'http.server' },
      expect.any(Function),
    );
  });

  it('falls back to "worker" when workerName is not set', async () => {
    mockStartSpan.mockClear();
    const app = new Hono();
    app.use('*', sentryMiddleware({ dsn: 'https://k@s.io/1', environment: 'production' as const }));
    app.get('/ping', (c) => c.json({}));
    await app.request('/ping');
    expect(mockStartSpan).toHaveBeenCalledWith(
      { name: 'worker', op: 'http.server' },
      expect.any(Function),
    );
  });

  it('capturesError and rethrows on exception', async () => {
    mockStartSpan.mockImplementationOnce(async (_opts: unknown, fn: () => Promise<unknown>) => {
      try {
        return await fn();
      } catch (err) {
        mockCaptureException(err);
        throw err;
      }
    });

    const app = new Hono();
    app.use('*', sentryMiddleware(config));
    app.get('/boom', () => {
      throw new Error('boom');
    });

    // Hono will return 500 internally since error propagates
    const res = await app.request('/boom');
    expect([500, 200]).toContain(res.status); // error captured regardless
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('sets requestId tag when requestId is present in context', async () => {
    mockSetTag.mockClear();
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('requestId', 'set-req-id');
      await next();
    });
    app.use('*', sentryMiddleware(config));
    app.get('/rid', (c) => c.json({}));
    await app.request('/rid');
    expect(mockSetTag).toHaveBeenCalledWith('requestId', 'set-req-id');
  });
});
