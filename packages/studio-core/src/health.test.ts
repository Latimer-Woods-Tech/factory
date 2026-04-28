import { describe, it, expect } from 'vitest';
import type { AppHealth, AppHealthStatus, AuditQuery } from './health.js';

describe('health types', () => {
  it('AppHealth carries an env-tagged status', () => {
    const sample: AppHealth = {
      id: 'prime-self',
      label: 'Prime Self',
      env: 'staging',
      url: 'https://prime-self.adrper79.workers.dev/health',
      status: 'healthy',
      httpStatus: 200,
      latencyMs: 42,
      checkedAt: new Date().toISOString(),
      reportedEnv: 'staging',
      reportedService: 'prime-self',
    };
    expect(sample.env).toBe('staging');
    expect(sample.status).toBe('healthy');
  });

  it('AppHealthStatus discriminates the four cases', () => {
    const all: AppHealthStatus[] = ['healthy', 'degraded', 'down', 'unknown'];
    expect(all).toHaveLength(4);
  });

  it('AuditQuery accepts cursor-based pagination', () => {
    const q: AuditQuery = { limit: 50, cursor: '2026-04-28T00:00:00Z' };
    expect(q.limit).toBe(50);
  });
});
