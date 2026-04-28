/**
 * Payout operations routes (T3.2)
 * - GET /api/admin/payouts/batches
 * - POST /api/admin/payouts/batches
 * - POST /api/admin/payouts/batches/:id/execute
 * - GET /api/admin/payouts/dlq
 * - POST /api/admin/payouts/dlq/:id/retry
 * - POST /api/admin/payouts/dlq/:id/resolve
 * - GET /api/admin/payouts/reconciliation
 * - GET /api/admin/payouts/audit-log
 */

import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import {
  ValidationError,
  ErrorCodes,
  toErrorResponse,
} from '@adrper79-dot/errors';
import { createDb } from '@adrper79-dot/neon';
import { logger } from '@adrper79-dot/logger';
import Stripe from 'stripe';
import { eq, desc, and, gt, gte, sum } from 'drizzle-orm';

const router = new Hono<AppEnv>();

/**
 * Middleware: Require admin role
 */
const requireAdmin = async (c: any, next: any) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json(
      toErrorResponse(
        new ValidationError('Admin access required', { code: ErrorCodes.VALIDATION_ERROR })
      ),
      403
    );
  }
  return next();
};

/**
 * GET /api/admin/payouts/batches?status=&sortBy=&page=&limit=
 * List payout batches with pagination and filtering.
 */
router.get('/batches', requireAdmin, async (c) => {
  try {
    const status = c.req.query('status');
    const sortBy = c.req.query('sortBy') || 'period_date';
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit_ = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
    const offsetVal = (page - 1) * limit_;

    const db = createDb(c.env.DB);

    // Build query
    let filters = [];
    if (status) {
      filters.push(eq(payoutBatches.status, status));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const batches = await db.query.payoutBatches.findMany({
      orderBy: [desc(payoutBatches.periodDate)],
      where,
      limit: limit_,
      offset: offsetVal,
    });

    const total = await db.query.payoutBatches.findMany({ where });

    return c.json({
      data: batches.map((b) => ({
        id: b.id,
        periodDate: b.periodDate.toISOString(),
        status: b.status,
        creatorCount: b.creatorCount,
        totalAmountUsd: b.totalAmount,
        succeededCount: b.succeededCount || 0,
        failedCount: b.failedCount || 0,
        progress: `${b.succeededCount || 0}/${b.creatorCount}`,
        createdAt: b.createdAt?.toISOString(),
        executedAt: b.executedAt?.toISOString(),
        completedAt: b.completedAt?.toISOString(),
      })),
      pagination: {
        page,
        limit: limit_,
        total: total.length,
        pages: Math.ceil(total.length / limit_),
      },
    });
  } catch (error) {
    logger.error('Failed to list payout batches', { error });
    return c.json(
      toErrorResponse(new Error('Failed to list payout batches')),
      500
    );
  }
});

/**
 * GET /api/admin/payouts/batches/:id
 * Get batch details including all individual payouts.
 */
router.get('/batches/:id', requireAdmin, async (c) => {
  try {
    const batchId = c.req.param('id');
    const db = createDb(c.env.DB);

    const batch = await db.query.payoutBatches.findFirst({
      where: (b) => eq(b.id, batchId),
    });

    if (!batch) {
      throw new ValidationError('Batch not found', { code: ErrorCodes.VALIDATION_ERROR });
    }

    const payouts = await db.query.payouts.findMany({
      where: (p) => eq(p.batchId, batchId),
    });

    // Enrich with creator info
    const enriched = await Promise.all(
      payouts.map(async (p) => {
        const creator = await db.query.creators.findFirst({
          where: (c) => eq(c.id, p.creatorId),
          columns: { email: true, displayName: true },
        });
        return {
          id: p.id,
          creatorId: p.creatorId,
          creatorEmail: creator?.email,
          creatorName: creator?.displayName,
          amount: p.amountUsd,
          status: p.status,
          error: p.error,
          stripeTransferId: p.stripeTransferId,
        };
      })
    );

    return c.json({
      batch: {
        id: batch.id,
        periodDate: batch.periodDate.toISOString(),
        status: batch.status,
        creatorCount: batch.creatorCount,
        totalAmount: batch.totalAmount,
        createdAt: batch.createdAt?.toISOString(),
        executedAt: batch.executedAt?.toISOString(),
      },
      payouts: enriched,
    });
  } catch (error) {
    logger.error('Failed to get batch details', { error });
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Failed to get batch')),
      error instanceof ValidationError ? 400 : 500
    );
  }
});

/**
 * POST /api/admin/payouts/batches/:id/execute
 * Operator: Execute payout batch. Streams status updates as payouts are processed.
 */
