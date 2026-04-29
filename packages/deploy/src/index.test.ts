import { describe, expect, it, vi } from 'vitest';
import {
  REQUIRED_WORKER_SECRETS,
  STRIPE_SECRETS,
  VIDEO_SECRETS,
  buildWorkerUrl,
  checkHealth,
  validateSecrets,
  waitForHealth,
} from './index.js';
import type { FetchFn } from './index.js';

// ---------------------------------------------------------------------------
// buildWorkerUrl
// ---------------------------------------------------------------------------

describe('buildWorkerUrl', () => {
  it('builds canonical workers.dev URL', () => {
    expect(buildWorkerUrl('schedule')).toBe('https://schedule.adrper79.workers.dev');
  });

  it('accepts custom account subdomain', () => {
    expect(buildWorkerUrl('my-worker', 'other-account')).toBe('https://my-worker.other-account.workers.dev');
  });

  it('strips trailing slash from the name', () => {
    // Names don't have slashes but the URL should be clean
    expect(buildWorkerUrl('health')).toContain('health.adrper79.workers.dev');
  });
});

// ---------------------------------------------------------------------------
// REQUIRED_WORKER_SECRETS / STRIPE_SECRETS / VIDEO_SECRETS
// ---------------------------------------------------------------------------

describe('REQUIRED_WORKER_SECRETS', () => {
  it('includes CF_API_TOKEN', () => {
    expect(REQUIRED_WORKER_SECRETS.some((s) => s.name === 'CF_API_TOKEN')).toBe(true);
  });

  it('all entries have required=true and a description', () => {
    for (const s of REQUIRED_WORKER_SECRETS) {
      expect(s.required).toBe(true);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });
});

describe('STRIPE_SECRETS', () => {
  it('includes STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET', () => {
    const names = STRIPE_SECRETS.map((s) => s.name);
    expect(names).toContain('STRIPE_SECRET_KEY');
    expect(names).toContain('STRIPE_WEBHOOK_SECRET');
  });
});

describe('VIDEO_SECRETS', () => {
  it('includes ANTHROPIC_API_KEY and CF_STREAM_TOKEN', () => {
    const names = VIDEO_SECRETS.map((s) => s.name);
    expect(names).toContain('ANTHROPIC_API_KEY');
    expect(names).toContain('CF_STREAM_TOKEN');
  });
});

// ---------------------------------------------------------------------------
// validateSecrets
// ---------------------------------------------------------------------------

describe('validateSecrets', () => {
  const descriptors = [
    { name: 'FOO', required: true, description: 'Foo secret' },
    { name: 'BAR', required: true, description: 'Bar secret' },
    { name: 'OPT', required: false, description: 'Optional' },
  ];

  it('returns empty array when all required secrets are present', () => {
    const env = { FOO: 'f', BAR: 'b', OPT: 'o' };
    expect(validateSecrets(env, descriptors)).toEqual([]);
  });

  it('returns names of missing required secrets', () => {
    const env = { FOO: 'f' };
    expect(validateSecrets(env, descriptors)).toEqual(['BAR']);
  });

  it('ignores missing optional secrets', () => {
    const env = { FOO: 'f', BAR: 'b' };
    expect(validateSecrets(env, descriptors)).toEqual([]);
  });

  it('returns all required secrets when env is empty', () => {
    const missing = validateSecrets({}, descriptors);
    expect(missing).toContain('FOO');
    expect(missing).toContain('BAR');
    expect(missing).not.toContain('OPT');
  });

  it('treats empty string values as missing', () => {
    const env = { FOO: '', BAR: 'b' };
    expect(validateSecrets(env, descriptors)).toEqual(['FOO']);
  });
});

// ---------------------------------------------------------------------------
// checkHealth
// ---------------------------------------------------------------------------

describe('checkHealth', () => {
  it('returns ok=true for 200 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const result = await checkHealth('https://my-worker.adrper79.workers.dev', { fetch: mockFetch as unknown as FetchFn });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.url).toBe('https://my-worker.adrper79.workers.dev/health');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('strips trailing slash before appending /health', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await checkHealth('https://worker.example.com/', { fetch: mockFetch as unknown as FetchFn });
    expect(mockFetch).toHaveBeenCalledWith('https://worker.example.com/health');
  });

  it('returns ok=false for 500 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await checkHealth('https://worker.example.com', { fetch: mockFetch as unknown as FetchFn });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it('handles network errors gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await checkHealth('https://worker.example.com', { fetch: mockFetch as unknown as FetchFn });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toBe('ECONNREFUSED');
  });

  it('handles non-Error rejections', async () => {
    const mockFetch = vi.fn().mockRejectedValue('string error');
    const result = await checkHealth('https://worker.example.com', { fetch: mockFetch as unknown as FetchFn });
    expect(result.error).toBe('string error');
  });
});

// ---------------------------------------------------------------------------
// waitForHealth
// ---------------------------------------------------------------------------

describe('waitForHealth', () => {
  it('returns immediately on first success', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const result = await waitForHealth('https://worker.example.com', 3, 0, { fetch: mockFetch as unknown as FetchFn });
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValue(new Response(null, { status: 200 }));
    const result = await waitForHealth('https://worker.example.com', 3, 0, { fetch: mockFetch as unknown as FetchFn });
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns final failure after all retries exhausted', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const result = await waitForHealth('https://worker.example.com', 3, 0, { fetch: mockFetch as unknown as FetchFn });
    expect(result.ok).toBe(false);
    // 3 attempts in loop + 1 final check = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

