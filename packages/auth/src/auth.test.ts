import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import {
  issueToken,
  jwtMiddleware,
  refreshToken,
  requireRole,
  verifyToken,
} from './index';

const secret = 'super-secret';
const basePayload = {
  sub: 'user-1',
  tenantId: 'tenant-1',
  role: 'admin' as const,
};

describe('auth', () => {
  it('issueToken returns a JWT string with three segments', async () => {
    const token = await issueToken(basePayload, secret);

    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyToken succeeds for a valid token', async () => {
    const token = await issueToken(basePayload, secret);
    const payload = await verifyToken(token, secret);

    expect(payload.sub).toBe('user-1');
    expect(payload.tenantId).toBe('tenant-1');
    expect(payload.role).toBe('admin');
  });

  it('verifyToken rejects expired, invalid, and tampered tokens', async () => {
    const expiredToken = await issueToken(basePayload, secret, -1);
    await expect(verifyToken(expiredToken, secret)).rejects.toThrow('Token expired');

    await expect(verifyToken('invalid-token', secret)).rejects.toThrow(
      'Invalid token format',
    );

    const token = await issueToken(basePayload, secret);
    const parts = token.split('.');
    const tamperedPayload = parts[1];
    if (!tamperedPayload) {
      throw new Error('Expected JWT payload segment');
    }
    parts[1] = tamperedPayload.replace(/.$/u, 'A');

    await expect(verifyToken(parts.join('.'), secret)).rejects.toThrow(
      'Invalid token signature',
    );
  });

  it('refreshToken returns a new token with a later expiry', async () => {
    const token = await issueToken(basePayload, secret, 60);
    const original = await verifyToken(token, secret);
    const refreshed = await refreshToken(token, secret, 3600);
    const refreshedPayload = await verifyToken(refreshed, secret);

    expect(refreshed).not.toBe(token);
    expect(refreshedPayload.exp).toBeGreaterThan(original.exp);
  });

  it('jwtMiddleware allows valid tokens and returns 401 for missing or invalid tokens', async () => {
    const validToken = await issueToken(basePayload, secret);
    const app = new Hono();

    app.use('*', jwtMiddleware(secret));
    app.get('/', (c) => c.json({ user: c.get('user') }));

    const okResponse = await app.request('/', {
      headers: { authorization: `Bearer ${validToken}` },
    });
    expect(okResponse.status).toBe(200);

    const missingResponse = await app.request('/');
    expect(missingResponse.status).toBe(401);

    const invalidResponse = await app.request('/', {
      headers: { authorization: 'Bearer nope' },
    });
    expect(invalidResponse.status).toBe(401);
  });

  it('requireRole respects the role hierarchy', async () => {
    const ownerToken = await issueToken({ ...basePayload, role: 'owner' }, secret);
    const viewerToken = await issueToken({ ...basePayload, role: 'viewer' }, secret);
    const app = new Hono();

    app.use('*', jwtMiddleware(secret));
    app.use('*', requireRole('admin'));
    app.get('/', (c) => c.json({ user: c.get('user').role }));

    const ownerResponse = await app.request('/', {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(ownerResponse.status).toBe(200);

    const viewerResponse = await app.request('/', {
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(viewerResponse.status).toBe(403);
  });
});
