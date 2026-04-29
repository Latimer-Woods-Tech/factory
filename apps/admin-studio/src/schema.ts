/**
 * Drizzle table definitions for Admin Studio's operator database.
 *
 * These tables support creator onboarding, payout operations, and the
 * dead-letter queue for failed transfers. All timestamps are UTC.
 *
 * Migrations live in apps/admin-studio/migrations/.
 */
import { pgTable, text, integer, real, timestamp } from 'drizzle-orm/pg-core';

// ── Creator accounts ────────────────────────────────────────────────────────

/**
 * Platform creators (one row per user who can receive payouts).
 *
 * Joined to `creator_connections` for Stripe data and to `payouts` for
 * payment history.
 */
export const creators = pgTable('creators', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default(''),
  stripeConnectedAccountId: text('stripe_connected_account_id'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

/**
 * Stripe Connect onboarding state per creator.
 *
 * `onboardingStatus` lifecycle:
 *   not_started → submitted → verified | rejected
 */
export const creatorConnections = pgTable('creator_connections', {
  creatorId: text('creator_id').primaryKey(),
  stripeAccountId: text('stripe_account_id'),
  onboardingStatus: text('onboarding_status').notNull().default('not_started'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  lastVerificationAttempt: timestamp('last_verification_attempt', { withTimezone: true }),
  verificationAttempts: integer('verification_attempts').default(0),
  errorMessage: text('error_message'),
});

// ── Payout operations ───────────────────────────────────────────────────────

/**
 * Payout batch — one row per settlement period.
 *
 * `status` lifecycle: pending → processing → completed | partially_completed
 */
export const payoutBatches = pgTable('payout_batches', {
  id: text('id').primaryKey(),
  periodDate: timestamp('period_date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pending'),
  creatorCount: integer('creator_count').notNull().default(0),
  totalAmount: real('total_amount').notNull().default(0),
  succeededCount: integer('succeeded_count').default(0),
  failedCount: integer('failed_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

/**
 * Individual payout row — one per creator per batch.
 *
 * `status` lifecycle: pending → succeeded | failed
 */
export const payouts = pgTable('payouts', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  creatorId: text('creator_id').notNull(),
  amountUsd: real('amount_usd').notNull(),
  status: text('status').notNull().default('pending'),
  error: text('error'),
  stripeTransferId: text('stripe_transfer_id'),
  retryCount: integer('retry_count').default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

/**
 * Dead-letter queue for failed payout transfers.
 *
 * Operator retries and resolutions are recorded here.
 */
export const payoutDlq = pgTable('payout_dlq', {
  id: text('id').primaryKey(),
  payoutId: text('payout_id').notNull(),
  batchId: text('batch_id').notNull(),
  creatorId: text('creator_id').notNull(),
  amountUsd: real('amount_usd').notNull(),
  errorReason: text('error_reason').notNull(),
  suggestedAction: text('suggested_action'),
  resolutionStatus: text('resolution_status').notNull().default('pending'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }),
});

/**
 * Payout audit trail — immutable event log for operator actions.
 */
export const payoutAuditLog = pgTable('payout_audit_log', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  operatorId: text('operator_id').notNull(),
  action: text('action').notNull(),
  description: text('description').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
});
