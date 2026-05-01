/**
 * Hono app type — extends env with our custom variables.
 */
import type { Env } from './env.js';
import type { EnvContext, ReversibilityTier } from '@latimer-woods-tech/studio-core';

export interface AppVariables {
  envContext: EnvContext;
  requestId: string;
  /**
   * Routes may set these to override the generic audit entry produced by
   * auditMiddleware. When set, the middleware uses the provided values
   * instead of deriving them from the request URL/method.
   *
   * This avoids duplicate audit rows while still producing semantically
   * rich, domain-specific audit trail entries.
   */
  auditAction?: string;
  auditResource?: string;
  auditResourceId?: string;
  auditReversibility?: ReversibilityTier;
  auditResultDetail?: Record<string, unknown>;
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
