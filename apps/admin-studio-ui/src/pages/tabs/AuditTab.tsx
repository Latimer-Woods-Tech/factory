export function AuditTab() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
      <p className="text-sm text-slate-400">
        Browser ships in Phase B once <code>studio_audit_log</code> is wired through <code>@adrper79-dot/neon</code>.
        Phase A only emits entries to Worker logs.
      </p>
      <div className="rounded border border-slate-800 bg-slate-900 p-4 text-sm text-slate-500">
        No data source connected yet. Run the migration in <code>apps/admin-studio/migrations/0001_studio_audit_log.sql</code>.
      </div>
    </div>
  );
}
