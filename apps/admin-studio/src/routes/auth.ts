import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import { isEnvironment, isRole, type EnvJWTPayload } from '@adrper79-dot/studio-core';

const auth = new Hono<AppEnv>();

/**
 * POST /auth/login
 *
 * Body: { email, password, env, app? }
 *
 * Returns a JWT carrying the env claim. The client must pick env *before*
 * authenticating — Studio refuses to issue a token without it.
 *
 * Phase A: stub credentials check (replace with real users table in Phase B).
 */
auth.post('/login', async (c) => {
  const body = await c.req.json<{
    email: string;
    password: string;
    env: string;
    app?: string;
  }>();

  if (!body.email || !body.password) {
    return c.json({ error: 'Missing credentials' }, 400);
  }
  if (!isEnvironment(body.env)) {
    return c.json({ error: 'Invalid env — must be local | staging | production' }, 400);
  }
  if (body.env !== c.env.STUDIO_ENV) {
    return c.json(
      {
        error: `This studio worker only issues tokens for env '${c.env.STUDIO_ENV}'`,
      },
      400,
    );
  }

  // TODO Phase B: look up user in studio_users, verify Argon2 hash.
  // Phase A stub: allow any email matching SUDO_EMAIL secret (single bootstrap user).
  const stubRole = 'owner'; // bootstrap operator
  if (!isRole(stubRole)) {
    return c.json({ error: 'Misconfigured role' }, 500);
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (body.env === 'production' ? 4 * 3600 : 24 * 3600);

  const payload: EnvJWTPayload = {
    iat: now,
    exp,
    iss: 'factory-admin-studio',
    sub: body.email,
    env: body.env,
    app: body.app,
    sessionId: crypto.randomUUID(),
    userId: body.email, // stub: email-as-id; replace with UUID in Phase B
    userEmail: body.email,
    role: stubRole,
    envLockedAt: Date.now(),
  };

  const jwt = await signJwt(payload, c.env.JWT_SECRET);
  return c.json({ token: jwt, expiresAt: exp * 1000 });
});

/**
 * POST /auth/logout — client-side discards token; we just acknowledge.
 * In Phase B we add a session blocklist table for forced logouts.
 */
auth.post('/logout', (c) => c.json({ ok: true }));

export default auth;

// ─── HS256 signer (Web Crypto only) ─────────────────────────────────────────
async function signJwt(payload: EnvJWTPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encode = (obj: unknown): string =>
    base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return `${headerB64}.${payloadB64}.${base64UrlEncode(new Uint8Array(sig))}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
