import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import { requireConfirmation } from '../middleware/require-confirmation.js';

const tests = new Hono<AppEnv>();

/**
 * GET /tests — list available test suites discovered from package manifests.
 * Phase A returns a static list; Phase C scans actual workspace packages.
 */
tests.get('/', (c) => {
  return c.json({
    suites: [
      { id: 'studio-core', name: '@adrper79-dot/studio-core', path: 'packages/studio-core', testCount: 8 },
      { id: 'auth', name: '@adrper79-dot/auth', path: 'packages/auth', testCount: 32 },
      { id: 'errors', name: '@adrper79-dot/errors', path: 'packages/errors', testCount: 14 },
      { id: 'llm', name: '@adrper79-dot/llm', path: 'packages/llm', testCount: 21 },
    ],
  });
});

/**
 * POST /tests/runs — dispatch a test run via GitHub Actions workflow_dispatch.
 * Body: { suites: string[], filter?: string }
 *
 * GitHub Actions runs the actual tests and reports back via webhook (Phase C).
 * Phase A: returns a stub run id.
 */
tests.post(
  '/runs',
  requireConfirmation({
    action: 'tests.dispatch',
    reversibility: 'reversible',
    minRole: 'editor',
    allowDryRun: true,
  }),
  async (c) => {
    const body = await c.req.json<{ suites?: string[]; filter?: string }>();
    const runId = crypto.randomUUID();

    if (c.req.query('dryRun') === 'true') {
      return c.json({
        dryRun: true,
        plan: {
          workflow: 'studio-test-dispatch.yml',
          suites: body.suites ?? ['*'],
          filter: body.filter ?? null,
        },
      });
    }

    // TODO Phase C: POST to https://api.github.com/repos/{owner}/{repo}/actions/workflows/...
    return c.json({
      runId,
      status: 'queued',
      url: `https://github.com/adrper79-dot/Factory/actions/runs/${runId}`,
    });
  },
);

/**
 * GET /tests/runs/:id — poll status. Phase C streams via SSE.
 */
tests.get('/runs/:id', (c) => {
  return c.json({
    runId: c.req.param('id'),
    status: 'pending',
    suites: [],
  });
});

export default tests;
