import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const monitoringMocks = vi.hoisted(() => ({
  captureError: vi.fn(),
}));

vi.mock('@adrper79-dot/monitoring', () => monitoringMocks);

import { createLogger, withRequestId } from './index';

type LogEntry = Record<string, unknown>;

function parseLogEntry(value: unknown): LogEntry {
  return JSON.parse(String(value)) as LogEntry;
}

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockConsoleLog = () => vi.spyOn(console, 'log').mockImplementation(() => {});

  it('createLogger returns the expected methods', () => {
    const logger = createLogger({
      workerId: 'worker-1',
      requestId: 'req-1',
    });

    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.child).toBe('function');
  });

  it('info, warn, and debug emit structured JSON', () => {
    const consoleLogSpy = mockConsoleLog();
    const logger = createLogger({
      workerId: 'worker-1',
      requestId: 'req-1',
      userId: 'user-1',
    });

    logger.info('hello', { route: '/' });
    logger.warn('careful');
    logger.debug('trace', { detail: true });

    const entries = consoleLogSpy.mock.calls.map(([entry]) => parseLogEntry(entry));

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      level: 'info',
      msg: 'hello',
      workerId: 'worker-1',
      requestId: 'req-1',
      userId: 'user-1',
      route: '/',
    });
    expect(entries[1]).toMatchObject({
      level: 'warn',
      msg: 'careful',
    });
    expect(entries[2]).toMatchObject({
      level: 'debug',
      msg: 'trace',
      detail: true,
    });
  });

  it('suppresses debug output in production', () => {
    const consoleLogSpy = mockConsoleLog();
    const logger = createLogger({
      workerId: 'worker-1',
      requestId: 'req-1',
      environment: 'production',
    });

    logger.debug('hidden');

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('error emits JSON and reports the exception to monitoring', () => {
    const consoleLogSpy = mockConsoleLog();
    const logger = createLogger({
      workerId: 'worker-1',
      requestId: 'req-1',
      tenantId: 'tenant-1',
    });

    const error = new Error('boom');
    logger.error('failed', error, { route: '/x' });

    expect(monitoringMocks.captureError).toHaveBeenCalledWith(error, {
      requestId: 'req-1',
      tenantId: 'tenant-1',
      userId: undefined,
      extra: { route: '/x' },
    });

    const entry = parseLogEntry(consoleLogSpy.mock.calls[0]?.[0]);
    expect(entry).toMatchObject({
      level: 'error',
      msg: 'failed',
      errorMessage: 'boom',
      errorName: 'Error',
      route: '/x',
    });
  });

  it('error emits JSON without reporting when no error object is supplied', () => {
    const consoleLogSpy = mockConsoleLog();
    const logger = createLogger({
      workerId: 'worker-1',
      requestId: 'req-1',
    });

    logger.error('failed');

    expect(monitoringMocks.captureError).not.toHaveBeenCalled();
    const entry = parseLogEntry(consoleLogSpy.mock.calls[0]?.[0]);
    expect(entry).toMatchObject({
      level: 'error',
      msg: 'failed',
    });
    expect(entry.error).toBeUndefined();
    expect(entry.errorMessage).toBeUndefined();
  });

  it('error serializes non-Error values', () => {
    const consoleLogSpy = mockConsoleLog();
    const logger = createLogger({
      workerId: 'worker-1',
      requestId: 'req-1',
    });

    logger.error('failed', 'boom');

    expect(monitoringMocks.captureError).toHaveBeenCalledWith('boom', {
      requestId: 'req-1',
      tenantId: undefined,
      userId: undefined,
      extra: undefined,
    });
    const entry = parseLogEntry(consoleLogSpy.mock.calls[0]?.[0]);
    expect(entry).toMatchObject({
      level: 'error',
      msg: 'failed',
      error: 'boom',
    });
  });

  it('child inherits parent context and merges child keys', () => {
    const consoleLogSpy = mockConsoleLog();
    const logger = createLogger({
      workerId: 'worker-1',
      requestId: 'req-1',
      tenantId: 'tenant-1',
    }).child({
      userId: 'user-2',
    });

    logger.info('child');

    const entry = parseLogEntry(consoleLogSpy.mock.calls[0]?.[0]);
    expect(entry).toMatchObject({
      tenantId: 'tenant-1',
      userId: 'user-2',
      requestId: 'req-1',
    });
  });

  it('withRequestId injects requestId into the Hono context', async () => {
    const uuidSpy = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-4111-8111-111111111111');
    const app = new Hono();

    app.use('*', withRequestId());
    app.get('/', (c) =>
      c.json({
        requestId: c.get('requestId'),
      }),
    );

    const response = await app.request('/', {
      headers: {
        'x-worker-id': 'worker-abc',
      },
    });
    const body = (await response.json()) as { requestId: string };

    expect(body.requestId).toBe('11111111-1111-4111-8111-111111111111');
    expect(uuidSpy).toHaveBeenCalledTimes(1);
    uuidSpy.mockRestore();
  });
});
