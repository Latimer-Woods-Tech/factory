// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api.js';
import { useSession } from '../stores/session.js';

describe('apiFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    useSession.getState().logout();
  });

  it('logs out on 401 responses', async () => {
    useSession.getState().login('header.payload.signature', 'production', Date.now() + 60_000);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 })),
    );

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 });
    expect(useSession.getState().token).toBeNull();
  });

  it('logs out on 403 environment mismatch responses', async () => {
    useSession.getState().login('header.payload.signature', 'production', Date.now() + 60_000);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Environment mismatch', tokenEnv: 'staging' }), {
          status: 403,
        })),
    );

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 403 });
    expect(useSession.getState().token).toBeNull();
  });

  it('keeps the session for non-session 403 responses', async () => {
    useSession.getState().login('header.payload.signature', 'production', Date.now() + 60_000);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
    );

    await expect(apiFetch('/repo/commit')).rejects.toMatchObject({ status: 403 });
    expect(useSession.getState().token).toBe('header.payload.signature');
  });
});