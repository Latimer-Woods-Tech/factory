import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { AppHealthGrid } from '../../components/AppHealthGrid.js';
import { DeployVersionsTable } from '../../components/DeployVersionsTable.js';

interface Me {
  env: string;
  user: { id: string; email: string; role: string };
  sessionId: string;
  envLockedAt: number;
}

interface SentryResp {
  configured: boolean;
  note?: string;
  issues: Array<{ id: string; title: string; level: string; lastSeen: string; permalink: string }>;
}

interface PostHogResp {
  configured: boolean;
  note?: string;
  tiles: Array<{ id: string; label: string; value: number; unit?: string }>;
}

export function OverviewTab() {
  const [me, setMe] = useState<Me | null>(null);
  const [sentry, setSentry] = useState<SentryResp | null>(null);
  const [posthog, setPostHog] = useState<PostHogResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sentryErr, setSentryErr] = useState<string | null>(null);
  const [posthogErr, setPosthogErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Me>('/me').then(setMe).catch((e) => setErr((e as Error).message));
  }, []);

  useEffect(() => {
    if (!me) return;
    apiFetch<SentryResp>(`/observability/sentry/issues?limit=10&env=${encodeURIComponent(me.env)}`)
      .then(setSentry)
      .catch((e) => setSentryErr((e as Error).message));
    apiFetch<PostHogResp>('/observability/posthog/tiles')
      .then(setPostHog)
      .catch((e) => setPosthogErr((e as Error).message));
  }, [me]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Overview</h1>
      <p className="text-sm text-slate-400">
        Live cross-app health, deploys, errors, and engagement for the active environment.
      </p>

      <div className="rounded border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Session</h2>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {me ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-400">Environment</dt>
            <dd className="text-white">{me.env}</dd>
            <dt className="text-slate-400">User</dt>
            <dd className="text-white">{me.user.email}</dd>
            <dt className="text-slate-400">Role</dt>
            <dd className="text-white">{me.user.role}</dd>
            <dt className="text-slate-400">Session ID</dt>
            <dd className="text-white font-mono text-xs">{me.sessionId}</dd>
            <dt className="text-slate-400">Locked at</dt>
            <dd className="text-white">{new Date(me.envLockedAt).toLocaleString()}</dd>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
      </div>

      {me && (
        <>
          <AppHealthGrid env={me.env} />

          {/* PostHog */}
          <div className="rounded border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-sm font-semibold text-slate-200">PostHog</h2>
            {posthogErr ? (
              <p className="mt-1 text-xs text-red-400">Error: {posthogErr}</p>
            ) : !posthog ? (
              <p className="mt-1 text-xs text-slate-500">Loading…</p>
            ) : !posthog.configured ? (
              <p className="mt-1 text-xs text-amber-300">{posthog.note}</p>
            ) : (
              <ul className="mt-2 grid grid-cols-3 gap-3">
                {posthog.tiles.map((t) => (
                  <li
                    key={t.id}
                    className="rounded border border-slate-800 bg-slate-950 p-3 text-center"
                  >
                    <div className="text-xs uppercase text-slate-500">{t.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-white">
                      {t.value.toLocaleString()}
                      {t.unit ? <span className="text-sm text-slate-400 ml-1">{t.unit}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DeployVersionsTable env={me.env} />

          {/* Sentry */}
          <div className="rounded border border-slate-800 bg-slate-900">
            <header className="border-b border-slate-800 px-4 py-2">
              <h2 className="text-sm font-semibold text-slate-200">Sentry — recent issues</h2>
            </header>
            {sentryErr ? (
              <p className="px-4 py-3 text-xs text-red-400">Error: {sentryErr}</p>
            ) : !sentry ? (
              <p className="px-4 py-3 text-sm text-slate-500">Loading…</p>
            ) : !sentry.configured ? (
              <p className="px-4 py-3 text-xs text-amber-300">{sentry.note}</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {sentry.issues.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="text-xs uppercase text-slate-500">{i.level}</span>
                    <a
                      href={i.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-white hover:underline"
                    >
                      {i.title}
                    </a>
                    <span className="ml-auto text-xs text-slate-500">
                      {new Date(i.lastSeen).toLocaleString()}
                    </span>
                  </li>
                ))}
                {sentry.issues.length === 0 && (
                  <li className="px-4 py-3 text-sm text-slate-500">
                    No unresolved issues in the last 24h.
                  </li>
                )}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
