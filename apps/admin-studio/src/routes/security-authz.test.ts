import { describe, expect, it } from 'vitest';
import worker from '../index.js';
import type { Env } from '../env.js';
import type { EnvJWTPayload, Role } from '@latimer-woods-tech/studio-core';

const executionContext = {} as ExecutionContext;

describe('admin-studio protected route authz', () => {
  it('returns 401 for protected route without bearer token', async () => {
    const res = await worker.fetch(
      new Request('https://admin-studio.example/me', { method: 'GET' }),
      buildEnv(),
      executionContext,
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: 'Missing bearer token' });
  });

  it('returns 401 for malformed bearer token', async () => {
    const res = await worker.fetch(
      new Request('https://admin-studio.example/me', {
        method: 'GET',
        headers: { Authorization: 'Bearer malformed.token' },
      }),
      buildEnv(),
      executionContext,
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: 'Invalid token' });
  });

  it('returns 403 for token with wrong environment claim', async () => {
    const token = await signToken('staging', 'owner');
    const res = await worker.fetch(
      new Request('https://admin-studio.example/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }),
      buildEnv({ STUDIO_ENV: 'production' }),
      executionContext,
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ error: 'Environment mismatch' });
  });

  it('enforces owner role for production deploys', async () => {
    const token = await signToken('production', 'admin');
    const res = await worker.fetch(
      new Request('https://admin-studio.example/deploys?dryRun=true', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ app: 'admin-studio' }),
      }),
      buildEnv({ STUDIO_ENV: 'production' }),
      executionContext,
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Production deploys require owner role' });
  });

  it('keeps smoke route protected by env-context auth middleware', async () => {
    const unauthenticated = await worker.fetch(
      new Request('https://admin-studio.example/smoke/unknown-app/R0VUOi9oZWFsdGg=', {
        method: 'POST',
      }),
      buildEnv(),
      executionContext,
    );
    expect(unauthenticated.status).toBe(401);

    const token = await signToken('production', 'owner');
    const authenticated = await worker.fetch(
      new Request('https://admin-studio.example/smoke/unknown-app/R0VUOi9oZWFsdGg=', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ env: 'production' }),
      }),
      buildEnv(),
      executionContext,
    );
    // Route-level validation now runs, proving auth middleware was passed.
    expect(authenticated.status).toBe(404);
    await expect(authenticated.json()).resolves.toMatchObject({ error: 'unknown app' });
  });
});

function buildEnv(overrides: Partial<Env> = {}): Env {
  return {
    STUDIO_ENV: 'production',
    ALLOWED_ORIGINS: 'https://admin-studio.example',
    DB: { connectionString: 'postgres://example' } as Env['DB'],
    JWT_SECRET: 'test-jwt-secret-with-enough-entropy',
    STUDIO_ADMIN_EMAIL: 'operator@example.com',
    STUDIO_ADMIN_PASSWORD_SHA256: 'f'.repeat(64),
    GITHUB_TOKEN: 'github-token',
    ANTHROPIC_API_KEY: 'anthropic-key',
    ...overrides,
  };
}

async function signToken(env: 'local' | 'staging' | 'production', role: Role): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: EnvJWTPayload = {
    iat: now,
    exp: now + 60 * 60,
    iss: 'factory-admin-studio',
    sub: 'operator@example.com',
    env,
    app: 'factory',
    sessionId: 'sess-security-test',
    userId: 'operator-1',
    userEmail: 'operator@example.com',
    role,
    envLockedAt: Date.now(),
  };
  return signJwt(payload, 'test-jwt-secret-with-enough-entropy');
}

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
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return `${headerB64}.${payloadB64}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}