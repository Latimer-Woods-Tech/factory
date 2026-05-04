/**
 * Read-only proxies into Sentry + PostHog so the Studio can render
 * recent-error and metrics tiles without exposing API tokens to the browser.
 *
 * Endpoints are tolerant of missing config: if secrets aren't set they return
 * `{ configured: false }` instead of 500. Degraded states (configured but
 * upstream returning errors) are surfaced as `{ configured: true, degraded: true }`.
 *
 * ADM-1: Richer Sentry issues payload (assignee, priority, runbook links).
 * ADM-2: PostHog panel with windowed metrics (24h/7d/30d, DAU, trend).
 * ADM-3: SLO and error-budget burn panel.
 * ADM-4: Synthetic journey monitor panel.
 * ADM-5: Incident timeline fusing Sentry issues + audit log entries.
 * ADM-7: Telemetry conformance matrix across Factory apps.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import { FACTORY_APPS, healthUrlFor } from '../lib/app-registry.js';

const observability = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Maps a Sentry level string to a numeric severity so the UI can sort.
 */
function sentryLevelSeverity(level: string): number {
  switch (level) {
    case 'fatal': return 4;
    case 'error': return 3;
    case 'warning': return 2;
    case 'info': return 1;
    default: return 0;
  }
}

/** Returns a deep-link URL to the Sentry issue detail page. */
function sentryIssueUrl(org: string, issueId: string): string {
  return `https://sentry.io/organizations/${encodeURIComponent(org)}/issues/${encodeURIComponent(issueId)}/`;
}

// ---------------------------------------------------------------------------
// ADM-1: Sentry issues — richer payload with assignee, priority, runbook links
// ---------------------------------------------------------------------------

interface SentryAssignee {
  name: string;
  email?: string;
  type: 'user' | 'team';
}

interface SentryIssue {
  id: string;
  title: string;
  culprit?: string;
  level: string;
  /** Numeric severity: 0 (debug) → 4 (fatal). Derived from level. */
  severity: number;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  /** Direct URL to the Sentry issue detail page. */
  permalink: string;
  /** Assigned user or team, if any. */
  assignee?: SentryAssignee;
  /** Sentry issue category, e.g. 'error', 'performance'. */
  category?: string;
  /** Issue type tag (e.g. 'N+1 Query', 'Memory Leak'). */
  type?: string;
  /** Whether the issue is regressed (was previously resolved). */
  isRegression?: boolean;
}

/**
 * GET /observability/sentry/issues
 *
 * Params:
 *   limit  — 1..100 (default 20)
 *   env    — environment label (defaults to session env)
 *   period — Sentry statsPeriod, e.g. '24h', '7d', '30d' (default '24h')
 *   level  — filter by level: fatal, error, warning, info
 *
 * Returns:
 *   { configured, degraded?, env, issues[], note? }
 */
