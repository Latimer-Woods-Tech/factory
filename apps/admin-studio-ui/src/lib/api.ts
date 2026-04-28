/**
 * Thin fetch wrapper. Adds JWT, request id, and surfaces 401 → forced logout.
 */
import { useSession } from '../stores/session.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface ApiError extends Error {
  status: number;
  body: unknown;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { confirmed?: boolean; confirmToken?: string; dryRun?: boolean } = {},
): Promise<T> {
  const { token } = useSession.getState();
  const headers = new Headers(init.headers);

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (init.confirmed) headers.set('X-Confirmed', 'true');
  if (init.confirmToken) headers.set('X-Confirm-Token', init.confirmToken);
  if (init.dryRun) headers.set('X-Dry-Run', 'true');
  headers.set('X-Request-Id', crypto.randomUUID());

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    useSession.getState().logout();
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    const err: ApiError = Object.assign(new Error(`API ${res.status}`), {
      status: res.status,
      body,
    });
    throw err;
  }

  return body as T;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
