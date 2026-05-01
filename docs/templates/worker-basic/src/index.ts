import { Hono } from 'hono';

/** Worker bindings — add secrets via `wrangler secret put` and vars via wrangler.jsonc. */
export interface Env {
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    worker: 'WORKER_NAME',
    environment: c.env.ENVIRONMENT,
    ts: new Date().toISOString(),
  }),
);

// ---------------------------------------------------------------------------
// Manifest — crawlable by Admin Studio function explorer
// ---------------------------------------------------------------------------

app.get('/manifest', (c) => {
  const manifest = {
    manifestVersion: 1,
    app: 'WORKER_NAME',
    env: c.env.ENVIRONMENT ?? 'production',
    generatedAt: new Date().toISOString(),
    entries: [
      {
        method: 'GET',
        path: '/health',
        auth: 'public',
        summary: 'Liveness probe',
        smoke: [{ expectedStatus: 200, expectContains: '"status":"ok"' }],
        slo: { p95Ms: 200, errorRate: 0.001 },
        tags: ['ops'],
      },
      {
        method: 'GET',
        path: '/manifest',
        auth: 'public',
        summary: 'Machine-readable manifest for studio catalog crawlers',
        smoke: [{ expectedStatus: 200, expectContains: '"manifestVersion"' }],
        tags: ['ops'],
      },
      // TODO: Add additional route entries here
    ],
  };
  return c.json(manifest);
});

// ---------------------------------------------------------------------------
// Global error handler — returns structured Factory error envelope
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  const status: 500 = 500;
  return c.json(
    {
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message,
        status,
        retryable: true,
      },
    },
    status,
  );
});

export default {
  fetch: app.fetch,
};
