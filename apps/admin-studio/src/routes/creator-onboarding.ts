/**
 * Creator onboarding routes (T3.1)
 * - GET /api/creator/onboarding/status
 * - PUT /api/creator/onboarding/verify
 * - POST /api/creator/onboarding/resubmit
 * - POST /api/creator/onboarding/start
 * - GET /api/creator/onboarding/callback
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
import { eq } from 'drizzle-orm';

const router = new Hono<AppEnv>();

/**
 * GET /api/creator/onboarding/status
 * Returns the current Stripe Connect onboarding status for the authenticated creator.
 */
router.get('/status', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        toErrorResponse(
          new ValidationError('Unauthorized', { code: ErrorCodes.VALIDATION_ERROR })
        ),
        401
      );
    }

    const db = createDb(c.env.DB);
    
    // Fetch creator's Stripe connection status
    const creatorConnection = await db.query.creatorConnections.findFirst({
      where: (cc) => eq(cc.creatorId, user.sub),
    });

    if (!creatorConnection) {
      return c.json({
        status: 'not_started',
        stripeConnectId: null,
        lastUpdate: null,
        nextAction: 'start_oauth',
      });
    }

    return c.json({
      status: creatorConnection.onboardingStatus,
      stripeConnectId: creatorConnection.stripeAccountId,
      lastUpdate: creatorConnection.lastVerificationAttempt?.toISOString() || creatorConnection.submittedAt?.toISOString(),
      nextAction: getNextAction(creatorConnection.onboardingStatus),
      errorMessage: creatorConnection.errorMessage,
      verifiedAt: creatorConnection.verifiedAt?.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get onboarding status', { error });
    return c.json(
      toErrorResponse(new Error('Failed to get onboarding status')),
      500
    );
  }
});

/**
 * POST /api/creator/onboarding/start
 * Initiates Stripe Connect OAuth flow by generating state and redirect URL.
 */
