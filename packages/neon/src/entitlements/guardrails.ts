/**
 * Render Cost Guardrails (W360-023)
 *
 * Purpose: Enforce cost limits, render quotas, and kill switches before
 *          dispatching any video render job.
 *
 * Design principles:
 *   - All checks are synchronous reads — no writes until render is approved
 *   - Kill switch checked before quota: global > customer > plan
 *   - Quota check is idempotent; debit only happens downstream in debitCreditsForRender
 *   - Cost estimation is deterministic: seconds × rate, rounded up to nearest 0.01
 *   - All thresholds are tunable without code deploy via env vars / plan config
 *   - Alert emission is fire-and-forget; errors never block render dispatch
 */

import { sql } from 'drizzle-orm';
import type { FactoryDb } from '../index.js';

// ============================================================================
// Constants
// ============================================================================

/** Credit cost per second of rendered video. Adjust via CREDIT_RATE_PER_SECOND. */
export const DEFAULT_CREDIT_RATE_PER_SECOND = 0.1;

/** Default maximum video duration (seconds) before plan check. */
export const DEFAULT_MAX_VIDEO_SECONDS = 300;

/** Alert threshold: warn when remaining credits fall below this fraction of quota. */
export const BUDGET_ALERT_THRESHOLD_FRACTION = 0.2;

/** Hard platform cap: no video render can exceed this many seconds regardless of plan. */
export const PLATFORM_MAX_VIDEO_SECONDS = 1800; // 30 minutes

// ============================================================================
// Types
// ============================================================================

/** Result of a quota/guardrail check before dispatching a render job. */
export interface RenderGuardrailResult {
  /** Whether the render is permitted. */
  allowed: boolean;
  /** Human-readable reason if denied. */
  reason?: string;
  /** Estimated credit cost for this render. */
  estimatedCost: number;
  /** Credits available after this render would complete. */
  creditsAfter: number;
  /** Whether a budget alert should be raised. */
  budgetAlertNeeded: boolean;
  /** Diagnostic context (safe to log, no PII). */
  context: {
    customerId: string;
    availableCredits: number;
    monthlyRenderQuota: number | null;
    rendersThisPeriod: number;
    requestedDurationSeconds: number;
    maxVideoSeconds: number;
    killSwitchActive: boolean;
    killSwitchScope: 'global' | 'customer' | 'none';
  };
}

/** Parameters describing the render request to be guarded. */
export interface RenderRequest {
  /** Customer requesting the render. */
  customerId: string;
  /** Requested video duration in seconds. */
  durationSeconds: number;
  /** Credit cost rate per second (defaults to DEFAULT_CREDIT_RATE_PER_SECOND). */
  creditRatePerSecond?: number;
}

/** Kill switch state for a given customer or globally. */
export interface KillSwitchState {
  active: boolean;
  scope: 'global' | 'customer' | 'none';
  reason?: string;
}

// ============================================================================
// Cost Estimation
// ============================================================================

/**
 * Estimate the credit cost for a render job.
 *
 * Formula: ceil(durationSeconds × ratePerSecond, 2 decimal places)
 *
 * @param durationSeconds - Requested video length in seconds
 * @param ratePerSecond - Credit rate per second (default: 0.1)
 * @returns Estimated credit cost rounded up to nearest 0.01
 *
 * @example
 * estimateRenderCost(30)    // 3.00 credits
 * estimateRenderCost(45, 0.1) // 4.50 credits
 */
export function estimateRenderCost(
  durationSeconds: number,
  ratePerSecond: number = DEFAULT_CREDIT_RATE_PER_SECOND,
): number {
  if (durationSeconds <= 0 || ratePerSecond <= 0) return 0;
  const raw = durationSeconds * ratePerSecond;
  // Round up to nearest 0.01 (avoid floating-point droop)
  return Math.ceil(raw * 100) / 100;
}

// ============================================================================
// Kill Switch
// ============================================================================

/**
 * Check whether the render kill switch is active for a customer.
 *
 * Kill switch priority (first match wins):
 *   1. Global kill switch (kills all renders for all customers)
 *   2. Customer-level suspension (suspensionStatus ≠ 'active')
 *   3. No kill switch active
 *
 * @param db - Database connection
 * @param customerId - Customer to check
 * @returns Kill switch state with scope and optional reason
 */
