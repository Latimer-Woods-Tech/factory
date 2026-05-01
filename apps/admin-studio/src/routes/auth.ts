import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import { isEnvironment, isRole, type EnvJWTPayload } from '@latimer-woods-tech/studio-core';

const auth = new Hono<AppEnv>();

interface LoginRequest {
  email?: unknown;
  password?: unknown;
  env?: unknown;
  app?: unknown;
}

/**
 * POST /auth/login
 *
 * Body: { email, password, env, app? }
 *
 * Returns a JWT carrying the env claim. The client must pick env *before*
 * authenticating — Studio refuses to issue a token without it.
 *
 * Phase A: bootstrap credentials check against Worker secrets. Phase B replaces
 * this with `studio_users` and per-user password hashes / session controls.
 */
auth.post('/login', async (c) => {
  const body = await c.req.json<LoginRequest>();

  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
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

  if (!c.env.STUDIO_ADMIN_EMAIL || !c.env.STUDIO_ADMIN_PASSWORD_SHA256) {
    return c.json({ error: 'Studio bootstrap credentials are not configured' }, 503);
  }

  const email = body.email.trim().toLowerCase();
  const configuredEmail = c.env.STUDIO_ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await sha256Hex(body.password);
  const configuredPasswordHash = c.env.STUDIO_ADMIN_PASSWORD_SHA256.trim().toLowerCase();
  const validCredentials = email === configuredEmail
    && constantTimeEqualHex(passwordHash, configuredPasswordHash);

  if (!validCredentials) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

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
    sub: email,
    env: body.env,
    app: typeof body.app === 'string' ? body.app : undefined,
    sessionId: crypto.randomUUID(),
    userId: email, // bootstrap: email-as-id; replace with UUID in Phase B
    userEmail: email,
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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqualHex(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    return false;
  }

  let diff = actual.length ^ expected.length;
  const maxLength = Math.max(actual.length, expected.length);
  for (let i = 0; i < maxLength; i++) {
    const actualCode = actual.charCodeAt(i) || 0;
    const expectedCode = expected.charCodeAt(i) || 0;
    diff |= actualCode ^ expectedCode;
  }
  return diff === 0;
}
