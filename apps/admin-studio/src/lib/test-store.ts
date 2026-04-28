/**
 * Persistence for `studio_test_runs` + `studio_test_results`.
 *
 * Same WeakMap-cached Drizzle client pattern as audit-store. Run state
 * is the source of truth for the SSE stream — webhook handler writes
 * here, SSE handler reads from here on subscribe.
 *
 * @see migrations/0004_studio_test_runs.sql
 */
import { createDb, sql, type FactoryDb, type HyperdriveBinding } from '@adrper79-dot/neon';
import type { TestResult, TestRun, TestRunStatus } from '@adrper79-dot/studio-core';

const dbCache = new WeakMap<HyperdriveBinding, FactoryDb>();

function getDb(hyperdrive: HyperdriveBinding): FactoryDb {
  let db = dbCache.get(hyperdrive);
  if (!db) {
    db = createDb(hyperdrive);
    dbCache.set(hyperdrive, db);
  }
  return db;
}

interface RunRow {
  id: string;
  dispatched_from_env: string;
  gh_run_id: string | null;
  gh_run_url: string | null;
  suites: unknown;
  filter: string | null;
  status: TestRunStatus;
  started_at: string;
  finished_at: string | null;
  totals: unknown;
  dispatched_by: string;
}

const ZERO_TOTALS: TestRun['totals'] = { total: 0, passed: 0, failed: 0, skipped: 0 };

function parseTotals(value: unknown): TestRun['totals'] {
  if (!value) return ZERO_TOTALS;
  if (typeof value === 'string') {
    try {
      return { ...ZERO_TOTALS, ...(JSON.parse(value) as Partial<TestRun['totals']>) };
    } catch {
      return ZERO_TOTALS;
    }
  }
  return { ...ZERO_TOTALS, ...(value as Partial<TestRun['totals']>) };
}

function parseSuites(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToRun(row: RunRow): TestRun {
  return {
    id: row.id,
    dispatchedFromEnv: row.dispatched_from_env,
    ghRunId: row.gh_run_id ?? undefined,
    ghRunUrl: row.gh_run_url ?? undefined,
    suites: parseSuites(row.suites),
    filter: row.filter ?? undefined,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    totals: parseTotals(row.totals),
    dispatchedBy: row.dispatched_by,
  };
}

export async function insertTestRun(
  hyperdrive: HyperdriveBinding,
  run: TestRun,
): Promise<void> {
  const db = getDb(hyperdrive);
  await db.execute(sql`
    INSERT INTO studio_test_runs (
      id, dispatched_from_env, suites, filter, status, started_at, totals, dispatched_by
    ) VALUES (
      ${run.id},
      ${run.dispatchedFromEnv},
      ${JSON.stringify(run.suites)}::jsonb,
      ${run.filter ?? null},
      ${run.status},
      ${run.startedAt},
      ${JSON.stringify(run.totals)}::jsonb,
      ${run.dispatchedBy}
    )
  `);
}

export async function getTestRun(
  hyperdrive: HyperdriveBinding,
  runId: string,
): Promise<TestRun | null> {
  const db = getDb(hyperdrive);
  const result = await db.execute(sql`
    SELECT id, dispatched_from_env, gh_run_id, gh_run_url, suites, filter,
           status, started_at, finished_at, totals, dispatched_by
    FROM studio_test_runs
    WHERE id = ${runId}
  `);
  const rows = (result as unknown as RunRow[]) ?? [];
  if (rows.length === 0) return null;
  return rowToRun(rows[0]!);
}

export async function listTestRuns(
  hyperdrive: HyperdriveBinding,
  opts: { dispatchedBy?: string; limit?: number },
): Promise<TestRun[]> {
  const db = getDb(hyperdrive);
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50));
  const result = opts.dispatchedBy
    ? await db.execute(sql`
        SELECT id, dispatched_from_env, gh_run_id, gh_run_url, suites, filter,
               status, started_at, finished_at, totals, dispatched_by
        FROM studio_test_runs
        WHERE dispatched_by = ${opts.dispatchedBy}
        ORDER BY started_at DESC
        LIMIT ${limit}
      `)
    : await db.execute(sql`
        SELECT id, dispatched_from_env, gh_run_id, gh_run_url, suites, filter,
               status, started_at, finished_at, totals, dispatched_by
        FROM studio_test_runs
        ORDER BY started_at DESC
        LIMIT ${limit}
      `);
  const rows = (result as unknown as RunRow[]) ?? [];
  return rows.map(rowToRun);
}

