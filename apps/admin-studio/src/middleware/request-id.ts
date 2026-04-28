/**
 * Request-id middleware: ensures every request has a stable correlation id
 * exposed both in the EnvContext and as the X-Request-Id response header.
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';

export function requestIdMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incoming = c.req.header('X-Request-Id');
    const id = incoming && /^[a-zA-Z0-9-]{1,128}$/.test(incoming)
      ? incoming
      : crypto.randomUUID();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  };
}
