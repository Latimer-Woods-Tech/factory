/**
 * JWT verification + envContext extraction middleware.
 *
 * Every authenticated route relies on this middleware. It:
 *   1. Reads the Authorization: Bearer header.
 *   2. Verifies the JWT signature using JWT_SECRET (Web Crypto, HS256).
 *   3. Validates the env claim matches STUDIO_ENV (cross-env attack prevention).
 *   4. Validates session age against env policy (4h prod, 24h other).
 *   5. Attaches the EnvContext to c.var.envContext.
 */
import type { Context, MiddlewareHandler, Next } from 'hono';
import type { AppEnv } from '../types.js';
import {
  type EnvContext,
  type EnvJWTPayload,
  isEnvironment,
  isRole,
  isSessionExpired,
} from '@adrper79-dot/studio-core';

/**
 * HS256 verification using Web Crypto only (Worker-safe — no `jsonwebtoken`).
 */
async function verifyJwt(token: string, secret: string): Promise<EnvJWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');
  const headerB64 = parts[0]!;
  const payloadB64 = parts[1]!;
  const signatureB64 = parts[2]!;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const sig = base64UrlToBytes(signatureB64);
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    sig as BufferSource,
    enc.encode(`${headerB64}.${payloadB64}`),
  );
  if (!ok) throw new Error('Invalid signature');

  const payloadJson = new TextDecoder().decode(base64UrlToBytes(payloadB64));
  const payload = JSON.parse(payloadJson) as EnvJWTPayload;

  if (payload.exp * 1000 < Date.now()) throw new Error('Token expired');
  if (!isEnvironment(payload.env)) throw new Error('Invalid env claim');
  if (!isRole(payload.role)) throw new Error('Invalid role claim');

  return payload;
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function envContextMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next: Next) => {
    const authHeader = c.req.header('Authorization');
    // EventSource cannot send custom headers, so SSE consumers may pass the
    // JWT as `?access_token=…` instead. Treat it as equivalent to Bearer.
    const queryToken = c.req.query('access_token');
    let token: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (queryToken) {
      token = queryToken;
    }
    if (!token) {
      return c.json({ error: 'Missing bearer token' }, 401);
    }

    let payload: EnvJWTPayload;
    try {
      payload = await verifyJwt(token, c.env.JWT_SECRET);
    } catch (err) {
      return c.json(
        { error: 'Invalid token', detail: (err as Error).message },
        401,
      );
    }

    // Cross-env attack prevention: a token issued for prod must never be
    // accepted by the staging worker, and vice versa.
    if (payload.env !== c.env.STUDIO_ENV) {
      return c.json(
        {
          error: 'Environment mismatch',
          tokenEnv: payload.env,
          workerEnv: c.env.STUDIO_ENV,
        },
        403,
      );
    }

    const ctx: EnvContext = {
      env: payload.env,
      app: payload.app,
      sessionId: payload.sessionId,
      userId: payload.userId,
      userEmail: payload.userEmail,
      role: payload.role,
      envLockedAt: payload.envLockedAt,
    };

    if (isSessionExpired(ctx)) {
      return c.json({ error: 'Session expired — re-authenticate' }, 401);
    }

    c.set('envContext', ctx);
    await next();
  };
}
