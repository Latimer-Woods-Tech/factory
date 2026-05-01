/**
 * Unit tests for requireConfirmation middleware.
 *
 * Uses a minimal Hono app that pre-populates `c.var.envContext` so we can
 * exercise every confirmation tier and role-check path without needing a
 * real JWT or database.
 */
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import type { EnvContext } from '@latimer-woods-tech/studio-core';
import { requireConfirmation } from './require-confirmation.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildCtx(overrides: Partial<EnvContext> = {}): EnvContext {
  return {
    env: 'production',
    sessionId: 'sess-test',
    userId: 'user-test-id',
    userEmail: 'op@example.com',
    role: 'admin',
    envLockedAt: Date.now(),
    ...overrides,
  };
}

/**
 * Build a minimal Hono app where the first middleware injects an envContext
 * and the second is requireConfirmation. The catch-all handler returns 200
 * to signal the middleware chain completed.
 */
function buildApp(
  ctx: EnvContext,
  opts: Parameters<typeof requireConfirmation>[0],
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Inject context (normally done by JWT middleware).
  app.use('*', async (c, next) => {
    c.set('envContext', ctx);
    await next();
  });

  app.post(
    '/action',
    requireConfirmation(opts),
    (c) => c.json({ ok: true }),
  );

  return app;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function expectedToken(action: string, userId: string, env: string): Promise<string> {
  return (await sha256Hex(`${action}:${userId}:${env}`)).slice(0, 16);
}

// ── role-check tests ──────────────────────────────────────────────────────────

describe('requireConfirmation — role checks', () => {
  const opts = {
    action: 'test.action',
    reversibility: 'reversible' as const,
    minRole: 'admin' as const,
  };

  it('returns 401 when envContext is not set', async () => {
    const app = new Hono<AppEnv>();
    app.post('/action', requireConfirmation(opts), (c) => c.json({ ok: true }));
    const res = await app.fetch(new Request('http://x/action', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when role is below minRole (viewer)', async () => {
    const app = buildApp(buildCtx({ role: 'viewer' }), opts);
    const res = await app.fetch(new Request('http://x/action', { method: 'POST' }));
    expect(res.status).toBe(403);
  });

  it('returns 403 when role is below minRole (editor)', async () => {
    const app = buildApp(buildCtx({ role: 'editor' }), opts);
    const res = await app.fetch(new Request('http://x/action', { method: 'POST' }));
    expect(res.status).toBe(403);
  });

  it('allows admin role (meets minRole: admin)', async () => {
    // reversible + production = tier 2, so X-Confirmed header needed
    // but we just need to get past the role check — the confirm check fires next
    const app = buildApp(buildCtx({ env: 'local', role: 'admin' }), {
      ...opts,
      reversibility: 'reversible', // local = tier 0, no confirm needed
    });
    const res = await app.fetch(new Request('http://x/action', { method: 'POST' }));
    expect(res.status).toBe(200);
  });

  it('allows owner role (exceeds minRole: admin)', async () => {
    const app = buildApp(buildCtx({ env: 'local', role: 'owner' }), {
      ...opts,
      reversibility: 'reversible',
    });
    const res = await app.fetch(new Request('http://x/action', { method: 'POST' }));
    expect(res.status).toBe(200);
  });
});

// ── tier 0: no confirmation required ─────────────────────────────────────────

describe('requireConfirmation — tier 0 (local, reversible)', () => {
  const opts = {
    action: 'test.action',
    reversibility: 'reversible' as const,
    minRole: 'editor' as const,
  };

  it('passes through without any confirmation header', async () => {
    const app = buildApp(buildCtx({ env: 'local' }), opts);
    const res = await app.fetch(new Request('http://x/action', { method: 'POST' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});

// ── tier 1: click-to-confirm ─────────────────────────────────────────────────

describe('requireConfirmation — tier 1 (local, manual-rollback)', () => {
  const opts = {
    action: 'test.action',
    reversibility: 'manual-rollback' as const,
    minRole: 'editor' as const,
  };

  it('returns 412 without X-Confirmed header', async () => {
    const app = buildApp(buildCtx({ env: 'local' }), opts);
    const res = await app.fetch(new Request('http://x/action', { method: 'POST' }));
    expect(res.status).toBe(412);
    const body = await res.json<{ error: string; tier: number }>();
    expect(body.error).toBe('Confirmation required');
    expect(body.tier).toBe(1);
  });

  it('passes through with X-Confirmed: true', async () => {
    const app = buildApp(buildCtx({ env: 'local' }), opts);
    const res = await app.fetch(
      new Request('http://x/action', {
        method: 'POST',
        headers: { 'X-Confirmed': 'true' },
      }),
    );
    expect(res.status).toBe(200);
  });
});

// ── tier 2: type-to-confirm ───────────────────────────────────────────────────

describe('requireConfirmation — tier 2 (production, manual-rollback)', () => {
  const ctx = buildCtx({ env: 'production', userId: 'uid-42' });
  const opts = {
    action: 'payout.batch.execute',
    reversibility: 'manual-rollback' as const,
    minRole: 'admin' as const,
  };

  it('returns 412 without X-Confirm-Token', async () => {
    const app = buildApp(ctx, opts);
    const res = await app.fetch(new Request('http://x/action', { method: 'POST' }));
    expect(res.status).toBe(412);
    const body = await res.json<{ error: string; tier: number }>();
    expect(body.error).toBe('Invalid or missing confirmation token');
    expect(body.tier).toBe(2);
  });

  it('returns 412 with incorrect X-Confirm-Token', async () => {
    const app = buildApp(ctx, opts);
    const res = await app.fetch(
      new Request('http://x/action', {
        method: 'POST',
        headers: { 'X-Confirm-Token': 'wrong-token-here' },
      }),
    );
    expect(res.status).toBe(412);
  });

  it('passes through with the correct X-Confirm-Token', async () => {
    const app = buildApp(ctx, opts);
    const token = await expectedToken(opts.action, ctx.userId, ctx.env);
    const res = await app.fetch(
      new Request('http://x/action', {
        method: 'POST',
        headers: { 'X-Confirm-Token': token },
      }),
    );
    expect(res.status).toBe(200);
  });
});

// ── dry-run ───────────────────────────────────────────────────────────────────

describe('requireConfirmation — dry-run bypass', () => {
  const ctx = buildCtx({ env: 'production' });
  const opts = {
    action: 'deploy.trigger',
    reversibility: 'manual-rollback' as const,
    minRole: 'admin' as const,
    allowDryRun: true,
  };

  it('passes through without confirmation token when ?dryRun=true', async () => {
    const app = buildApp(ctx, opts);
    const res = await app.fetch(
      new Request('http://x/action?dryRun=true', { method: 'POST' }),
    );
    expect(res.status).toBe(200);
  });

  it('passes through without confirmation token when X-Dry-Run: true header', async () => {
    const app = buildApp(ctx, opts);
    const res = await app.fetch(
      new Request('http://x/action', {
        method: 'POST',
        headers: { 'X-Dry-Run': 'true' },
      }),
    );
    expect(res.status).toBe(200);
  });

  it('does NOT allow dry-run bypass when allowDryRun is false', async () => {
    const app = buildApp(ctx, { ...opts, allowDryRun: false });
    const res = await app.fetch(
      new Request('http://x/action?dryRun=true', { method: 'POST' }),
    );
    // Should still require the confirmation token
    expect(res.status).toBe(412);
  });
});
