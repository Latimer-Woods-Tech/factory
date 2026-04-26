import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createAdminRouter } from './index';
import type { FactoryDb } from '@factory/neon';
import type { Analytics } from '@factory/analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnalytics(): Analytics {
  return {
    track: vi.fn(),
    identify: vi.fn(),
    businessEvent: vi.fn(),
    page: vi.fn(),
  } as unknown as Analytics;
}

function makeDb(execute: unknown): FactoryDb {
  return { execute } as unknown as FactoryDb;
}

function mountRouter(db: FactoryDb): Hono {
  const analytics = makeAnalytics();
  const router = createAdminRouter({ db, analytics, appId: 'test-app' });
  const app = new Hono();
  app.route('/admin', router);
  return app;
}

async function req(
  app: Hono,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return app.fetch(new Request(`http://localhost${path}`, init));
}

// ---------------------------------------------------------------------------
// GET /admin — dashboard
// ---------------------------------------------------------------------------
describe('GET /admin', () => {
  it('returns dashboard summary', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: '42' }] })  // totalUsers
      .mockResolvedValueOnce({ rows: [{ count: '30' }] })  // activeUsers
      .mockResolvedValueOnce({ rows: [{ count: '5' }] });  // recentEvents
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['appId']).toBe('test-app');
    expect(body['totalUsers']).toBe(42);
    expect(body['activeUsers']).toBe(30);
    expect(body['recentEvents']).toBe(5);
  });

  it('defaults counts to zero when rows are empty', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['totalUsers']).toBe(0);
    expect(body['activeUsers']).toBe(0);
    expect(body['recentEvents']).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /admin/users
// ---------------------------------------------------------------------------
describe('GET /admin/users', () => {
  it('returns user list with default pagination', async () => {
    const userRow = { id: 'u1', email: 'a@b.com', status: 'active', created_at: '2026-01-01' };
    const execute = vi.fn().mockResolvedValue({ rows: [userRow] });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin/users');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['page']).toBe(1);
    expect(body['limit']).toBe(20);
    expect(Array.isArray(body['users'])).toBe(true);
  });

  it('respects page and limit query params', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin/users?page=2&limit=10');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['page']).toBe(2);
    expect(body['limit']).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// GET /admin/users/:id
// ---------------------------------------------------------------------------
describe('GET /admin/users/:id', () => {
  it('returns user with subscriptions', async () => {
    const userRow = { id: 'u1', email: 'a@b.com', status: 'active', created_at: '2026-01-01' };
    const subRow = { plan: 'pro', mrr: 2900, status: 'active' };
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [userRow] })
      .mockResolvedValueOnce({ rows: [subRow] });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin/users/u1');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect((body['user'] as Record<string, unknown>)['id']).toBe('u1');
    expect(Array.isArray(body['subscriptions'])).toBe(true);
  });

  it('returns 404 when user not found', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin/users/missing');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /admin/users/:id/suspend
// ---------------------------------------------------------------------------
describe('POST /admin/users/:id/suspend', () => {
  it('suspends a user and returns success', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'POST', '/admin/users/u1/suspend');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['success']).toBe(true);
    expect(body['status']).toBe('suspended');
  });

  it('returns 404 when user not found', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'POST', '/admin/users/missing/suspend');
    expect(res.status).toBe(404);
  });

  it('returns 404 when rowCount is null (driver returns null for rowCount)', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [], rowCount: null });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'POST', '/admin/users/missing/suspend');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /admin/events
// ---------------------------------------------------------------------------
describe('GET /admin/events', () => {
  it('returns recent events with parsed properties (string)', async () => {
    const evtRow = {
      event: 'page.view',
      user_id: 'u1',
      occurred_at: '2026-01-01T00:00:00Z',
      properties: '{"page":"/home"}',
    };
    const execute = vi.fn().mockResolvedValue({ rows: [evtRow] });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin/events');
    expect(res.status).toBe(200);
    const body = await res.json() as { events: Array<Record<string, unknown>> };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]?.['properties']).toEqual({ page: '/home' });
  });

  it('returns recent events with pre-parsed properties (object)', async () => {
    const evtRow = {
      event: 'user.signup',
      user_id: 'u2',
      occurred_at: '2026-01-02T00:00:00Z',
      properties: { source: 'organic' },
    };
    const execute = vi.fn().mockResolvedValue({ rows: [evtRow] });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin/events');
    expect(res.status).toBe(200);
    const body = await res.json() as { events: Array<Record<string, unknown>> };
    expect(body.events[0]?.['properties']).toEqual({ source: 'organic' });
  });
});

// ---------------------------------------------------------------------------
// onError — non-FactoryBaseError handler
// ---------------------------------------------------------------------------
describe('onError fallback', () => {
  it('returns 500 for unexpected non-FactoryBaseError exceptions', async () => {
    // Reject with a plain Error, which is not a FactoryBaseError
    const execute = vi.fn().mockRejectedValue(new Error('unexpected'));
    const app = mountRouter(makeDb(execute));
    // dashboard route will throw since execute rejects
    const res = await req(app, 'GET', '/admin');
    expect(res.status).toBe(500);
    const body = await res.json() as Record<string, unknown>;
    expect(body['error']).toBe('Internal server error');
  });
});

// ---------------------------------------------------------------------------
// GET /admin/health
// ---------------------------------------------------------------------------
describe('GET /admin/health', () => {
  it('returns ok when db is healthy', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin/health');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body['status']).toBe('ok');
    expect(body['db']).toBe('connected');
  });

  it('returns 500 when db connectivity fails', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('connection refused'));
    const app = mountRouter(makeDb(execute));
    const res = await req(app, 'GET', '/admin/health');
    expect(res.status).toBe(500);
  });
});
