/**
 * Admin routes for creator management
 * - GET /api/admin/creators/onboarding
 * - POST /api/admin/creators/:id/verify-stripe
 * - POST /api/admin/creators/:id/mark-ready-for-payout
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
import { eq, desc, limit, offset } from 'drizzle-orm';

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
 * GET /api/admin/creators/onboarding?status=&page=&limit=&sortBy=
 * List creators by onboarding status with pagination.
 */
router.get('/onboarding', requireAdmin, async (c) => {
  try {
    const status = c.req.query('status'); // Optional filter
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit_ = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
    const sortBy = c.req.query('sortBy') || 'submitted_at'; // submitted_at | verified_at | error

    const pageNum = Math.max(1, page);
    const offsetVal = (pageNum - 1) * limit_;

    const db = createDb(c.env.DB);

    let query = db.query.creatorConnections.findMany({
      orderBy: [
        sortBy === 'verified_at'
          ? desc(creatorConnections.verifiedAt)
          : desc(creatorConnections.submittedAt),
      ],
      limit: limit_,
      offset: offsetVal,
    });

    // Apply status filter if provided
    if (status) {
      query = query.where(
        eq(creatorConnections.onboardingStatus, status)
      );
    }

    const connections = await query;

    const total = await db.query.creatorConnections.findMany();

    // Enrich with creator info
    const enriched = await Promise.all(
      connections.map(async (conn) => {
        const creator = await db.query.creators.findFirst({
          where: (c) => eq(c.id, conn.creatorId),
          columns: { id: true, email: true, displayName: true },
        });

        return {
          creatorId: conn.creatorId,
          creatorEmail: creator?.email,
          creatorName: creator?.displayName,
          stripeAccountId: conn.stripeAccountId,
          status: conn.onboardingStatus,
          submittedAt: conn.submittedAt?.toISOString(),
          verifiedAt: conn.verifiedAt?.toISOString(),
          errorMessage: conn.errorMessage,
          lastVerificationAttempt: conn.lastVerificationAttempt?.toISOString(),
          verificationAttempts: conn.verificationAttempts,
        };
      })
    );

    return c.json({
      data: enriched,
      pagination: {
        page: pageNum,
        limit: limit_,
        total: total.length,
        pages: Math.ceil(total.length / limit_),
      },
    });
  } catch (error) {
    logger.error('Failed to list creators', { error });
    return c.json(
      toErrorResponse(new Error('Failed to list creators')),
      500
    );
  }
});

/**
 * POST /api/admin/creators/:id/verify-stripe
 * Operator: Verify Stripe account status by fetching from Stripe API.
 * Updates local status to match Stripe's current state.
 */
router.post('/:id/verify-stripe', requireAdmin, async (c) => {
  try {
    const creatorId = c.req.param('id');
    const db = createDb(c.env.DB);
    const user = c.get('user');
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const connection = await db.query.creatorConnections.findFirst({
      where: (cc) => eq(cc.creatorId, creatorId),
    });

    if (!connection?.stripeAccountId) {
      throw new ValidationError('No Stripe account for this creator', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    // Fetch latest from Stripe
    const account = await stripe.accounts.retrieve(connection.stripeAccountId);

    let newStatus = connection.onboardingStatus;
    let errorMessage = null;

    if (account.charges_enabled && account.payouts_enabled) {
      newStatus = 'verified';
    } else if (account.requirements?.past_due?.length) {
      newStatus = 'rejected';
      errorMessage = `Past due requirements: ${account.requirements.past_due.join(', ')}`;
    } else if (account.requirements?.pending?.length) {
      newStatus = 'submitted';
      errorMessage = `Pending requirements: ${account.requirements.pending.join(', ')}`;
    }

    // Update local status
    await db.update(creatorConnections)
      .set({
        onboardingStatus: newStatus,
        lastVerificationAttempt: new Date(),
        verificationAttempts: (connection.verificationAttempts || 0) + 1,
        errorMessage,
        verifiedAt: newStatus === 'verified' ? new Date() : undefined,
      })
      .where(eq(creatorConnections.creatorId, creatorId));

    // Log audit event
    await c.get('analytics')?.track({
      event: 'admin:creator_stripe_verified',
      properties: {
        operatorId: user.sub,
        creatorId,
        stripeAccountId: connection.stripeAccountId,
        status: newStatus,
        timestamp: new Date().toISOString(),
      },
    });

    return c.json({
      creatorId,
      stripeAccountId: connection.stripeAccountId,
      status: newStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirementsPending: account.requirements?.pending || [],
      requirementsPastDue: account.requirements?.past_due || [],
      errorMessage,
    });
  } catch (error) {
    logger.error('Failed to verify Stripe account', { error });
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Verification failed')),
      error instanceof ValidationError ? 400 : 500
    );
  }
});

/**
 * POST /api/admin/creators/:id/mark-ready-for-payout
 * Operator: Mark creator as ready for first payout after review.
 */
router.post('/:id/mark-ready-for-payout', requireAdmin, async (c) => {
  try {
    const creatorId = c.req.param('id');
    const { reason } = await c.req.json();
    const user = c.get('user');
    const db = createDb(c.env.DB);

    const connection = await db.query.creatorConnections.findFirst({
      where: (cc) => eq(cc.creatorId, creatorId),
    });

    if (!connection?.stripeAccountId) {
      throw new ValidationError('No Stripe account for this creator', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    if (connection.onboardingStatus !== 'verified') {
      throw new ValidationError(
        `Creator onboarding status is ${connection.onboardingStatus}, expected verified`,
        { code: ErrorCodes.VALIDATION_ERROR }
      );
    }

    // Update status to ready for payouts
    await db.update(creatorConnections)
      .set({
        onboardingStatus: 'processing', // Waiting for first payout batch
      })
      .where(eq(creatorConnections.creatorId, creatorId));

    // Audit log
    await c.get('analytics')?.track({
      event: 'admin:creator_marked_ready_for_payout',
      properties: {
        operatorId: user.sub,
        creatorId,
        reason,
        timestamp: new Date().toISOString(),
      },
    });

    return c.json({
      creatorId,
      status: 'processing',
      message: 'Creator marked ready for payouts',
    });
  } catch (error) {
    logger.error('Failed to mark creator ready', { error });
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Operation failed')),
      error instanceof ValidationError ? 400 : 500
    );
  }
});

export default router;
