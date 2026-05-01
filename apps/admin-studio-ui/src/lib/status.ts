/**
 * Tiny presentational helpers for status colors so OverviewTab and
 * AppHealthGrid stay readable.
 */
import type { AppHealthStatus } from '@latimer-woods-tech/studio-core';

export function statusBadgeClass(status: AppHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-600/20 text-emerald-300 border-emerald-700';
    case 'degraded':
      return 'bg-amber-600/20 text-amber-300 border-amber-700';
    case 'down':
      return 'bg-red-600/20 text-red-300 border-red-700';
    case 'unknown':
    default:
      return 'bg-slate-700/40 text-slate-300 border-slate-600';
  }
}

export function statusDotClass(status: AppHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-400';
    case 'degraded':
      return 'bg-amber-400';
    case 'down':
      return 'bg-red-500';
    case 'unknown':
    default:
      return 'bg-slate-400';
  }
}