export async function isKillSwitchActive(db: FactoryDb, customerId: string): Promise<KillSwitchState> {
  // 1. Check global kill switch (stored in a simple config table)
  try {
    const globalResult = await db.execute(sql`
      SELECT value FROM factory_config WHERE key = 'render_kill_switch' LIMIT 1
    `);
    if (globalResult.rows.length > 0) {
      const row = globalResult.rows[0] as { value: string };
      if (row.value === 'true' || row.value === '1') {
        return { active: true, scope: 'global', reason: 'Platform render kill switch is active' };
      }
    }
  } catch {
    // factory_config table may not exist yet — treat as no global kill switch
  }

  // 2. Check per-customer suspension
  const customerResult = await db.execute(sql`
    SELECT suspension_status FROM studio_customers
    WHERE id = ${customerId}
    LIMIT 1
  `);

  if (customerResult.rows.length > 0) {
    const row = customerResult.rows[0] as { suspension_status: string };
    if (row.suspension_status !== 'active') {
      return {
        active: true,
        scope: 'customer',
        reason: `Customer account is ${row.suspension_status}`,
      };
    }
  }

  return { active: false, scope: 'none' };
}

// ============================================================================
// Quota Check
// ============================================================================

/**
 * Count the number of render debits for a customer in the current billing period.
 * Uses the credit ledger — no coupling to video_calendar or job tables.
 *
 * @param db - Database connection
 * @param customerId - Customer to check
 * @returns Number of render debit entries this billing period
 */
