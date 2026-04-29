import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  createQueryContext,
  generateCorrelationId,
  getCorrelationId,
  correlationIdMiddleware,
} from './correlation.js';

// ---------------------------------------------------------------------------
// generateCorrelationId
// ---------------------------------------------------------------------------

describe('generateCorrelationId', () => {
  it('returns a UUID v4-shaped string', () => {
    const id = generateCorrelationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });

  it('returns a unique value each call', () => {
    const a = generateCorrelationId();
    const b = generateCorrelationId();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// correlationIdMiddleware
// ---------------------------------------------------------------------------

describe('correlationIdMiddleware', () => {
  it('uses x-correlation-id header when present', async () => {
    const app = new Hono();
    app.use('*', correlationIdMiddleware());
    app.get('/', (c) => c.text(c.get('correlationId') ?? ''));

    const res = await app.request('/', { headers: { 'x-correlation-id': 'test-id-001' } });
    expect(await res.text()).toBe('test-id-001');
    expect(res.headers.get('x-correlation-id')).toBe('test-id-001');
  });

  it('falls back to x-request-id when x-correlation-id is absent', async () => {
    const app = new Hono();
    app.use('*', correlationIdMiddleware());
    app.get('/', (c) => c.text(c.get('correlationId') ?? ''));

    const res = await app.request('/', { headers: { 'x-request-id': 'req-fallback-001' } });
    expect(await res.text()).toBe('req-fallback-001');
  });

  it('generates a new UUID when no header is present', async () => {
    const app = new Hono();
    app.use('*', correlationIdMiddleware());
    app.get('/', (c) => c.text(c.get('correlationId') ?? ''));

    const res = await app.request('/');
    const body = await res.text();
    expect(body).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });

  it('respects a custom header name', async () => {
    const app = new Hono();
    app.use('*', correlationIdMiddleware('x-trace-id'));
    app.get('/', (c) => c.text(c.get('correlationId') ?? ''));

    const res = await app.request('/', { headers: { 'x-trace-id': 'custom-trace-001' } });
    expect(await res.text()).toBe('custom-trace-001');
  });
});

// ---------------------------------------------------------------------------
// getCorrelationId
// ---------------------------------------------------------------------------

describe('getCorrelationId', () => {
  it('returns the correlationId stored in context', async () => {
    const app = new Hono();
    app.use('*', correlationIdMiddleware());
    let captured = '';
    app.get('/', (c) => {
      captured = getCorrelationId(c);
      return c.text('ok');
    });

    await app.request('/', { headers: { 'x-correlation-id': 'stored-id-001' } });
    expect(captured).toBe('stored-id-001');
  });

  it('generates a new id when correlationId is not set in context', () => {
    // Minimal Context stub without correlationId set
    const fakeCtx = { get: () => undefined } as unknown as Parameters<typeof getCorrelationId>[0];
    const id = getCorrelationId(fakeCtx);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  });
});

// ---------------------------------------------------------------------------
// createQueryContext
// ---------------------------------------------------------------------------

describe('createQueryContext', () => {
  it('creates a context with required correlationId', () => {
    const ctx = createQueryContext('cid-001');
    expect(ctx.correlationId).toBe('cid-001');
    expect(ctx.timestamp).toBeInstanceOf(Date);
    expect(ctx.userId).toBeUndefined();
    expect(ctx.tenantId).toBeUndefined();
  });

  it('includes optional userId and tenantId when provided', () => {
    const ctx = createQueryContext('cid-002', 'user-001', 'tenant-001');
    expect(ctx.userId).toBe('user-001');
    expect(ctx.tenantId).toBe('tenant-001');
  });
});