router.post('/start', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        toErrorResponse(
          new ValidationError('Unauthorized', { code: ErrorCodes.VALIDATION_ERROR })
        ),
        401
      );
    }

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Check if creator already has a connected account
    const db = createDb(c.env.DB);
    const existingConnection = await db.query.creatorConnections.findFirst({
      where: (cc) => eq(cc.creatorId, user.sub),
    });

    if (existingConnection?.stripeAccountId) {
      return c.json(
        toErrorResponse(
          new ValidationError('Creator already has a connected account', {
            code: ErrorCodes.VALIDATION_ERROR,
          })
        ),
        400
      );
    }

    // Generate OAuth state for CSRF protection
    const state = crypto.getRandomValues(new Uint8Array(32));
    const stateString = Array.from(state)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Store state in cache (TODO: use Redis or Durable Objects)
    // For now, store in metadata for temporary use
    const returnUrl = `${c.env.APP_URL}/creator/onboarding/callback`;

    // Create Stripe Connect login link
    const stripeAuthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${c.env.STRIPE_PUBLISHABLE_KEY}&scope=read_write&redirect_uri=${returnUrl}&state=${stateString}`;

    // Log analytics event
    await c.get('analytics')?.track({
      event: 'creator:stripe_connect_started',
      properties: {
        creatorId: user.sub,
        timestamp: new Date().toISOString(),
      },
    });

    return c.json({ authUrl: stripeAuthUrl, state: stateString });
  } catch (error) {
    logger.error('Failed to start Stripe onboarding', { error });
    return c.json(
      toErrorResponse(new Error('Failed to start Stripe onboarding')),
      500
    );
  }
});

/**
 * GET /api/creator/onboarding/callback?code=&state=
 * Handles OAuth callback from Stripe Connect.
 */
router.get('/callback', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        toErrorResponse(
          new ValidationError('Unauthorized', { code: ErrorCodes.VALIDATION_ERROR })
        ),
        401
      );
    }

    const code = c.req.query('code');
    const state = c.req.query('state');

    if (!code || !state) {
      throw new ValidationError('Missing OAuth code or state', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Exchange authorization code for Stripe account ID
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    if (!response.stripe_user_id) {
      throw new ValidationError('Failed to get Stripe account ID', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const db = createDb(c.env.DB);

    // Store Stripe account ID
    await db.update(creatorConnections)
      .set({
        stripeAccountId: response.stripe_user_id,
        onboardingStatus: 'submitted',
        submittedAt: new Date(),
      })
      .where(eq(creatorConnections.creatorId, user.sub));

    // Log analytics event
    await c.get('analytics')?.track({
      event: 'creator:stripe_oauth_completed',
      properties: {
        creatorId: user.sub,
        stripeAccountId: response.stripe_user_id,
        timestamp: new Date().toISOString(),
      },
    });

    // Redirect to settings page
    return c.redirect(`${c.env.APP_URL}/creator/settings?stripe_connected=true`);
  } catch (error) {
    logger.error('OAuth callback failed', { error });
    return c.redirect(
      `${c.env.APP_URL}/creator/settings?stripe_error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Unknown error'
      )}`
    );
  }
});

/**
 * PUT /api/creator/onboarding/verify
 * Creator confirms they're ready for payouts. Once verified, included in next batch.
 * Idempotent: calling multiple times is safe.
 */
router.put('/verify', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        toErrorResponse(
          new ValidationError('Unauthorized', { code: ErrorCodes.VALIDATION_ERROR })
        ),
        401
      );
    }

    const db = createDb(c.env.DB);
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get creator connection
    const connection = await db.query.creatorConnections.findFirst({
      where: (cc) => eq(cc.creatorId, user.sub),
    });

    if (!connection?.stripeAccountId) {
      throw new ValidationError('No Stripe account connected', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    // Fetch latest account status from Stripe
    const account = await stripe.accounts.retrieve(connection.stripeAccountId);

    if (!account.charges_enabled || !account.payouts_enabled) {
      throw new ValidationError('Stripe account not fully verified', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    // Update connection status
    await db.update(creatorConnections)
      .set({
        onboardingStatus: 'verified',
        verifiedAt: new Date(),
        lastVerificationAttempt: new Date(),
        errorMessage: null,
      })
      .where(eq(creatorConnections.creatorId, user.sub));

    // Log analytics event
    await c.get('analytics')?.track({
      event: 'creator:account_verified',
      properties: {
        creatorId: user.sub,
        stripeAccountId: connection.stripeAccountId,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        timestamp: new Date().toISOString(),
      },
    });

    return c.json({
      status: 'verified',
      message: 'Your Stripe account is verified and ready for payouts',
    });
  } catch (error) {
    logger.error('Verification failed', { error });
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Verification failed')),
      error instanceof ValidationError ? 400 : 500
    );
  }
});

/**
 * POST /api/creator/onboarding/resubmit
 * Creator resubmits if initial submission failed.
 */
router.post('/resubmit', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json(
        toErrorResponse(
          new ValidationError('Unauthorized', { code: ErrorCodes.VALIDATION_ERROR })
        ),
        401
      );
    }

    const db = createDb(c.env.DB);
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const connection = await db.query.creatorConnections.findFirst({
      where: (cc) => eq(cc.creatorId, user.sub),
    });

    if (!connection?.stripeAccountId) {
      throw new ValidationError('No Stripe account to resubmit', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    // Fetch latest account status
    const account = await stripe.accounts.retrieve(connection.stripeAccountId);

    // Update status based on Stripe account state
    const newStatus = account.charges_enabled && account.payouts_enabled
      ? 'verified'
      : 'submitted';

    const errorMessage = account.requirements?.pending?.length
      ? `Pending requirements: ${account.requirements.pending.join(', ')}`
      : null;

    await db.update(creatorConnections)
      .set({
        onboardingStatus: newStatus,
        lastVerificationAttempt: new Date(),
        errorMessage,
        verifiedAt: newStatus === 'verified' ? new Date() : undefined,
      })
      .where(eq(creatorConnections.creatorId, user.sub));

    return c.json({
      status: newStatus,
      errorMessage,
      requirementsPending: account.requirements?.pending || [],
    });
  } catch (error) {
    logger.error('Resubmit failed', { error });
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Resubmit failed')),
      error instanceof ValidationError ? 400 : 500
    );
  }
});

/**
 * Helper function to determine next action based on onboarding status
 */
function getNextAction(status: string): string {
  switch (status) {
    case 'pending':
      return 'start_oauth';
    case 'submitted':
      return 'complete_stripe_setup';
    case 'verified':
      return 'ready_for_payouts';
    case 'processing':
      return 'check_status_later';
    case 'rejected':
      return 'contact_support';
    default:
      return 'unknown';
  }
}

export default router;
