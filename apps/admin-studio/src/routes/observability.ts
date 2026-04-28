/**
 * Read-only proxies into Sentry + PostHog so the Studio can render
 * recent-error and metrics tiles without exposing API tokens to the browser.
 *
 * Both endpoints are tolerant of missing config: if secrets aren't set
 * they return `{ configured: false }` instead of 500. This lets us ship
 * the UI before the secret rotation is finished.
 *
 * Phase C will add SSE streaming for live error tails.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types.js';

const observability = new Hono<AppEnv>();

interface SentryIssue {
  id: string;
  title: string;
  culprit?: string;
  level: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
}

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

  const url = new URL(c.req.url);
  const limit = clamp(Number.parseInt(url.searchParams.get('limit') ?? '20', 10), 1, 100);
  const env = url.searchParams.get('env') ?? c.var.envContext.env;

  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?limit=${limit}&environment=${encodeURIComponent(env)}&statsPeriod=24h&query=is:unresolved`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      return c.json({ configured: true, error: `sentry-${res.status}`, issues: [] }, 502);
    }
    const issues = (await res.json()) as SentryIssue[];
    return c.json({ configured: true, env, issues });
  } catch (err) {
    return c.json({ configured: true, error: (err as Error).message, issues: [] }, 502);
  }
});

interface PostHogTile {
  id: string;
  label: string;
  value: number;
  unit?: string;
}

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

  // Minimal viable tile: total events in last 24h via the Insights API.
  // Richer tiles (DAU, retention, conversion) land in Phase C.
  try {
    const res = await fetch(
      `${host}/api/projects/${encodeURIComponent(projectId)}/query/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: {
            kind: 'HogQLQuery',
            query: `SELECT count() AS total FROM events WHERE timestamp >= now() - INTERVAL 24 HOUR`,
          },
        }),
      },
    );
    if (!res.ok) {
      return c.json({ configured: true, error: `posthog-${res.status}`, tiles: [] }, 502);
    }
    const json = (await res.json()) as { results?: Array<[number]> };
    const total = json.results?.[0]?.[0] ?? 0;
    const tiles: PostHogTile[] = [
      { id: 'events_24h', label: 'Events (24h)', value: total },
    ];
    return c.json({ configured: true, tiles });
  } catch (err) {
    return c.json({ configured: true, error: (err as Error).message, tiles: [] }, 502);
  }
});

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export default observability;
