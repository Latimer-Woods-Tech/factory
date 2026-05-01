/**
 * Phase C — Studio test webhook (public, HMAC-signed).
 *
 * Mounted at `/webhooks/studio-tests`. The path is public so the GitHub
 * Action runner can post without a JWT; trust comes from the
 * `X-Studio-Signature` HMAC of the raw body.
 */
import { Hono } from 'hono';
import type { TestWebhookPayload } from '@latimer-woods-tech/studio-core';
import type { AppEnv } from '../types.js';
import { verifyHmac } from '../lib/hmac.js';
import {
  getTestRun,
  updateTestRunStatus,
  upsertTestResults,
} from '../lib/test-store.js';

const studioTests = new Hono<AppEnv>();

studioTests.post('/', async (c) => {
  const env = c.env;
  if (!env.STUDIO_WEBHOOK_SECRET) {
    return c.json({ error: 'Webhook receiver not configured' }, 503);
  }

  const raw = await c.req.text();
  const sig = c.req.header('x-studio-signature');
  const ok = await verifyHmac(env.STUDIO_WEBHOOK_SECRET, raw, sig);
  if (!ok) return c.json({ error: 'Invalid signature' }, 401);

  let payload: TestWebhookPayload;
  try {
    payload = JSON.parse(raw) as TestWebhookPayload;
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  if (!payload.runId || !payload.status) {
    return c.json({ error: 'runId and status are required' }, 400);
  }

  const existing = await getTestRun(env.DB, payload.runId);
  if (!existing) return c.json({ error: 'Unknown run' }, 404);

  const patch: Parameters<typeof updateTestRunStatus>[2] = {
    status: payload.status,
  };
  if (payload.ghRunId) patch.ghRunId = payload.ghRunId;
  if (payload.ghRunUrl) patch.ghRunUrl = payload.ghRunUrl;
  if (payload.totals) patch.totals = payload.totals;
  if (
    payload.status === 'passed' ||
    payload.status === 'failed' ||
    payload.status === 'cancelled' ||
    payload.status === 'timed-out'
  ) {
    patch.finishedAt = new Date().toISOString();
  }

  await updateTestRunStatus(env.DB, payload.runId, patch);
  if (payload.results && payload.results.length > 0) {
    await upsertTestResults(env.DB, payload.runId, payload.results);
  }

  return c.json({ ok: true });
});

export default studioTests;
