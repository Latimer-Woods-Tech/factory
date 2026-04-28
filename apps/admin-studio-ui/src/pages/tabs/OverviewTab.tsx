import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api.js';

interface Me {
  env: string;
  user: { id: string; email: string; role: string };
  sessionId: string;
  envLockedAt: number;
}

export function OverviewTab() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Me>('/me/').then(setMe).catch((e) => setErr((e as Error).message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Overview</h1>
      <p className="text-sm text-slate-400">
        Phase A foundation. Real dashboards (apps health, deploy status, alerts) land in Phase B.
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
    </div>
  );
}