export async function updateTestRunStatus(
  hyperdrive: HyperdriveBinding,
  runId: string,
  patch: {
    status?: TestRunStatus;
    ghRunId?: string;
    ghRunUrl?: string;
    totals?: TestRun['totals'];
    finishedAt?: string;
  },
): Promise<void> {
  const db = getDb(hyperdrive);
  // We use one statement per non-undefined field to avoid building dynamic SQL.
  // Each is short and runs against an indexed PK, so the cost is negligible.
  if (patch.status !== undefined) {
    await db.execute(sql`UPDATE studio_test_runs SET status = ${patch.status} WHERE id = ${runId}`);
  }
  if (patch.ghRunId !== undefined) {
    await db.execute(sql`UPDATE studio_test_runs SET gh_run_id = ${patch.ghRunId} WHERE id = ${runId}`);
  }
  if (patch.ghRunUrl !== undefined) {
    await db.execute(sql`UPDATE studio_test_runs SET gh_run_url = ${patch.ghRunUrl} WHERE id = ${runId}`);
  }
  if (patch.totals !== undefined) {
    await db.execute(sql`
      UPDATE studio_test_runs
      SET totals = ${JSON.stringify(patch.totals)}::jsonb
      WHERE id = ${runId}
    `);
  }
  if (patch.finishedAt !== undefined) {
    await db.execute(sql`
      UPDATE studio_test_runs SET finished_at = ${patch.finishedAt} WHERE id = ${runId}
    `);
  }
}

interface ResultRow {
  test_id: string;
  suite: string;
  name: string;
  outcome: TestResult['outcome'];
  duration_ms: number;
  failure: unknown;
}

function parseFailure(value: unknown): TestResult['failure'] | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as TestResult['failure'];
    } catch {
      return undefined;
    }
  }
  return value as TestResult['failure'];
}

export async function upsertTestResults(
  hyperdrive: HyperdriveBinding,
  runId: string,
  results: readonly TestResult[],
): Promise<void> {
  if (results.length === 0) return;
  const db = getDb(hyperdrive);
  for (const r of results) {
    await db.execute(sql`
      INSERT INTO studio_test_results (run_id, test_id, suite, name, outcome, duration_ms, failure)
      VALUES (
        ${runId},
        ${r.id},
        ${r.suite},
        ${r.name},
        ${r.outcome},
        ${r.durationMs},
        ${r.failure ? JSON.stringify(r.failure) : null}::jsonb
      )
      ON CONFLICT (run_id, test_id) DO UPDATE
      SET outcome     = EXCLUDED.outcome,
          duration_ms = EXCLUDED.duration_ms,
          failure     = EXCLUDED.failure,
          recorded_at = now()
    `);
  }
}

export async function listTestResults(
  hyperdrive: HyperdriveBinding,
  runId: string,
): Promise<TestResult[]> {
  const db = getDb(hyperdrive);
  const result = await db.execute(sql`
    SELECT test_id, suite, name, outcome, duration_ms, failure
    FROM studio_test_results
    WHERE run_id = ${runId}
    ORDER BY suite ASC, name ASC
  `);
  const rows = (result as unknown as ResultRow[]) ?? [];
  return rows.map((r) => ({
    id: r.test_id,
    suite: r.suite,
    name: r.name,
    outcome: r.outcome,
    durationMs: r.duration_ms,
    failure: parseFailure(r.failure),
  }));
}
