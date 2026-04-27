import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

// Mock @adrper79-dot/monitoring before importing logger
vi.mock('@adrper79-dot/monitoring', () => ({
  captureError: vi.fn().mockReturnValue('mock-sentry-event-id'),
}));

import { captureError } from '@adrper79-dot/monitoring';
import { createLogger, withRequestId } from './index.js';

// ---------------------------------------------------------------------------
// createLogger
// ---------------------------------------------------------------------------

describe('createLogger', () => {
  it('emits info as JSON to console.log', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({ workerId: 'w1', requestId: 'r1' });
    logger.info('Hello world', { extra: 'data' });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const emitted = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(emitted.level).toBe('info');
    expect(emitted.msg).toBe('Hello world');
    expect(emitted.workerId).toBe('w1');
    expect(emitted.requestId).toBe('r1');
    expect(emitted.extra).toBe('data');
    expect(typeof emitted.ts).toBe('string');
  });

  it('emits warn with level=warn', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({ workerId: 'w1', requestId: 'r1' });
    logger.warn('Watch out');
    const emitted = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(emitted.level).toBe('warn');
    expect(emitted.msg).toBe('Watch out');
  });

  it('emits error with errorMessage and calls captureError', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({ workerId: 'w1', requestId: 'r1', userId: 'u1', tenantId: 't1' });
    const err = new Error('boom');
    logger.error('Something broke', err, { attempt: 2 });

    expect(vi.mocked(captureError)).toHaveBeenCalledWith(err, {
      requestId: 'r1',
      userId: 'u1',
      tenantId: 't1',
      extra: { attempt: 2 },
    });

    const emitted = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(emitted.level).toBe('error');
    expect(emitted.errorMessage).toBe('boom');
    expect(emitted.errorName).toBe('Error');
  });

  it('emits error without calling captureError when err is undefined', () => {
    vi.mocked(captureError).mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({ workerId: 'w1', requestId: 'r1' });
    logger.error('Something broke');
    expect(vi.mocked(captureError)).not.toHaveBeenCalled();
  });

  it('includes non-Error error value in the emitted log', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({ workerId: 'w1', requestId: 'r1' });
    logger.error('Crash', { weirdError: true });
    const emitted = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(emitted.error).toEqual({ weirdError: true });
  });

  it('emits debug in non-production environments', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({ workerId: 'w1', requestId: 'r1', environment: 'development' });
    logger.debug('debug line');
    expect(consoleSpy).toHaveBeenCalledOnce();
    const emitted = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(emitted.level).toBe('debug');
  });

  it('suppresses debug in production', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({ workerId: 'w1', requestId: 'r1', environment: 'production' });
    logger.debug('should be suppressed');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('child() returns a logger with merged context', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const parent = createLogger({ workerId: 'w1', requestId: 'r1' });
    const child = parent.child({ userId: 'u99' });
    child.info('from child');
    const emitted = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(emitted.workerId).toBe('w1');
    expect(emitted.requestId).toBe('r1');
    expect(emitted.userId).toBe('u99');
  });

  it('child() overrides parent context fields', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const parent = createLogger({ workerId: 'w1', requestId: 'r1', userId: 'original' });
    const child = parent.child({ userId: 'overridden' });
    child.info('override');
    const emitted = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(emitted.userId).toBe('overridden');
  });
});

// ---------------------------------------------------------------------------
// withRequestId middleware
// ---------------------------------------------------------------------------

describe('withRequestId', () => {
  it('attaches requestId and logger to context', async () => {
    const app = new Hono();
    app.use('*', withRequestId());
    app.get('/test', (c) => {
      const requestId = c.get('requestId');
      const logger = c.get('logger');
      return c.json({ hasId: typeof requestId === 'string', hasLogger: logger !== undefined });
    });

    const res = await app.request('/test', {
      headers: { 'x-worker-id': 'my-worker' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { hasId: boolean; hasLogger: boolean };
    expect(body.hasId).toBe(true);
    expect(body.hasLogger).toBe(true);
  });

  it('generates different requestIds per request', async () => {
    const ids: string[] = [];
    const app = new Hono();
    app.use('*', withRequestId());
    app.get('/id', (c) => {
      ids.push(c.get('requestId'));
      return c.json({ ok: true });
    });

    await app.request('/id');
    await app.request('/id');
    expect(ids[0]).toBeDefined();
    expect(ids[1]).toBeDefined();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('uses unknown-worker when x-worker-id header is absent', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = new Hono();
    app.use('*', withRequestId());
    app.get('/log', (c) => {
      c.get('logger').info('no worker header');
      return c.json({ ok: true });
    });

    await app.request('/log');
    if (consoleSpy.mock.calls.length > 0) {
      const emitted = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
      expect(emitted.workerId).toBe('unknown-worker');
    }
  });

  it('uses x-worker-id header when provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const app = new Hono();
    app.use('*', withRequestId());
    app.get('/log', (c) => {
      c.get('logger').info('has worker header');
      return c.json({ ok: true });
    });

    await app.request('/log', { headers: { 'x-worker-id': 'api-gateway' } });
    const emitted = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(emitted.workerId).toBe('api-gateway');
  });
});
