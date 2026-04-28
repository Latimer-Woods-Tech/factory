/**
 * Audit middleware — captures every mutating request into studio_audit_log.
 *
 * Skips GET/HEAD/OPTIONS. Redacts secrets from payload before insert.
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';
import { redactSecrets, type AuditEntry } from '@adrper79-dot/studio-core';

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
      // Fire-and-forget; don't block response on audit insert.
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

      // TODO: insert into studio_audit_log via @adrper79-dot/neon
      // For Phase A we just log to console; DB wiring lands in Phase B.
      console.log('[AUDIT]', JSON.stringify(entry));
    }
  };
}
