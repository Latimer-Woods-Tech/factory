import { Hono } from 'hono';
import type { AppEnv } from '../types.js';

const me = new Hono<AppEnv>();

/**
 * GET /me — returns the current user's env context. Always cheap.
 */
me.get('/', (c) => {
  const ctx = c.var.envContext;
  return c.json({
    env: ctx.env,
    app: ctx.app,
    user: { id: ctx.userId, email: ctx.userEmail, role: ctx.role },
    sessionId: ctx.sessionId,
    envLockedAt: ctx.envLockedAt,
  });
});

export default me;
