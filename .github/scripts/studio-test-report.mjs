#!/usr/bin/env node
/**
 * Reports test progress back to the admin-studio Worker.
 *
 *   node studio-test-report.mjs running   → POST { status: 'running' }
 *   node studio-test-report.mjs finished  → parse vitest JSON + POST results
 *
 * Required env: RUN_ID, CALLBACK_URL, STUDIO_WEBHOOK_SECRET, GH_RUN_ID, GH_RUN_URL
 *
 * Body is HMAC-SHA256 signed; hex digest sent in `X-Studio-Signature`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const phase = process.argv[2] ?? 'running';
const RUN_ID = process.env.RUN_ID;
const CALLBACK_URL = process.env.CALLBACK_URL;
const SECRET = process.env.STUDIO_WEBHOOK_SECRET;
const GH_RUN_ID = process.env.GH_RUN_ID ?? '';
const GH_RUN_URL = process.env.GH_RUN_URL ?? '';

if (!RUN_ID || !CALLBACK_URL || !SECRET) {
  console.error('Missing RUN_ID / CALLBACK_URL / STUDIO_WEBHOOK_SECRET');
  process.exit(0); // soft-fail: we don't want to mark the workflow red over reporting
}

function sign(body) {
  return createHmac('sha256', SECRET).update(body).digest('hex');
}

async function send(payload) {
  const body = JSON.stringify(payload);
  const sig = sign(body);
  const res = await fetch(CALLBACK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Studio-Signature': sig,
    },
    body,
  });
  if (!res.ok) {
    console.error(`Webhook responded ${res.status}: ${await res.text()}`);
  }
}

function parseVitestJson(path) {
  if (!existsSync(path)) return { totals: zero(), results: [] };
  const raw = readFileSync(path, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { totals: zero(), results: [] };
  }
  const results = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const file of data.testResults ?? []) {
    const suite = file.name ?? 'unknown';
    for (const t of file.assertionResults ?? []) {
      const outcome =
        t.status === 'passed' ? 'passed' :
        t.status === 'failed' ? 'failed' :
        t.status === 'pending' ? 'skipped' :
        t.status === 'todo' ? 'todo' : 'skipped';
      if (outcome === 'passed') passed += 1;
      else if (outcome === 'failed') failed += 1;
      else skipped += 1;
      const id = `${suite}::${(t.ancestorTitles ?? []).concat(t.title).join(' > ')}`;
      results.push({
        id,
        suite,
        name: t.title ?? '',
        outcome,
        durationMs: Math.round(t.duration ?? 0),
        failure:
          outcome === 'failed'
            ? {
                message: (t.failureMessages ?? []).join('\n').slice(0, 4000),
              }
            : undefined,
      });
    }
  }
  const total = passed + failed + skipped;
  return { totals: { total, passed, failed, skipped }, results };
}

function zero() {
  return { total: 0, passed: 0, failed: 0, skipped: 0 };
}

const emittedAt = new Date().toISOString();

if (phase === 'running') {
  await send({
    runId: RUN_ID,
    ghRunId: GH_RUN_ID,
    ghRunUrl: GH_RUN_URL,
    status: 'running',
    emittedAt,
  });
} else if (phase === 'finished') {
  const { totals, results } = parseVitestJson('test-output/results.json');
  const status = totals.failed > 0 ? 'failed' : 'passed';
  await send({
    runId: RUN_ID,
    ghRunId: GH_RUN_ID,
    ghRunUrl: GH_RUN_URL,
    status,
    totals,
    results,
    emittedAt,
  });
}