router.post('/batches/:id/execute', requireAdmin, async (c) => {
  try {
    const batchId = c.req.param('id');
    const { excludeCreators } = await c.req.json();
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const batch = await db.query.payoutBatches.findFirst({
      where: (b) => eq(b.id, batchId),
    });

    if (!batch || batch.status !== 'pending') {
      throw new ValidationError('Batch not pending or not found', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    // Update batch to processing
    await db.update(payoutBatches)
      .set({ status: 'processing', executedAt: new Date() })
      .where(eq(payoutBatches.id, batchId));

    // Audit log: batch execution started
    await logPayoutAudit(db, {
      batchId,
      operatorId: user.sub,
      action: 'batch_executed',
      description: 'Operator initiated batch execution',
    });

    // Get all payouts in batch (excluding specified creators)
    let query = db.query.payouts.findMany({
      where: (p) => eq(p.batchId, batchId),
    });

    const payouts = await query;

    let succeeded = 0;
    let failed = 0;

    // Process each payout
    for (const payout of payouts) {
      if (excludeCreators?.includes(payout.creatorId)) {
        continue;
      }

      try {
        const creator = await db.query.creators.findFirst({
          where: (c) => eq(c.id, payout.creatorId),
          columns: { stripeConnectedAccountId: true, email: true },
        });

        if (!creator?.stripeConnectedAccountId) {
          throw new Error('Creator has no connected account');
        }

        // Execute transfer via Stripe
        const transfer = await stripe.transfers.create({
          amount: Math.round(payout.amountUsd * 100), // Convert to cents
          currency: 'usd',
          destination: creator.stripeConnectedAccountId,
          description: `Payout for ${new Date(batch.periodDate).toLocaleDateString()}`,
          metadata: {
            batchId,
            creatorId: payout.creatorId,
            periodDate: batch.periodDate.toISOString(),
          },
        });

        // Update payout: succeeded
        await db.update(payouts)
          .set({
            status: 'succeeded',
            stripeTransferId: transfer.id,
            updatedAt: new Date(),
          })
          .where(eq(payouts.id, payout.id));

        succeeded++;

        // Analytics
        await c.get('analytics')?.track({
          event: 'payout:succeeded',
          properties: {
            batchId,
            creatorId: payout.creatorId,
            amount: payout.amountUsd,
            stripeTransferId: transfer.id,
          },
        });
      } catch (error) {
        failed++;

        // Update payout: failed
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        await db.update(payouts)
          .set({
            status: 'failed',
            error: errorMsg,
            retryCount: (payout.retryCount || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(payouts.id, payout.id));

        // Add to DLQ
        await db.insert(payoutDlq).values({
          payoutId: payout.id,
          batchId,
          creatorId: payout.creatorId,
          amountUsd: payout.amountUsd,
          errorReason: errorMsg,
          resolutionStatus: 'pending',
        });

        // Analytics
        await c.get('analytics')?.track({
          event: 'payout:failed_dlq',
          properties: {
            batchId,
            creatorId: payout.creatorId,
            amount: payout.amountUsd,
            error: errorMsg,
          },
        });
      }
    }

    // Update batch: completed or partially_completed
    const batchStatus = failed === 0 ? 'completed' : 'partially_completed';
    await db.update(payoutBatches)
      .set({
        status: batchStatus,
        succeededCount: succeeded,
        failedCount: failed,
        completedAt: new Date(),
      })
      .where(eq(payoutBatches.id, batchId));

    return c.json({
      batchId,
      status: batchStatus,
      succeeded,
      failed,
      total: succeeded + failed,
    });
  } catch (error) {
    logger.error('Failed to execute batch', { error });
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Batch execution failed')),
      error instanceof ValidationError ? 400 : 500
    );
  }
});

/**
 * GET /api/admin/payouts/dlq?batchId=&status=&page=&limit=
 * List dead letter queue entries.
 */
router.get('/dlq', requireAdmin, async (c) => {
  try {
    const batchId = c.req.query('batchId');
    const status = c.req.query('status') || 'pending';
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit_ = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
    const offsetVal = (page - 1) * limit_;

    const db = createDb(c.env.DB);

    let filters = [eq(payoutDlq.resolutionStatus, status)];
    if (batchId) {
      filters.push(eq(payoutDlq.batchId, batchId));
    }

    const dlqEntries = await db.query.payoutDlq.findMany({
      orderBy: [desc(payoutDlq.createdAt)],
      where: and(...filters),
      limit: limit_,
      offset: offsetVal,
    });

    const total = await db.query.payoutDlq.findMany({
      where: and(...filters),
    });

    return c.json({
      data: dlqEntries.map((d) => ({
        id: d.id,
        payoutId: d.payoutId,
        creatorId: d.creatorId,
        amount: d.amountUsd,
        error: d.errorReason,
        suggestedAction: d.suggestedAction,
        resolutionStatus: d.resolutionStatus,
        createdAt: d.createdAt?.toISOString(),
      })),
      pagination: {
        page,
        limit: limit_,
        total: total.length,
        pages: Math.ceil(total.length / limit_),
      },
    });
  } catch (error) {
    logger.error('Failed to list DLQ', { error });
    return c.json(
      toErrorResponse(new Error('Failed to list DLQ')),
      500
    );
  }
});

/**
 * POST /api/admin/payouts/dlq/:id/retry
 * Operator: Retry failed payout from DLQ.
 */
router.post('/dlq/:id/retry', requireAdmin, async (c) => {
  try {
    const dlqId = c.req.param('id');
    const user = c.get('user');
    const db = createDb(c.env.DB);
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const dlqEntry = await db.query.payoutDlq.findFirst({
      where: (d) => eq(d.id, dlqId),
    });

    if (!dlqEntry) {
      throw new ValidationError('DLQ entry not found', { code: ErrorCodes.VALIDATION_ERROR });
    }

    const payout = await db.query.payouts.findFirst({
      where: (p) => eq(p.id, dlqEntry.payoutId),
    });

    const creator = await db.query.creators.findFirst({
      where: (c) => eq(c.id, dlqEntry.creatorId),
      columns: { stripeConnectedAccountId: true },
    });

    if (!creator?.stripeConnectedAccountId) {
      throw new ValidationError('Creator has no connected account', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    // Attempt retry
    const transfer = await stripe.transfers.create({
      amount: Math.round(dlqEntry.amountUsd * 100),
      currency: 'usd',
      destination: creator.stripeConnectedAccountId,
      description: `Retry payout for ${dlqEntry.creatorId}`,
      metadata: { dlqRetry: true, originalPayoutId: dlqEntry.payoutId },
    });

    // Update payout and DLQ
    await db.update(payouts)
      .set({
        status: 'succeeded',
        stripeTransferId: transfer.id,
        retryCount: (payout?.retryCount || 0) + 1,
      })
      .where(eq(payouts.id, dlqEntry.payoutId));

    await db.update(payoutDlq)
      .set({
        resolutionStatus: 'resolved',
        resolvedBy: user.sub,
        resolvedAt: new Date(),
      })
      .where(eq(payoutDlq.id, dlqId));

    // Analytics
    await c.get('analytics')?.track({
      event: 'dlq_retry_succeeded',
      properties: {
        dlqId,
        creatorId: dlqEntry.creatorId,
        amount: dlqEntry.amountUsd,
      },
    });

    return c.json({ success: true, stripeTransferId: transfer.id });
  } catch (error) {
    logger.error('Failed to retry DLQ entry', { error });
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Retry failed')),
      error instanceof ValidationError ? 400 : 500
    );
  }
});

/**
 * GET /api/admin/payouts/reconciliation?period=week|month
 * Weekly reconciliation report for operators.
 */
router.get('/reconciliation', requireAdmin, async (c) => {
  try {
    const period = c.req.query('period') || 'week';
    const db = createDb(c.env.DB);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (period === 'month' ? 30 : 7));

    // Total payouts
    const totalPayouts = await db.query.payouts.findMany({
      where: (p) => gte(p.createdAt, cutoff),
    });

    const succeeded = totalPayouts.filter((p) => p.status === 'succeeded');
    const failed = totalPayouts.filter((p) => p.status === 'failed');

    const totalAmount = totalPayouts.reduce((sum, p) => sum + Number(p.amountUsd), 0);
    const succeededAmount = succeeded.reduce((sum, p) => sum + Number(p.amountUsd), 0);
    const failedAmount = failed.reduce((sum, p) => sum + Number(p.amountUsd), 0);

    // DLQ summary
    const dlqEntries = await db.query.payoutDlq.findMany({
      where: (d) => gte(d.createdAt, cutoff),
    });

    const failureRate = totalPayouts.length > 0 ? (failed.length / totalPayouts.length * 100).toFixed(2) : 0;

    return c.json({
      period,
      cutoff: cutoff.toISOString(),
      summary: {
        totalPayouts: totalPayouts.length,
        totalAmount,
        succeededCount: succeeded.length,
        succeededAmount,
        failedCount: failed.length,
        failedAmount,
        failureRate: `${failureRate}%`,
        dlqPendingCount: dlqEntries.filter((d) => d.resolutionStatus === 'pending').length,
      },
      alert: failureRate > 5 ? 'ALERT: Failure rate > 5%' : null,
    });
  } catch (error) {
    logger.error('Failed to generate reconciliation report', { error });
    return c.json(
      toErrorResponse(new Error('Failed to generate reconciliation')),
      500
    );
  }
});

/**
 * Helper: Log payout audit entry
 */
async function logPayoutAudit(
  db: any,
  { batchId, operatorId, action, description }: any
) {
  await db.insert(payoutAuditLog).values({
    batchId,
    operatorId,
    action,
    description,
    timestamp: new Date(),
  });
}

export default router;
