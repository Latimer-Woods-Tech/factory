import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';

interface Suite {
  id: string;
  name: string;
  path: string;
  testCount: number;
}

export function TestsTab() {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<unknown>(null);

  useEffect(() => {
    apiFetch<{ suites: Suite[] }>('/tests/').then((r) => setSuites(r.suites));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function dispatch(opts: { confirmToken?: string } = {}) {
    setRunning(true);
    setConfirming(false);
    try {
      const result = await apiFetch('/tests/runs', {
        method: 'POST',
        body: JSON.stringify({ suites: [...selected] }),
        confirmed: true,
        confirmToken: opts.confirmToken,
      });
      setLastResult(result);
    } catch (err) {
      setLastResult({ error: (err as Error).message });
    } finally {
      setRunning(false);
    }
  }

  async function dryRun() {
    const result = await apiFetch('/tests/runs?dryRun=true', {
      method: 'POST',
      body: JSON.stringify({ suites: [...selected] }),
      dryRun: true,
    });
    setLastResult(result);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Tests</h1>
      <p className="text-sm text-slate-400">
        Select suites and dispatch runs via GitHub Actions. Live streaming + filtering land in Phase C.
      </p>

      <div className="rounded border border-slate-800 bg-slate-900 divide-y divide-slate-800">
        {suites.map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-800/50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              className="accent-emerald-500"
            />
            <span className="font-medium text-white">{s.name}</span>
            <span className="text-slate-500 ml-auto text-xs">{s.testCount} tests</span>
          </label>
        ))}
        {suites.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">Loading suites…</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          disabled={selected.size === 0 || running}
          onClick={dryRun}
          className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          Dry-run
        </button>
        <button
          disabled={selected.size === 0 || running}
          onClick={() => setConfirming(true)}
          className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {running ? 'Dispatching…' : `Run ${selected.size} suite${selected.size === 1 ? '' : 's'}`}
        </button>
      </div>

      {lastResult !== null && (
        <pre className="rounded border border-slate-800 bg-black/50 p-3 text-xs text-emerald-300 overflow-auto">
          {JSON.stringify(lastResult, null, 2)}
        </pre>
      )}

      <ConfirmDialog
        open={confirming}
        action="tests.dispatch"
        description={`Dispatch a test run for ${selected.size} suite(s) via GitHub Actions.`}
        reversibility="reversible"
        tier={1}
        onCancel={() => setConfirming(false)}
        onConfirm={() => dispatch()}
      />
    </div>
  );
}