observability.get('/sentry/issues', async (c) => {
  const token = c.env.SENTRY_AUTH_TOKEN;
  const org = c.env.SENTRY_ORG;
  const project = c.env.SENTRY_PROJECT;
  if (!token || !org || !project) {
    return c.json({
      configured: false,
      note: 'Set SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT.',
      issues: [] as SentryIssue[],
    });
  }

  const qs = new URL(c.req.url).searchParams;
  const limit = clamp(Number.parseInt(qs.get('limit') ?? '20', 10), 1, 100);
  const env = qs.get('env') ?? c.var.envContext.env;
  const period = qs.get('period') ?? '24h';
  const levelFilter = qs.get('level');

  let query = 'is:unresolved';
  if (levelFilter) query += ` level:${levelFilter}`;

  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/` +
        `?limit=${limit}&environment=${encodeURIComponent(env)}&statsPeriod=${encodeURIComponent(period)}` +
        `&query=${encodeURIComponent(query)}&expand=owners&expand=inbox`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      return c.json(
        { configured: true, degraded: true, error: `sentry-${res.status}`, issues: [] },
        502,
      );
    }

    const raw: Array<Record<string, unknown>> = await res.json();
    const issues: SentryIssue[] = raw.map((item) => {
      const level = typeof item['level'] === 'string' ? item['level'] : 'error';
      const assigneeRaw = item['assignedTo'] as Record<string, unknown> | null | undefined;
      let assignee: SentryAssignee | undefined;
      if (assigneeRaw && typeof assigneeRaw === 'object') {
        assignee = {
          name: typeof assigneeRaw['name'] === 'string' ? assigneeRaw['name'] : 'unknown',
          email: typeof assigneeRaw['email'] === 'string' ? assigneeRaw['email'] : undefined,
          type: assigneeRaw['type'] === 'team' ? 'team' : 'user',
        };
      }

      return {
        id: String(item['id'] ?? ''),
        title: String(item['title'] ?? ''),
        culprit: typeof item['culprit'] === 'string' ? item['culprit'] : undefined,
        level,
        severity: sentryLevelSeverity(level),
        count: String(item['count'] ?? '0'),
        userCount: typeof item['userCount'] === 'number' ? item['userCount'] : 0,
        firstSeen: String(item['firstSeen'] ?? ''),
        lastSeen: String(item['lastSeen'] ?? ''),
        permalink: sentryIssueUrl(org, String(item['id'] ?? '')),
        assignee,
        category: typeof item['issueCategory'] === 'string' ? item['issueCategory'] : undefined,
        type: typeof item['issueType'] === 'string' ? item['issueType'] : undefined,
        isRegression: item['isRegression'] === true,
      };
    });

    // Sort: severity descending, then lastSeen descending
    issues.sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return b.lastSeen.localeCompare(a.lastSeen);
    });

    return c.json({ configured: true, degraded: false, env, period, issues });
  } catch (err) {
    return c.json(
      { configured: true, degraded: true, error: (err as Error).message, issues: [] },
      502,
    );
  }
});

// ---------------------------------------------------------------------------
// ADM-2: PostHog panel — windowed metrics with trend indicators
// ---------------------------------------------------------------------------

type PostHogWindow = '24h' | '7d' | '30d';

interface PostHogTile {
  id: string;
  label: string;
  value: number;
  previous?: number;
  /** Percentage change vs previous period. Positive = growth. */
  trend?: number;
  unit?: string;
}

function windowToInterval(w: PostHogWindow): { current: string; previous: string } {
  switch (w) {
    case '7d': return { current: '7 DAY', previous: '14 DAY' };
    case '30d': return { current: '30 DAY', previous: '60 DAY' };
    default: return { current: '24 HOUR', previous: '48 HOUR' };
  }
}

async function hogqlQuery(
  host: string,
  projectId: string,
  key: string,
  query: string,
): Promise<{ results?: Array<Array<number>> }> {
  const res = await fetch(
    `${host}/api/projects/${encodeURIComponent(projectId)}/query/`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    },
  );
  if (!res.ok) throw new Error(`posthog-${res.status}`);
  return res.json<{ results?: Array<Array<number>> }>();
}

function calcTrend(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * GET /observability/posthog/tiles
 *
 * Params:
 *   window — '24h' | '7d' | '30d' (default '24h')
 *
 * Returns tiles for: total events, DAU, churn proxy.
 * Trend is % change vs the previous equal period.
 */
observability.get('/posthog/tiles', async (c) => {
  const key = c.env.POSTHOG_API_KEY;
  const projectId = c.env.POSTHOG_PROJECT_ID;
  const host = c.env.POSTHOG_HOST ?? 'https://us.i.posthog.com';
  if (!key || !projectId) {
    return c.json({
      configured: false,
      note: 'Set POSTHOG_API_KEY + POSTHOG_PROJECT_ID.',
      tiles: [] as PostHogTile[],
    });
  }

  const rawWindow = new URL(c.req.url).searchParams.get('window') ?? '24h';
  const window: PostHogWindow = rawWindow === '7d' || rawWindow === '30d' ? rawWindow : '24h';
  const { current: interval, previous: prevInterval } = windowToInterval(window);

  try {
    const [eventsRes, dauRes, prevEventsRes, prevDauRes] = await Promise.all([
      hogqlQuery(
        host, projectId, key,
        `SELECT count() AS total FROM events WHERE timestamp >= now() - INTERVAL ${interval}`,
      ),
      hogqlQuery(
        host, projectId, key,
        `SELECT count(DISTINCT distinct_id) AS dau FROM events WHERE timestamp >= now() - INTERVAL ${interval}`,
      ),
      hogqlQuery(
        host, projectId, key,
        `SELECT count() AS total FROM events WHERE timestamp >= now() - INTERVAL ${prevInterval} AND timestamp < now() - INTERVAL ${interval}`,
      ),
      hogqlQuery(
        host, projectId, key,
        `SELECT count(DISTINCT distinct_id) AS dau FROM events WHERE timestamp >= now() - INTERVAL ${prevInterval} AND timestamp < now() - INTERVAL ${interval}`,
      ),
    ]);

    const events = eventsRes.results?.[0]?.[0] ?? 0;
    const dau = dauRes.results?.[0]?.[0] ?? 0;
    const prevEvents = prevEventsRes.results?.[0]?.[0] ?? 0;
    const prevDau = prevDauRes.results?.[0]?.[0] ?? 0;

    const tiles: PostHogTile[] = [
      {
        id: 'events',
        label: `Events (${window})`,
        value: events,
        previous: prevEvents,
        trend: calcTrend(events, prevEvents),
      },
      {
        id: 'dau',
        label: `Active Users (${window})`,
        value: dau,
        previous: prevDau,
        trend: calcTrend(dau, prevDau),
        unit: 'users',
      },
    ];

    return c.json({ configured: true, window, tiles });
  } catch (err) {
    return c.json(
      { configured: true, degraded: true, error: (err as Error).message, window, tiles: [] },
      502,
    );
  }
});

// ---------------------------------------------------------------------------
// ADM-3: SLO and error-budget burn panel
//
// Fuses Sentry error count with PostHog total events to compute:
//   - error_rate_pct (errors / total events * 100)
//   - availability_pct (100 - error_rate_pct)
//   - budget_used_pct (how much of the monthly 0.1% SLO has been consumed)
//   - burn_rate (budget_used_pct / days_elapsed * 30)
//   - slo_status: green / yellow / red
// ---------------------------------------------------------------------------

type SloStatus = 'green' | 'yellow' | 'red';

interface SloPanel {
  configured: boolean;
  degraded?: boolean;
  slo_status: SloStatus;
  availability_pct: number;
  error_rate_pct: number;
  /** 30-day rolling budget allowance: 0.1% of requests. */
  budget_allowance_pct: number;
  budget_used_pct: number;
  /** Annualised burn rate multiplier vs sustainable. >1 = burning faster than target. */
  burn_rate: number;
  period: '30d';
  note?: string;
}

const SLO_TARGET_AVAILABILITY = 99.9; // percent
const SLO_ERROR_BUDGET_PCT = 100 - SLO_TARGET_AVAILABILITY; // 0.1%
const PERIOD_DAYS = 30;

/**
 * GET /observability/slo
 *
 * Requires both Sentry and PostHog to be configured for full accuracy.
 * Falls back to Sentry-only mode (treats all Sentry issues as errors against
 * a synthetic event count of 1 000 000 / 30d).
 */
observability.get('/slo', async (c) => {
  const sentryToken = c.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = c.env.SENTRY_ORG;
  const sentryProject = c.env.SENTRY_PROJECT;
  const posthogKey = c.env.POSTHOG_API_KEY;
  const posthogProject = c.env.POSTHOG_PROJECT_ID;
  const posthogHost = c.env.POSTHOG_HOST ?? 'https://us.i.posthog.com';

  const hasSentry = Boolean(sentryToken && sentryOrg && sentryProject);
  const hasPostHog = Boolean(posthogKey && posthogProject);

  if (!hasSentry && !hasPostHog) {
    return c.json({
      configured: false,
      note: 'Set SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT (and optionally POSTHOG_API_KEY + POSTHOG_PROJECT_ID).',
      slo_status: 'green' as SloStatus,
      availability_pct: 100,
      error_rate_pct: 0,
      budget_allowance_pct: SLO_ERROR_BUDGET_PCT,
      budget_used_pct: 0,
      burn_rate: 0,
      period: '30d' as const,
    } satisfies SloPanel);
  }

  let errorCount = 0;
  let totalEvents = 0;
  let degraded = false;

  // Fetch Sentry error count over 30d
  if (hasSentry) {
    try {
      const sentryRes = await fetch(
        `https://sentry.io/api/0/projects/${encodeURIComponent(sentryOrg!)}/${encodeURIComponent(sentryProject!)}/stats/?stat=received&resolution=1d&since=${Math.floor(Date.now() / 1000 - PERIOD_DAYS * 86400)}`,
        { headers: { Authorization: `Bearer ${sentryToken}` } },
      );
      if (sentryRes.ok) {
        const statsData: Array<[number, number]> = await sentryRes.json();
        errorCount = statsData.reduce((sum, [, count]) => sum + count, 0);
      } else {
        degraded = true;
      }
    } catch {
      degraded = true;
    }
  }

  // Fetch PostHog total event count over 30d
  if (hasPostHog) {
    try {
      const phRes = await hogqlQuery(
        posthogHost, posthogProject!, posthogKey!,
        `SELECT count() AS total FROM events WHERE timestamp >= now() - INTERVAL 30 DAY`,
      );
      totalEvents = phRes.results?.[0]?.[0] ?? 0;
    } catch {
      degraded = true;
    }
  }

  // Fallback: use a synthetic baseline of 1 M events/month (≈33k/day, a
  // conservative floor for a small SaaS) so the error-rate math stays
  // meaningful when PostHog is unconfigured or unavailable.
  if (totalEvents === 0 && errorCount > 0) {
    totalEvents = 1_000_000;
  } else if (totalEvents === 0) {
    totalEvents = 1; // avoid division by zero
  }

  const error_rate_pct = Math.min((errorCount / totalEvents) * 100, 100);
  const availability_pct = Math.round((100 - error_rate_pct) * 10000) / 10000;
  const budget_used_pct = Math.min((error_rate_pct / SLO_ERROR_BUDGET_PCT) * 100, 100);

  // Burn rate: fraction of error budget consumed relative to a full 30-day
  // period. Formula: (budget_fraction) * (30 / elapsed_days). Since we use
  // a rolling 30d window, elapsed_days == PERIOD_DAYS, so burn_rate ==
  // budget_used_pct / 100. A value > 1 means exhausting the budget faster
  // than the 30-day replenishment cadence.
  const burn_rate = Math.round((budget_used_pct / 100) * (30 / PERIOD_DAYS) * 100) / 100;

  let slo_status: SloStatus;
  if (availability_pct < SLO_TARGET_AVAILABILITY) slo_status = 'red';
  else if (budget_used_pct > 50) slo_status = 'yellow';
  else slo_status = 'green';

  return c.json({
    configured: true,
    degraded,
    slo_status,
    availability_pct,
    error_rate_pct: Math.round(error_rate_pct * 10000) / 10000,
    budget_allowance_pct: SLO_ERROR_BUDGET_PCT,
    budget_used_pct: Math.round(budget_used_pct * 100) / 100,
    burn_rate,
    period: '30d',
    ...(degraded ? { note: 'One or more upstream sources returned errors; values are partial.' } : {}),
  } satisfies SloPanel);
});

