import { describe, it, expect } from 'vitest';
import type {
  TestEvent,
  TestResult,
  TestRun,
  TestRunStatus,
  TestWebhookPayload,
} from './test-runner.js';

describe('test-runner types', () => {
  it('TestRunStatus admits the lifecycle states', () => {
    const states: TestRunStatus[] = [
      'queued',
      'dispatched',
      'running',
      'passed',
      'failed',
      'cancelled',
      'timed-out',
    ];
    expect(states).toHaveLength(7);
  });

  it('TestEvent variants are discriminable by `type`', () => {
    const result: TestResult = {
      id: 'x::y',
      suite: 'x',
      name: 'y',
      outcome: 'failed',
      durationMs: 5,
      failure: { message: 'boom' },
    };
    const e1: TestEvent = { type: 'result', result };
    const e2: TestEvent = { type: 'totals', totals: { total: 1, passed: 0, failed: 1, skipped: 0 } };
    expect(e1.type).toBe('result');
    expect(e2.type).toBe('totals');
  });

  it('TestRun.totals shape matches what the UI renders', () => {
    const run: TestRun = {
      id: 'r1',
      dispatchedFromEnv: 'staging',
      suites: ['*'],
      status: 'running',
      startedAt: new Date().toISOString(),
      totals: { total: 10, passed: 7, failed: 1, skipped: 2 },
      dispatchedBy: 'op@factory',
    };
    expect(run.totals.passed + run.totals.failed + run.totals.skipped).toBeLessThanOrEqual(
      run.totals.total,
    );
  });

  it('TestWebhookPayload requires runId, ghRunId, status', () => {
    const w: TestWebhookPayload = {
      runId: 'r1',
      ghRunId: '123',
      ghRunUrl: 'https://github.com/foo/bar/actions/runs/123',
      status: 'passed',
      emittedAt: new Date().toISOString(),
    };
    expect(w.runId).toBe('r1');
    expect(w.status).toBe('passed');
  });
});
