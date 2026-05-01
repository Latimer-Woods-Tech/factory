/**
 * FunctionsTab — Phase E+F function-catalog viewer + smoke runner.
 *
 * Reads `GET /catalog` for the cross-app summary, then `GET /catalog/:app`
 * for endpoint rows. Operators can refresh an app's catalog (calls
 * `POST /catalog/:app/refresh`, which crawls the app's `/manifest` and
 * upserts into `function_catalog`). Operators can also run smoke tests
 * against any endpoint that declares probes.
 *
 * Stale rows (last_seen_at > 24h ago) get a yellow "stale" pill so it's
 * obvious when the crawler hasn't seen an endpoint in a while.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import type { Environment, FunctionCatalogRow, SmokeSuiteResult } from '@latimer-woods-tech/studio-core';

interface SummaryRow {
  app: string;
  env: string;
  endpoints: number;
  maxLastSeenAt: string | null;
}

interface SummaryResponse {
  summary: SummaryRow[];
  apps: Array<{ id: string; label: string }>;
}

interface CatalogResponse {
  app: string;
  env: string;
  rows: FunctionCatalogRow[];
}

interface RefreshResponse {
  app: string;
  env: string;
  url: string;
  entries: number;
  upserted: number;
  failed: number;
  buildSha: string | null;
  generatedAt: string;
}

const ENVS: ReadonlyArray<Environment> = ['production', 'staging'];
const STALE_MS = 24 * 60 * 60 * 1000;

export function FunctionsTab() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [env, setEnv] = useState<Environment>('production');
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [rows, setRows] = useState<FunctionCatalogRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsErr, setRowsErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [smokeRunning, setSmokeRunning] = useState<string | null>(null);
  const [smokeResult, setSmokeResult] = useState<SmokeSuiteResult | null>(null);
  const [smokeErr, setSmokeErr] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setSummaryErr(null);
    try {
      const s = await apiFetch<SummaryResponse>('/catalog');
      setSummary(s);
      if (!activeApp && s.apps[0]) setActiveApp(s.apps[0].id);
    } catch (e) {
      setSummaryErr((e as Error).message);
    }
  }, [activeApp]);

  const loadRows = useCallback(async (app: string, e: Environment) => {
    setRowsLoading(true);
    setRowsErr(null);
    try {
      const data = await apiFetch<CatalogResponse>(
        `/catalog/${encodeURIComponent(app)}?env=${encodeURIComponent(e)}`,
      );
      setRows(data.rows);
    } catch (err) {
      setRowsErr((err as Error).message);
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (activeApp) void loadRows(activeApp, env);
  }, [activeApp, env, loadRows]);

  async function refresh(app: string) {
    setRefreshing(app);
    setRefreshMsg(null);
    try {
      const r = await apiFetch<RefreshResponse>(
        `/catalog/${encodeURIComponent(app)}/refresh?env=${encodeURIComponent(env)}`,
        { method: 'POST' },
      );
      setRefreshMsg(
        `${app}@${env}: ${r.entries} entries, ${r.upserted} upserted, ${r.failed} failed`,
      );
      await loadSummary();
      if (activeApp === app) await loadRows(app, env);
    } catch (e) {
      setRefreshMsg(`refresh failed: ${(e as Error).message}`);
    } finally {
      setRefreshing(null);
    }
  }

  async function runSmoke(row: FunctionCatalogRow) {
    if (!activeApp) return;
    const endpointId = btoa(`${row.method}:${row.path}`).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    setSmokeRunning(endpointId);
    setSmokeErr(null);
    setSmokeResult(null);
    try {
      const result = await apiFetch<SmokeSuiteResult>(
        `/smoke/${encodeURIComponent(activeApp)}/${encodeURIComponent(endpointId)}`,
        { method: 'POST', body: JSON.stringify({ env }) },
      );
      setSmokeResult(result);
    } catch (err) {
      setSmokeErr((err as Error).message);
    } finally {
      setSmokeRunning(null);
    }
  }

  const summaryByApp = useMemo(() => {
    const map = new Map<string, SummaryRow[]>();
    for (const s of summary?.summary ?? []) {
      const list = map.get(s.app) ?? [];
      list.push(s);
      map.set(s.app, list);
    }
    return map;
  }, [summary]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, FunctionCatalogRow[]>();
    for (const row of rows) {
      const key = row.tags?.[0] ?? 'misc';
      const arr = groups.get(key) ?? [];
      arr.push(row);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Functions</h1>
          <p className="text-sm text-slate-400">
            Live catalog of every endpoint each Factory app advertises via
            <code className="mx-1 rounded bg-slate-800 px-1 text-slate-200">/manifest</code>.
            Refresh crawls the app and upserts rows into
            <code className="mx-1 rounded bg-slate-800 px-1 text-slate-200">function_catalog</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">env</label>
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as Environment)}
            className="rounded bg-slate-950 border border-slate-700 px-2 py-1 text-sm text-white"
          >
            {ENVS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      </header>

      {summaryErr && (
        <div className="rounded border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {summaryErr}
        </div>
      )}
      {refreshMsg && (
        <div className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
          {refreshMsg}
        </div>
      )}
      {smokeErr && (
        <div className="rounded border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          Smoke run failed: {smokeErr}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded border border-slate-800 bg-slate-900 p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Apps
          </h2>
          <ul className="space-y-1">
            {summary?.apps.map((app) => {
              const stats = summaryByApp.get(app.id) ?? [];
              const envStat = stats.find((s) => s.env === env);
              const isActive = activeApp === app.id;
              return (
                <li key={app.id}>
                  <button
                    onClick={() => setActiveApp(app.id)}
                    className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate">{app.label}</span>
                    <span className="ml-2 rounded bg-slate-700 px-1.5 text-xs text-slate-200">
                      {envStat?.endpoints ?? 0}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="rounded border border-slate-800 bg-slate-900 p-3">
          {!activeApp ? (
            <p className="text-sm text-slate-500">Select an app.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {activeApp} <span className="text-sm text-slate-400">@ {env}</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    {rows.length} endpoint{rows.length === 1 ? '' : 's'} catalogued
                  </p>
                </div>
                <button
                  onClick={() => void refresh(activeApp)}
                  disabled={refreshing === activeApp}
                  className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {refreshing === activeApp ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              {rowsErr && (
                <div className="mb-3 rounded border border-red-700 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                  {rowsErr}
                </div>
              )}
              {rowsLoading && (
                <p className="text-sm text-slate-500">Loading…</p>
              )}
              {!rowsLoading && rows.length === 0 && !rowsErr && (
                <p className="text-sm text-slate-500">
                  No rows yet. Click Refresh to crawl the app's <code>/manifest</code>.
                </p>
              )}

              <div className="space-y-4">
                {groupedRows.map(([tag, group]) => (
                  <div key={tag}>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {tag}
                    </h3>
                    <div className="overflow-hidden rounded border border-slate-800">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-950 text-left text-xs uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="px-2 py-1">method</th>
                            <th className="px-2 py-1">path</th>
                            <th className="px-2 py-1">auth</th>
                            <th className="px-2 py-1">summary</th>
                            <th className="px-2 py-1">last seen</th>
                            <th className="px-2 py-1 text-right">smoke</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {group.map((row) => (
                            <EndpointRow
                              key={row.id}
                              row={row}
                              onRunSmoke={runSmoke}
                              smokeRunning={smokeRunning === btoa(`${row.method}:${row.path}`).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}
                              smokeResult={smokeResult}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function EndpointRow({ row, onRunSmoke, smokeRunning, smokeResult }: { row: FunctionCatalogRow; onRunSmoke: (row: FunctionCatalogRow) => void; smokeRunning: boolean; smokeResult: SmokeSuiteResult | null }) {
  const lastSeen = new Date(row.lastSeenAt).getTime();
  const stale = Number.isFinite(lastSeen) && Date.now() - lastSeen > STALE_MS;
  const hasProbes = row.smoke && row.smoke.length > 0;
  return (
    <>
      <tr className="text-slate-200">
        <td className="px-2 py-1 font-mono text-xs">
          <MethodBadge method={row.method} />
        </td>
        <td className="px-2 py-1 font-mono text-xs">{row.path}</td>
        <td className="px-2 py-1 text-xs">
          <AuthBadge auth={row.auth} />
        </td>
        <td className="px-2 py-1 text-xs text-slate-300">{row.summary}</td>
        <td className="px-2 py-1 text-xs text-slate-400">
          {stale && (
            <span className="mr-1 rounded bg-amber-900/60 px-1.5 text-amber-300">stale</span>
          )}
          {formatRelative(row.lastSeenAt)}
        </td>
        <td className="px-2 py-1 text-right">
          {hasProbes && (
            <button
              onClick={() => onRunSmoke(row)}
              disabled={smokeRunning}
              className="rounded bg-indigo-700 px-2 py-1 text-xs text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {smokeRunning ? 'Running…' : `Run (${row.smoke!.length})`}
            </button>
          )}
        </td>
      </tr>
      {smokeResult && (
        <tr className="bg-slate-950">
          <td colSpan={6} className="px-2 py-2">
            <div className="rounded border border-slate-700 bg-slate-900 p-2 text-xs">
              <div className="mb-1 font-semibold text-slate-200">
                {smokeResult.passed} / {smokeResult.total} passed ({smokeResult.durationMs}ms)
              </div>
              <div className="space-y-0.5">
                {smokeResult.results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-start justify-between py-0.5 px-1 rounded text-xs ${
                      r.passed ? 'bg-emerald-950/40 text-emerald-300' : 'bg-red-950/40 text-red-300'
                    }`}
                  >
                    <span>
                      {r.label} — {r.status || '·'} {r.durationMs}ms
                    </span>
                    {!r.passed && r.reason && (
                      <span className="text-slate-400">{r.reason.slice(0, 60)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MethodBadge({ method }: { method: string }) {
  const tone =
    method === 'GET'
      ? 'bg-blue-900/50 text-blue-300'
      : method === 'POST'
      ? 'bg-emerald-900/50 text-emerald-300'
      : method === 'DELETE'
      ? 'bg-red-900/50 text-red-300'
      : 'bg-slate-800 text-slate-300';
  return <span className={`rounded px-1.5 py-0.5 ${tone}`}>{method}</span>;
}

function AuthBadge({ auth }: { auth: string }) {
  const tone =
    auth === 'public'
      ? 'bg-slate-700 text-slate-200'
      : auth === 'session'
      ? 'bg-blue-900/50 text-blue-300'
      : auth === 'admin'
      ? 'bg-amber-900/50 text-amber-300'
      : 'bg-purple-900/50 text-purple-300';
  return <span className={`rounded px-1.5 py-0.5 ${tone}`}>{auth}</span>;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}
