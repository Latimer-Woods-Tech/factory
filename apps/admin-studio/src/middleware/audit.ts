/**
 * Audit middleware — captures every mutating request into studio_audit_log.
 *
 * Skips GET/HEAD/OPTIONS. Redacts secrets from payload before insert.
 * Phase B: persists via @adrper79-dot/neon. Insert failures are logged
 * but never block the response (defence-in-depth: audit infra outage
 * must not 5xx user traffic).
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';
import { redactSecrets, type AuditEntry } from '@adrper79-dot/studio-core';
import { insertAuditEntry } from '../lib/audit-store.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function auditMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) {
      return next();
    }

    const ctx = c.var.envContext;
    if (!ctx) {
      // No identity — auth failed elsewhere, nothing to audit.
      return next();
    }

    let payload: Record<string, unknown> = {};
    try {
      const cloned = c.req.raw.clone();
      const text = await cloned.text();
      if (text) payload = redactSecrets(JSON.parse(text));
    } catch {
      // Non-JSON body (form upload, etc.) — log empty payload.
    }

    let result: AuditEntry['result'] = 'success';
    let resultDetail: Record<string, unknown> | undefined;
    try {
      await next();
      if (c.res.status >= 400) {
        result = 'failure';
        resultDetail = { status: c.res.status };
      }
    } catch (err) {
      result = 'failure';
      resultDetail = { error: (err as Error).message };
      throw err;
    } finally {
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        userRole: ctx.role,
        sessionId: ctx.sessionId,
        env: ctx.env,
        action: `${c.req.method} ${new URL(c.req.url).pathname}`,
        reversibility: 'reversible', // routes can override by writing their own entry
        payload,
        result,
        resultDetail,
        ipAddress: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For'),
        userAgent: c.req.header('User-Agent'),
        requestId: c.var.requestId ?? crypto.randomUUID(),
      };

      // Always echo to console so logs are searchable even if DB is down.
      console.log('[AUDIT]', JSON.stringify(entry));

      // Best-effort DB insert. Use waitUntil when available so we don't
      // hold the response open. Hono exposes the executionCtx via c.executionCtx.
      const writePromise = insertAuditEntry(c.env.DB, entry);
      const exec = c.executionCtx;
      if (exec && typeof exec.waitUntil === 'function') {
        exec.waitUntil(writePromise);
      } else {
        // Fall back to await — we still swallow inside insertAuditEntry.
        await writePromise;
      }
    }
  };
}
