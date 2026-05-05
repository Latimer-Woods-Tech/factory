import { beforeAll, describe, expect, it } from 'vitest';
import worker from '../index.js';
import type { Env } from '../env.js';

const password = 'correct-password';
let passwordHash = '';
let authToken = '';

const executionContext = {} as ExecutionContext;

/**
 * Minimal in-memory KVNamespace mock for test isolation.
 */
function makeKVMock(store: Record<string, string> = {}): KVNamespace {
  const data = { ...store };
  return {
    get(key: string) {
      return Promise.resolve(data[key] ?? null);
    },
    put(key: string, value: string) {
      data[key] = value;
      return Promise.resolve();
    },
    delete(key: string) {
      delete data[key];
      return Promise.resolve();
    },
    list({ prefix = '', limit = 1000 }: { prefix?: string; limit?: number } = {}) {
      const keys = Object.keys(data)
        .filter((k) => k.startsWith(prefix))
        .slice(0, limit)
        .map((name) => ({ name, expiration: undefined, metadata: null }));
      return Promise.resolve({ keys, list_complete: true, cursor: '' });
    },
    getWithMetadata: () => Promise.resolve({ value: null, metadata: null }),
  } as unknown as KVNamespace;
}

function buildEnv(overrides: Partial<Env> = {}): Env {
  return {
    STUDIO_ENV: 'staging',
    ALLOWED_ORIGINS: 'https://admin-studio.example',
    DB: { connectionString: 'postgres://example' } as Env['DB'],
    JWT_SECRET: 'test-jwt-secret-with-enough-entropy',
    STUDIO_ADMIN_EMAIL: 'operator@example.com',
    STUDIO_ADMIN_PASSWORD_SHA256: passwordHash,
    GITHUB_TOKEN: 'github-token',
    ANTHROPIC_API_KEY: 'anthropic-key',
    ...overrides,
  };
}

beforeAll(async () => {
  passwordHash = await sha256Hex(password);

  const loginRes = await worker.fetch(
    new Request('https://admin-studio.example/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'operator@example.com', password, env: 'staging' }),
    }),
    buildEnv(),
    executionContext,
  );
  expect(loginRes.status).toBe(200);
  const body = await loginRes.json<{ token: string }>();
  authToken = body.token;
});

function authHeaders() {
  return { Authorization: `Bearer ${authToken}` };
}