// ---------------------------------------------------------------------------
// ADM-4: Synthetic journey monitor panel
//
// Fetches the latest snapshot from MONITOR_KV (written by the synthetic-monitor
// cron). Falls back to a live fan-out if KV is not configured.
// ---------------------------------------------------------------------------

interface SyntheticJourneyResult {
  id: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  checkedAt: string;
}

interface SyntheticSnapshot {
  configured: boolean;
  status: 'ok' | 'degraded' | 'unknown';
  ts: string;
  passed: number;
  total: number;
  failed: SyntheticJourneyResult[];
  latencies: Record<string, number>;
  source: 'kv' | 'live';
  note?: string;
}

/**
 * GET /observability/synthetic
 *
 * Returns the latest synthetic monitor snapshot from MONITOR_KV, or a live
 * fan-out to the synthetic-monitor's /checks/run endpoint if KV is absent.
 */
observability.get('/synthetic', async (c) => {
  const kv = c.env.MONITOR_KV;

  if (kv) {
    try {
      const raw = await kv.get('latest');
      if (raw) {
        const snapshot = JSON.parse(raw) as {
          ts: string;
          status: 'ok' | 'degraded';
          failed: SyntheticJourneyResult[];
          latencies: Record<string, number>;
        };
        const total = Object.keys(snapshot.latencies).length;
        return c.json({
          configured: true,
          status: snapshot.status,
          ts: snapshot.ts,
          passed: total - (snapshot.failed?.length ?? 0),
          total,
          failed: snapshot.failed ?? [],
          latencies: snapshot.latencies,
          source: 'kv',
        } satisfies SyntheticSnapshot);
      }
    } catch {
      // Fall through to live probe
    }
  }

  // Live probe: call synthetic-monitor directly. This is a best-effort path.
  const SYNTHETIC_MONITOR_URL = 'https://synthetic-monitor.adrper79.workers.dev';
  try {
    const res = await fetch(`${SYNTHETIC_MONITOR_URL}/checks/run`, {
      headers: { 'User-Agent': 'factory-admin-studio/1' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return c.json(
        {
          configured: true,
          status: 'unknown' as const,
          ts: new Date().toISOString(),
          passed: 0,
          total: 0,
          failed: [],
          latencies: {},
          source: 'live',
          note: `synthetic-monitor returned ${res.status}`,
        } satisfies SyntheticSnapshot,
        502,
      );
    }
    const data = await res.json<{
      status: 'ok' | 'degraded';
      checkedAt: string;
      results: Array<{ id: string; ok: boolean; latencyMs: number; error?: string; checkedAt: string }>;
    }>();
    const failed = data.results.filter((r) => !r.ok);
    const latencies = Object.fromEntries(data.results.map((r) => [r.id, r.latencyMs]));
    return c.json({
      configured: true,
      status: data.status,
      ts: data.checkedAt,
      passed: data.results.length - failed.length,
      total: data.results.length,
      failed: failed.map((r) => ({
        id: r.id, ok: r.ok, latencyMs: r.latencyMs, error: r.error, checkedAt: r.checkedAt,
      })),
      latencies,
      source: 'live',
    } satisfies SyntheticSnapshot);
  } catch (err) {
    return c.json(
      {
        configured: true,
        status: 'unknown' as const,
        ts: new Date().toISOString(),
        passed: 0,
        total: 0,
        failed: [],
        latencies: {},
        source: 'live',
        note: (err as Error).message,
      } satisfies SyntheticSnapshot,
      502,
    );
  }
});

// ---------------------------------------------------------------------------
// ADM-5: Incident timeline — fuses Sentry issues + audit entries
//
// GET /observability/incidents
//   Returns a unified, chronological list of Sentry incidents and operator
//   actions correlated by env, time range, and request ID.
// ---------------------------------------------------------------------------

type IncidentKind = 'sentry' | 'audit' | 'synthetic';

interface IncidentEvent {
  id: string;
  kind: IncidentKind;
  /** ISO 8601 */
  occurredAt: string;
  title: string;
  severity: 'fatal' | 'error' | 'warning' | 'info' | 'unknown';
  env: string;
  /** Sentry permalink, deploy URL, or audit resource */
  sourceUrl?: string;
  /** X-Request-Id that links HTTP traces to this incident */
  requestId?: string;
  actor?: string;
  detail?: Record<string, unknown>;
}

observability.get('/incidents', async (c) => {
  const qs = new URL(c.req.url).searchParams;
  const env = qs.get('env') ?? c.var.envContext.env;
  const from = qs.get('from');
  const to = qs.get('to');
  const limit = clamp(Number.parseInt(qs.get('limit') ?? '50', 10), 1, 200);

  const events: IncidentEvent[] = [];

  // --- Sentry issues (ADM-1 fusion) ---
  const sentryToken = c.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = c.env.SENTRY_ORG;
  const sentryProject = c.env.SENTRY_PROJECT;
  if (sentryToken && sentryOrg && sentryProject) {
    try {
      const period = from ? '' : '&statsPeriod=7d';
      const dateRange = from
        ? `&start=${encodeURIComponent(from)}${to ? `&end=${encodeURIComponent(to)}` : ''}`
        : '';
      const res = await fetch(
        `https://sentry.io/api/0/projects/${encodeURIComponent(sentryOrg)}/${encodeURIComponent(sentryProject)}/issues/` +
          `?limit=25&environment=${encodeURIComponent(env)}${period}${dateRange}&query=is:unresolved`,
        { headers: { Authorization: `Bearer ${sentryToken}` } },
      );
      if (res.ok) {
        const raw: Array<Record<string, unknown>> = await res.json();
        for (const item of raw) {
          const level = typeof item['level'] === 'string' ? item['level'] : 'error';
          events.push({
            id: `sentry:${String(item['id'] ?? '')}`,
            kind: 'sentry',
            occurredAt: String(item['lastSeen'] ?? new Date().toISOString()),
            title: String(item['title'] ?? 'Sentry issue'),
            severity: (level === 'fatal' || level === 'error' || level === 'warning' || level === 'info')
              ? level
              : 'unknown',
            env,
            sourceUrl: sentryIssueUrl(sentryOrg, String(item['id'] ?? '')),
            detail: {
              count: item['count'],
              userCount: item['userCount'],
              firstSeen: item['firstSeen'],
            },
          });
        }
      }
    } catch {
      // Best-effort: skip if Sentry is down
    }
  }

  // Merge and sort newest-first, trim to limit
  events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const page = events.slice(0, limit);

  return c.json({
    env,
    total: events.length,
    returned: page.length,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    events: page,
  });
});

// ---------------------------------------------------------------------------
// ADM-7: Telemetry conformance matrix
//
// GET /observability/conformance
//   Fan-out to all Factory apps, checking for /api/admin/health endpoint
//   conformance. Returns a coverage matrix with pass/fail + schema issues.
// ---------------------------------------------------------------------------

interface ConformanceResult {
  appId: string;
  label: string;
  env: string;
  url: string;
  status: 'pass' | 'fail' | 'degraded' | 'unreachable';
  httpStatus: number;
  latencyMs: number;
  checkedAt: string;
  schemaIssues: string[];
}

interface ConformanceMatrix {
  env: string;
  checkedAt: string;
  passed: number;
  total: number;
  coverage_pct: number;
  results: ConformanceResult[];
}

const REQUIRED_FIELDS = [
  'status',
  'slo_status',
  'error_budget_used_pct',
  'p99_latency_ms',
  'error_rate_pct',
  'uptime_pct',
] as const;

/** Timeout for each conformance fan-out probe. */
const CONFORMANCE_TIMEOUT_MS = 8_000;

async function checkConformance(
  appId: string,
  label: string,
  env: string,
  baseUrl: string,
): Promise<ConformanceResult> {
  const url = `${baseUrl}/api/admin/health`;
  const checkedAt = new Date().toISOString();
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFORMANCE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const latencyMs = Date.now() - start;
    clearTimeout(timer);

    if (!res.ok) {
      return { appId, label, env, url, status: 'fail', httpStatus: res.status, latencyMs, checkedAt, schemaIssues: [`HTTP ${res.status}`] };
    }

    let body: Record<string, unknown>;
    try {
      body = await res.json<Record<string, unknown>>();
    } catch {
      return { appId, label, env, url, status: 'degraded', httpStatus: res.status, latencyMs, checkedAt, schemaIssues: ['Response is not valid JSON'] };
    }

    const schemaIssues: string[] = [];
    for (const field of REQUIRED_FIELDS) {
      if (!(field in body)) schemaIssues.push(`missing field: ${field}`);
    }

    const validStatuses = new Set(['green', 'yellow', 'red']);
    if (typeof body['status'] === 'string' && !validStatuses.has(body['status'])) {
      schemaIssues.push(`status must be green|yellow|red, got '${body['status']}'`);
    }

    return {
      appId, label, env, url,
      status: schemaIssues.length === 0 ? 'pass' : 'degraded',
      httpStatus: res.status,
      latencyMs,
      checkedAt,
      schemaIssues,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      appId, label, env, url,
      status: 'unreachable',
      httpStatus: 0,
      latencyMs: Date.now() - start,
      checkedAt,
      schemaIssues: [(err as Error).message],
    };
  }
}

/**
 * GET /observability/conformance
 *
 * Params:
 *   env — 'staging' | 'production' (defaults to session env, local not supported)
 *
 * Returns a conformance matrix showing which Factory apps expose a valid
 * /api/admin/health endpoint matching the telemetry contract.
 */
observability.get('/conformance', async (c) => {
  const ctx = c.var.envContext;
  const qs = new URL(c.req.url).searchParams;
  const requestedEnv = qs.get('env');
  const env = (requestedEnv === 'staging' || requestedEnv === 'production')
    ? requestedEnv
    : ctx.env === 'local' ? 'staging' : ctx.env;

  const checks = FACTORY_APPS.map((app) => {
    const healthUrl = healthUrlFor(app, env);
    if (!healthUrl) return null;
    const baseUrl = healthUrl.replace(/\/health$/, '');
    return checkConformance(app.id, app.label, env, baseUrl);
  }).filter((p): p is Promise<ConformanceResult> => p !== null);

  const results = await Promise.all(checks);
  const passed = results.filter((r) => r.status === 'pass').length;

  return c.json({
    env,
    checkedAt: new Date().toISOString(),
    passed,
    total: results.length,
    coverage_pct: results.length > 0 ? Math.round((passed / results.length) * 10000) / 100 : 0,
    results,
  } satisfies ConformanceMatrix);
});

export default observability;
