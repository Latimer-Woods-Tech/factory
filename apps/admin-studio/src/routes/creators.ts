/**
 * Admin routes for creator management
 * - GET /api/admin/creators/onboarding
 * - POST /api/admin/creators/:id/verify-stripe
 * - POST /api/admin/creators/:id/mark-ready-for-payout
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';
import {
  ValidationError,
  ErrorCodes,
  toErrorResponse,
} from '@latimer-woods-tech/errors';
import Stripe from 'stripe';
import { eq, desc } from 'drizzle-orm';
import {
  createAdminDb,
  creatorConnections,
} from '../lib/admin-db.js';

const router = new Hono<AppEnv>();

/**
 * Middleware: Require admin or owner role
 */
const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const ctx = c.var.envContext;
  if (!ctx || (ctx.role !== 'admin' && ctx.role !== 'owner')) {
    return c.json(
      toErrorResponse(
        new ValidationError('Admin access required', { code: ErrorCodes.VALIDATION_ERROR }),
      ),
      403,
    );
  }
  return await next();
};

function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

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

    const db = createAdminDb(c.env.DB);

    const connections = await db.query.creatorConnections.findMany({
      orderBy: [
        sortBy === 'verified_at'
          ? desc(creatorConnections.verifiedAt)
          : desc(creatorConnections.submittedAt),
      ],
      where: status ? (cc) => eq(cc.onboardingStatus, status) : undefined,
      limit: limit_,
      offset: offsetVal,
    });

    const total = await db.query.creatorConnections.findMany({
      where: status ? (cc) => eq(cc.onboardingStatus, status) : undefined,
      columns: { creatorId: true },
    });

    // Enrich with creator info
    const enriched = await Promise.all(
      connections.map(async (conn) => {
        const creator = await db.query.creators.findFirst({
          where: (cr) => eq(cr.id, conn.creatorId),
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
    console.error('[creators] list onboarding failed:', error);
    return c.json(toErrorResponse(new Error('Failed to list creators')), 500);
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
    const ctx = c.var.envContext;
    const secretKey = c.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return c.json(
        toErrorResponse(
          new ValidationError('Stripe not configured', { code: ErrorCodes.VALIDATION_ERROR }),
        ),
        503,
      );
    }
    const db = createAdminDb(c.env.DB);
    const stripe = getStripe(secretKey);

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
    let errorMessage: string | null = null;

    if (account.charges_enabled && account.payouts_enabled) {
      newStatus = 'verified';
    } else if (account.requirements?.past_due?.length) {
      newStatus = 'rejected';
      errorMessage = `Past due requirements: ${account.requirements.past_due.join(', ')}`;
    } else if (account.requirements?.currently_due?.length) {
      newStatus = 'submitted';
      errorMessage = `Pending requirements: ${account.requirements.currently_due.join(', ')}`;
    }

    await db
      .update(creatorConnections)
      .set({
        onboardingStatus: newStatus,
        lastVerificationAttempt: new Date(),
        verificationAttempts: (connection.verificationAttempts ?? 0) + 1,
        errorMessage,
        verifiedAt: newStatus === 'verified' ? new Date() : connection.verifiedAt,
      })
      .where(eq(creatorConnections.creatorId, creatorId));

    console.info('[creators] stripe verified by operator', {
      operatorId: ctx.userId,
      creatorId,
      stripeAccountId: connection.stripeAccountId,
      newStatus,
    });

    return c.json({
      creatorId,
      stripeAccountId: connection.stripeAccountId,
      status: newStatus,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirementsPending: account.requirements?.currently_due ?? [],
      requirementsPastDue: account.requirements?.past_due ?? [],
      errorMessage,
    });
  } catch (error) {
    console.error('[creators] verify-stripe failed:', error);
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Verification failed')),
      error instanceof ValidationError ? 400 : 500,
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
    const { reason } = await c.req.json<{ reason?: string }>();
    const ctx = c.var.envContext;
    const db = createAdminDb(c.env.DB);

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

    await db
      .update(creatorConnections)
      .set({
        onboardingStatus: 'processing',
      })
      .where(eq(creatorConnections.creatorId, creatorId));

    console.info('[creators] creator marked ready for payout', {
      operatorId: ctx.userId,
      creatorId,
      reason,
    });

    return c.json({
      creatorId,
      status: 'processing',
      message: 'Creator marked ready for payouts',
    });
  } catch (error) {
    console.error('[creators] mark-ready-for-payout failed:', error);
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Operation failed')),
      error instanceof ValidationError ? 400 : 500,
    );
  }
});

export default router;
