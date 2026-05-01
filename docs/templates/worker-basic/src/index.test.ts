import { describe, it, expect } from 'vitest';
import worker from './index.js';
import type { Env } from './index.js';

const env: Env = {
  ENVIRONMENT: 'test',
};

describe('worker routes', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await worker.fetch(new Request('https://worker.test/health'), env);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      status: 'ok',
      worker: 'WORKER_NAME',
      environment: 'test',
    });
  });

  it('GET /manifest returns manifestVersion 1 with entries', async () => {
    const res = await worker.fetch(new Request('https://worker.test/manifest'), env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      manifestVersion: number;
      app: string;
      entries: Array<{ path: string }>;
    };
    expect(body.manifestVersion).toBe(1);
    expect(body.app).toBe('WORKER_NAME');
    expect(body.entries.some((e) => e.path === '/health')).toBe(true);
  });

  it('unknown routes return 404', async () => {
    const res = await worker.fetch(new Request('https://worker.test/not-a-route'), env);
    expect(res.status).toBe(404);
  });
});
