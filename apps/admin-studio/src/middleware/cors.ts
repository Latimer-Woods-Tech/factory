/**
 * CORS middleware — strict allow-list from env.ALLOWED_ORIGINS.
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';

export function corsMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const origin = c.req.header('Origin');
    const allowed = c.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());

    if (origin && allowed.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Vary', 'Origin');
    }

    if (c.req.method === 'OPTIONS') {
      c.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      c.header(
        'Access-Control-Allow-Headers',
        'Authorization,Content-Type,X-Request-Id,X-Confirmed,X-Confirm-Token,X-Co-Signer-Token,X-Dry-Run',
      );
      c.header('Access-Control-Max-Age', '600');
      return c.body(null, 204);
    }

    await next();
  };
}
