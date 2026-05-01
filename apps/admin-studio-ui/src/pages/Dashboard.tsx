/**
 * Dashboard shell. Tabs scaffold the major Studio surfaces; each tab will
 * fill in over Phases B–G. Phase A renders stub panels with real data
 * from /me and /tests so we can verify the auth + audit chain end-to-end.
 */
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { OverviewTab } from './tabs/OverviewTab.js';
import { TestsTab } from './tabs/TestsTab.js';
import { CodeTab } from './tabs/CodeTab.js';
import { AiTab } from './tabs/AiTab.js';
import { AuditTab } from './tabs/AuditTab.js';
import { FunctionsTab } from './tabs/FunctionsTab.js';

const TABS = [
  { to: '/overview',  label: 'Overview' },
  { to: '/tests',     label: 'Tests' },
  { to: '/code',      label: 'Code' },
  { to: '/ai',        label: 'AI Chat' },
  { to: '/functions', label: 'Functions' },
  { to: '/audit',     label: 'Audit Log' },
];

export function Dashboard() {
  return (
    <div className="flex h-[calc(100vh-44px)] flex-col md:flex-row">
      <nav aria-label="Studio sections" className="w-full border-b border-slate-800 bg-slate-950 p-3 md:w-56 md:border-b-0 md:border-r">
        <ul className="flex gap-1 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `block whitespace-nowrap rounded px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewTab />} />
          <Route path="/tests" element={<TestsTab />} />
          <Route path="/code" element={<CodeTab />} />
          <Route path="/ai" element={<AiTab />} />
          <Route path="/functions" element={<FunctionsTab />} />
          <Route path="/audit" element={<AuditTab />} />
        </Routes>
      </main>
    </div>
  );
}