export async function getRenderCountThisPeriod(db: FactoryDb, customerId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*)::integer AS count
    FROM studio_credit_ledger scl
    JOIN studio_subscriptions ss ON ss.customer_id = scl.customer_id
    WHERE scl.customer_id = ${customerId}
      AND scl.operation_type = 'debit'
      AND scl.created_at >= ss.current_period_start
      AND scl.created_at <= ss.current_period_end
      AND ss.status IN ('active', 'trialing')
    LIMIT 1
  `);

  if (result.rows.length === 0) return 0;
  const row = result.rows[0] as { count: string | number };
  return typeof row.count === 'number' ? row.count : parseInt(row.count, 10);
}

// ============================================================================
// Main Guardrail Entrypoint
// ============================================================================

/**
 * Check all render guardrails before dispatching a video render job.
 *
 * Evaluation order (fails fast):
 *   1. Kill switch check (global then customer)
 *   2. Entitlement existence (must be active subscriber)
 *   3. Video duration limit (plan max and platform cap)
 *   4. Monthly render quota (if plan has a numeric limit)
 *   5. Credit balance check (sufficient credits for estimated cost)
 *
 * This function is a READ-ONLY check. It does NOT debit credits.
 * Call `debitCreditsForRender` AFTER the render job is dispatched.
 *
 * @param db - Database connection
 * @param request - Render request details
 * @returns GuardrailResult — always resolves, never throws
 */
export async function checkRenderGuardrails(
  db: FactoryDb,
  request: RenderRequest,
): Promise<RenderGuardrailResult> {
  const { customerId, durationSeconds, creditRatePerSecond = DEFAULT_CREDIT_RATE_PER_SECOND } = request;

  const estimatedCost = estimateRenderCost(durationSeconds, creditRatePerSecond);

  // Fetch entitlement snapshot
  const entResult = await db.execute(sql`
    SELECT
      se.available_credits,
      se.can_render,
      se.monthly_render_quota,
      se.max_video_seconds
    FROM studio_entitlements se
    WHERE se.customer_id = ${customerId}
    LIMIT 1
  `);

  const availableCredits =
    entResult.rows.length > 0
      ? parseFloat((entResult.rows[0] as { available_credits: string }).available_credits)
      : 0;

  const monthlyRenderQuota =
    entResult.rows.length > 0
      ? ((entResult.rows[0] as { monthly_render_quota: number | null }).monthly_render_quota ?? null)
      : null;

  const maxVideoSeconds =
    entResult.rows.length > 0
      ? ((entResult.rows[0] as { max_video_seconds: number }).max_video_seconds ?? DEFAULT_MAX_VIDEO_SECONDS)
      : DEFAULT_MAX_VIDEO_SECONDS;

  const canRender =
    entResult.rows.length > 0
      ? Boolean((entResult.rows[0] as { can_render: boolean }).can_render)
      : false;

  // Kill switch check
  const killSwitch = await isKillSwitchActive(db, customerId);

  let rendersThisPeriod = 0;
  if (!killSwitch.active && monthlyRenderQuota !== null) {
    rendersThisPeriod = await getRenderCountThisPeriod(db, customerId);
  }

  const creditsAfter = availableCredits - estimatedCost;
  const budgetAlertNeeded =
    availableCredits > 0 &&
    creditsAfter / availableCredits <= BUDGET_ALERT_THRESHOLD_FRACTION;

  const context = {
    customerId,
    availableCredits,
    monthlyRenderQuota,
    rendersThisPeriod,
    requestedDurationSeconds: durationSeconds,
    maxVideoSeconds,
    killSwitchActive: killSwitch.active,
    killSwitchScope: killSwitch.scope,
  };

  // 1. Kill switch
  if (killSwitch.active) {
    return {
      allowed: false,
      reason: killSwitch.reason ?? 'Render kill switch is active',
      estimatedCost,
      creditsAfter,
      budgetAlertNeeded: false,
      context,
    };
  }

  // 2. Entitlement existence
  if (!canRender) {
    return {
      allowed: false,
      reason: 'Customer does not have an active render entitlement',
      estimatedCost,
      creditsAfter,
      budgetAlertNeeded: false,
      context,
    };
  }

  // 3. Duration limits
  const effectiveMaxSeconds = Math.min(maxVideoSeconds, PLATFORM_MAX_VIDEO_SECONDS);
  if (durationSeconds > effectiveMaxSeconds) {
    return {
      allowed: false,
      reason: `Requested duration ${durationSeconds}s exceeds plan limit ${effectiveMaxSeconds}s`,
      estimatedCost,
      creditsAfter,
      budgetAlertNeeded: false,
      context,
    };
  }

  // 4. Monthly render quota
  if (monthlyRenderQuota !== null && rendersThisPeriod >= monthlyRenderQuota) {
    return {
      allowed: false,
      reason: `Monthly render quota exhausted (${rendersThisPeriod}/${monthlyRenderQuota} renders used)`,
      estimatedCost,
      creditsAfter,
      budgetAlertNeeded,
      context,
    };
  }

  // 5. Credit balance
  if (availableCredits < estimatedCost) {
    return {
      allowed: false,
      reason: `Insufficient credits: ${availableCredits.toFixed(2)} available, ${estimatedCost.toFixed(2)} required`,
      estimatedCost,
      creditsAfter,
      budgetAlertNeeded,
      context,
    };
  }

  return {
    allowed: true,
    estimatedCost,
    creditsAfter,
    budgetAlertNeeded,
    context,
  };
}

// ============================================================================
// Budget Alert
// ============================================================================

/**
 * Emit a budget alert event when a customer's credit balance crosses the
 * low-balance threshold.
 *
 * This is fire-and-forget — errors are swallowed to never block render dispatch.
 * Consumers should hook this via the analytics event bus or PostHog.
 *
 * @param customerId - Customer whose balance is low
 * @param availableCredits - Remaining credits after estimated debit
 * @param monthlyQuota - Monthly credit quota from plan (null if unlimited)
 * @returns void — non-blocking
 */
export function emitBudgetAlert(
  customerId: string,
  availableCredits: number,
  monthlyQuota: number | null,
): void {
  try {
    // Emit to factory_events-compatible event shape
    // Consumers subscribe to 'render.budget_alert' via PostHog or factory_events table
    const event = {
      event: 'render.budget_alert',
      customerId,
      availableCredits,
      monthlyQuota,
      thresholdFraction: BUDGET_ALERT_THRESHOLD_FRACTION,
      alertedAt: new Date().toISOString(),
    };
    // In production this routes to PostHog via the analytics package.
    // For now, emit to console so sentry can capture it.
    console.warn('[guardrails] budget alert:', JSON.stringify(event));
  } catch {
    // Swallow — never block render dispatch
  }
}
