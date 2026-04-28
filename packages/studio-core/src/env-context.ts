/**
 * Environment context types and helpers.
 *
 * The environment context is the safety layer that prevents wrong-environment
 * errors. Every request carries an env claim in its JWT. Backend middleware
 * extracts it and binds the appropriate database, secrets, and external services.
 *
 * @see docs/admin-studio/01-ENVIRONMENT-SAFETY.md
 */

/**
 * The three target environments. Each has a distinct color, risk profile,
 * and set of safeguards.
 */
export type Environment = 'local' | 'staging' | 'production';

/**
 * Roles within Studio. Higher roles inherit lower role permissions.
 *
 * - viewer: read-only access to dashboards and logs
 * - editor: can edit content, run tests, create branches (no deploy)
 * - admin:  can deploy to staging, manage users, edit schemas
 * - owner:  can deploy to production, rotate secrets, delete data
 */
export type Role = 'viewer' | 'editor' | 'admin' | 'owner';

/**
 * Reversibility tier of an action. Drives UI treatment and confirmation level.
 */
export type ReversibilityTier =
  | 'trivial'           // 🟢 UI-only or undo-able
  | 'reversible'        // 🟡 git revert / redeploy can undo
  | 'manual-rollback'   // 🟠 Requires explicit rollback step (wrangler rollback)
  | 'irreversible';     // 🔴 Data loss or external side effect (email sent)

/**
 * Confirmation tier required to execute an action.
 */
export type ConfirmationTier = 0 | 1 | 2 | 3 | 4;
//      0 = none       (read-only)
//      1 = click      (modal "Are you sure?")
//      2 = type       (type-to-confirm string)
//      3 = two-key    (two admins must approve within 10 min)
//      4 = cooldown   (type + 30s timer)

/**
 * The environment context attached to every authenticated request.
 */
export interface EnvContext {
  env: Environment;
  /** Optional: scoped to a specific Factory app (e.g. 'wordis-bond'). */
  app?: string;
  sessionId: string;
  userId: string;
  userEmail: string;
  role: Role;
  /** Unix ms when this env was selected — used for session expiry checks. */
  envLockedAt: number;
}

/**
 * The JWT payload shape Studio issues. Standard claims (iat/exp/iss) plus
 * the env context.
 */
export interface EnvJWTPayload extends EnvContext {
  iat: number;
  exp: number;
  iss: 'factory-admin-studio';
  sub: string; // duplicates userId for JWT spec compliance
}

/**
 * Descriptor for a mutating action — used by routes to declare their risk.
 */
export interface ActionDescriptor {
  /** Stable action identifier, e.g. "deploy.production" */
  action: string;
  tier: ReversibilityTier;
  description: string;
  confirmation: ConfirmationTier;
  /** Channels to notify (e.g. ['#deploys', '#prod-changes']) */
  notifyChannels?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Throws if the current env is not in the allowed list.
 *
 * @example
 * ```ts
 * requireEnv(ctx, ['staging', 'production']); // ok for non-local
 * requireEnv(ctx, ['production']);             // only production
 * ```
 */
export function requireEnv(ctx: EnvContext, allowed: readonly Environment[]): void {
  if (!allowed.includes(ctx.env)) {
    throw new Error(
      `Action requires env in [${allowed.join(', ')}], got '${ctx.env}'`,
    );
  }
}

/**
 * Throws if the user's role is below the required level.
 */
export function requireRole(ctx: EnvContext, minRole: Role): void {
  const order: Role[] = ['viewer', 'editor', 'admin', 'owner'];
  const userIdx = order.indexOf(ctx.role);
  const minIdx = order.indexOf(minRole);
  if (userIdx < minIdx) {
    throw new Error(`Action requires role '${minRole}' or higher, got '${ctx.role}'`);
  }
}

/**
 * Maximum age of a session before re-auth is required.
 *
 * Production: 4 hours (intentionally short).
 * Staging/local: 24 hours.
 */
export function maxSessionAge(env: Environment): number {
  return env === 'production' ? 4 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

/**
 * Returns true if the session has expired given env policy.
 */
export function isSessionExpired(ctx: EnvContext, now: number = Date.now()): boolean {
  return now - ctx.envLockedAt > maxSessionAge(ctx.env);
}

/**
 * Determines the required confirmation tier given env and reversibility.
 *
 * | env / tier  | trivial | reversible | manual-rollback | irreversible |
 * |-------------|---------|------------|-----------------|--------------|
 * | local       | 0       | 0          | 1               | 2            |
 * | staging     | 0       | 1          | 2               | 2            |
 * | production  | 1       | 2          | 2               | 3            |
 */
export function requiredConfirmationTier(
  env: Environment,
  reversibility: ReversibilityTier,
): ConfirmationTier {
  if (env === 'local') {
    if (reversibility === 'irreversible') return 2;
    if (reversibility === 'manual-rollback') return 1;
    return 0;
  }
  if (env === 'staging') {
    if (reversibility === 'irreversible') return 2;
    if (reversibility === 'manual-rollback') return 2;
    if (reversibility === 'reversible') return 1;
    return 0;
  }
  // production
  if (reversibility === 'irreversible') return 3;
  if (reversibility === 'manual-rollback') return 2;
  if (reversibility === 'reversible') return 2;
  return 1;
}

/**
 * Type guard for Environment.
 */
export function isEnvironment(value: unknown): value is Environment {
  return value === 'local' || value === 'staging' || value === 'production';
}

/**
 * Type guard for Role.
 */
export function isRole(value: unknown): value is Role {
  return ['viewer', 'editor', 'admin', 'owner'].includes(value as string);
}