describe('GET /observability/synthetic/journey', () => {
  it('returns configured:false when MONITOR_KV is not bound', async () => {
    const res = await worker.fetch(
      new Request('https://admin-studio.example/observability/synthetic/journey', {
        headers: authHeaders(),
      }),
      buildEnv(),
      executionContext,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ configured: boolean; outageClass: string }>();
    expect(body.configured).toBe(false);
    expect(body.outageClass).toBe('unknown');
  });

  it('returns configured:true with unknown outageClass when no snapshot exists', async () => {
    const kv = makeKVMock({});
    const res = await worker.fetch(
      new Request('https://admin-studio.example/observability/synthetic/journey', {
        headers: authHeaders(),
      }),
      buildEnv({ MONITOR_KV: kv }),
      executionContext,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{ configured: boolean; outageClass: string; probes: unknown[] }>();
    expect(body.configured).toBe(true);
    expect(body.outageClass).toBe('unknown');
    expect(body.probes).toHaveLength(0);
  });

  it('classifies outageClass:ok when all journey probes pass', async () => {
    const snapshot = buildSnapshot({ allPassing: true });
    const kv = makeKVMock({ latest: JSON.stringify(snapshot) });

    const res = await worker.fetch(
      new Request('https://admin-studio.example/observability/synthetic/journey', {
        headers: authHeaders(),
      }),
      buildEnv({ MONITOR_KV: kv }),
      executionContext,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      configured: boolean;
      outageClass: string;
      probes: Array<{ id: string; ok: boolean; latencyMs: number }>;
      trend: unknown[];
    }>();
    expect(body.configured).toBe(true);
    expect(body.outageClass).toBe('ok');
    expect(body.probes.length).toBeGreaterThan(0);
    expect(body.probes.every((p) => p.ok)).toBe(true);
    expect(body.trend).toHaveLength(0);
  });

  it('classifies outageClass:partial when some journey probes fail', async () => {
    const snapshot = buildSnapshot({ failIds: ['slo.journey.auth-api'] });
    const kv = makeKVMock({ latest: JSON.stringify(snapshot) });

    const res = await worker.fetch(
      new Request('https://admin-studio.example/observability/synthetic/journey', {
        headers: authHeaders(),
      }),
      buildEnv({ MONITOR_KV: kv }),
      executionContext,
    );

    const body = await res.json<{
      outageClass: string;
      probes: Array<{ id: string; ok: boolean; error?: string; url?: string }>;
    }>();
    expect(body.outageClass).toBe('partial');
    const failed = body.probes.filter((p) => !p.ok);
    expect(failed.length).toBe(1);
    expect(failed[0]?.id).toBe('slo.journey.auth-api');
    expect(failed[0]?.error).toBe('Unexpected status 500 (expected 200)');
    expect(failed[0]?.url).toBe('https://prime-self.adrper79.workers.dev/health');
  });

  it('classifies outageClass:outage when all journey probes fail', async () => {
    const allJourneyIds = [
      'slo.journey.render-ingest',
      'slo.journey.video-dispatch',
      'slo.journey.auth-api',
      'slo.journey.operator-plane',
      'slo.journey.webhook',
    ];
    const snapshot = buildSnapshot({ failIds: allJourneyIds });
    const kv = makeKVMock({ latest: JSON.stringify(snapshot) });

    const res = await worker.fetch(
      new Request('https://admin-studio.example/observability/synthetic/journey', {
        headers: authHeaders(),
      }),
      buildEnv({ MONITOR_KV: kv }),
      executionContext,
    );

    const body = await res.json<{ outageClass: string }>();
    expect(body.outageClass).toBe('outage');
  });

  it('returns trend points from recent KV snapshots', async () => {
    const snapshot1 = buildSnapshot({ allPassing: true, ts: '2025-01-01T00:00:00.000Z' });
    const snapshot2 = buildSnapshot({
      failIds: ['slo.journey.auth-api'],
      ts: '2025-01-01T00:05:00.000Z',
    });
    const kv = makeKVMock({
      latest: JSON.stringify(snapshot2),
      'snapshots:2025-01-01T00:00:00.000Z': JSON.stringify(snapshot1),
      'snapshots:2025-01-01T00:05:00.000Z': JSON.stringify(snapshot2),
    });

    const res = await worker.fetch(
      new Request('https://admin-studio.example/observability/synthetic/journey', {
        headers: authHeaders(),
      }),
      buildEnv({ MONITOR_KV: kv }),
      executionContext,
    );

    const body = await res.json<{
      trend: Array<{ ts: string; journeyOk: number; journeyFailed: number }>;
    }>();
    expect(body.trend).toHaveLength(2);
    const passRun = body.trend.find((t) => t.ts === '2025-01-01T00:00:00.000Z');
    const failRun = body.trend.find((t) => t.ts === '2025-01-01T00:05:00.000Z');
    expect(passRun?.journeyFailed).toBe(0);
    expect(failRun?.journeyFailed).toBe(1);
  });

  it('returns 401 when request is unauthenticated', async () => {
    const res = await worker.fetch(
      new Request('https://admin-studio.example/observability/synthetic/journey'),
      buildEnv(),
      executionContext,
    );

    expect(res.status).toBe(401);
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

const JOURNEY_PROBE_URLS: Record<string, string> = {
  'slo.journey.render-ingest': 'https://schedule-worker.adrper79.workers.dev/health',
  'slo.journey.video-dispatch': 'https://video-cron.adrper79.workers.dev/health',
  'slo.journey.auth-api': 'https://prime-self.adrper79.workers.dev/health',
  'slo.journey.operator-plane': 'https://admin-studio-staging.adrper79.workers.dev/health',
  'slo.journey.webhook': 'https://schedule-worker.adrper79.workers.dev/stripe/health',
};

function buildSnapshot({
  allPassing = false,
  failIds = [] as string[],
  ts = '2025-01-01T12:00:00.000Z',
} = {}): object {
  const allIds = Object.keys(JOURNEY_PROBE_URLS);
  const latencies = Object.fromEntries(allIds.map((id) => [id, 42]));
  const urls = { ...JOURNEY_PROBE_URLS };
  const effectiveFailIds = allPassing ? [] : failIds;
  const failed = effectiveFailIds.map((id) => ({
    id,
    url: JOURNEY_PROBE_URLS[id],
    latencyMs: 123,
    error: 'Unexpected status 500 (expected 200)',
  }));
  return {
    ts,
    status: effectiveFailIds.length === 0 ? 'ok' : 'degraded',
    failed,
    latencies,
    urls,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
