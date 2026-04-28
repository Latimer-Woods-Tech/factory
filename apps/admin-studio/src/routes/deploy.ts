import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import { requireConfirmation } from '../middleware/require-confirmation.js';
import { requireEnv } from '@adrper79-dot/studio-core';

const deploy = new Hono<AppEnv>();

/**
 * GET /deploys — recent deploy history (Phase D wires real Cloudflare API).
 */
deploy.get('/', (c) => c.json({ deploys: [] }));

/**
 * POST /deploys — trigger a deploy. Tiered confirmation:
 *   - staging: reversible (tier 1: click)
 *   - production: manual-rollback (tier 2: type-to-confirm)
 */
deploy.post(
  '/',
  requireConfirmation({
    action: 'deploy.trigger',
    reversibility: 'manual-rollback',
    minRole: 'admin',
    allowDryRun: true,
  }),
  async (c) => {
    const body = await c.req.json<{ app: string; ref?: string }>();
    const ctx = c.var.envContext;

    // Production deploys require owner role (override the default 'admin' minRole).
    if (ctx.env === 'production' && ctx.role !== 'owner') {
      return c.json({ error: 'Production deploys require owner role' }, 403);
    }

    // Local can never deploy anywhere — local is a development sandbox.
    try {
      requireEnv(ctx, ['staging', 'production']);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }

    if (c.req.query('dryRun') === 'true') {
      return c.json({
        dryRun: true,
        plan: {
          app: body.app,
          targetEnv: ctx.env,
          ref: body.ref ?? 'main',
          workflow: `deploy-${body.app}.yml`,
        },
      });
    }

    // TODO Phase D: dispatch workflow via GitHub API.
    return c.json({
      runId: crypto.randomUUID(),
      app: body.app,
      env: ctx.env,
      status: 'queued',
    });
  },
);

export default deploy;
