/**
 * Audit log entry shape. Every mutating Studio action must produce one of these.
 */

import type { Environment, Role, ReversibilityTier } from './env-context.js';

export interface AuditEntry {
  id: string;
  occurredAt: string; // ISO 8601
  userId: string;
  userEmail: string;
  userRole: Role;
  sessionId: string;
  env: Environment;
  /** Stable action identifier or HTTP method+path */
  action: string;
  /** Resource type, e.g. 'wordis-bond', 'user', 'content' */
  resource?: string;
  /** Resource id, e.g. user UUID */
  resourceId?: string;
  reversibility: ReversibilityTier;
  /** Request payload with secrets stripped */
  payload: Record<string, unknown>;
  result: 'success' | 'failure' | 'dry-run';
  resultDetail?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  /** Correlation id matching X-Request-Id header */
  requestId: string;
}

/**
 * Strip well-known secret keys from an object before logging.
 */
const SECRET_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'secret',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'privateKey',
  'private_key',
]);

export function redactSecrets<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (SECRET_KEYS.has(key) || [...SECRET_KEYS].some((s) => lower.includes(s.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSecrets(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
