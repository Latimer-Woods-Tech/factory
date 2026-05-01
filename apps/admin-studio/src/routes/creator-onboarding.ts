/**
 * Creator onboarding routes (T3.1)
 * - GET /api/creator/onboarding/status
 * - PUT /api/creator/onboarding/verify
 * - POST /api/creator/onboarding/resubmit
 * - POST /api/creator/onboarding/start
 * - GET /api/creator/onboarding/callback
 *
 * Auth: envContextMiddleware provides c.var.envContext with userId + role.
 * Stripe keys are expected in c.env.STRIPE_SECRET_KEY (secret) and
 * c.env.STRIPE_PUBLISHABLE_KEY (public key for OAuth URLs).
 */
import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import { ValidationError, ErrorCodes, toErrorResponse } from '@latimer-woods-tech/errors';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import {
  createAdminDb,
  creatorConnections,
} from '../lib/admin-db.js';

const router = new Hono<AppEnv>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNextAction(status: string): string {
  switch (status) {
    case 'not_started':  return 'start_oauth';
    case 'submitted':    return 'verify_account';
    case 'verified':     return 'ready_for_payouts';
    case 'rejected':     return 'contact_support';
    default:             return 'start_oauth';
  }
}

function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/creator/onboarding/status
 * Returns the current Stripe Connect onboarding status for the authed creator.
 */
router.get('/status', async (c) => {
  try {
    const ctx = c.var.envContext;
    const db = createAdminDb(c.env.DB);

    const creatorConn = await db.query.creatorConnections.findFirst({
      where: (cc) => eq(cc.creatorId, ctx.userId),
    });

    if (!creatorConn) {
      return c.json({
        status: 'not_started',
        stripeConnectId: null,
        lastUpdate: null,
        nextAction: 'start_oauth',
      });
    }

    return c.json({
      status: creatorConn.onboardingStatus,
      stripeConnectId: creatorConn.stripeAccountId,
      lastUpdate:
        creatorConn.lastVerificationAttempt?.toISOString() ??
        creatorConn.submittedAt?.toISOString() ??
        null,
      nextAction: getNextAction(creatorConn.onboardingStatus),
      errorMessage: creatorConn.errorMessage,
      verifiedAt: creatorConn.verifiedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('[creator-onboarding] get status failed:', error);
    return c.json(toErrorResponse(new Error('Failed to get onboarding status')), 500);
  }
});

/**
 * POST /api/creator/onboarding/start
 * Initiates Stripe Connect OAuth flow by generating a redirect URL.
 */
router.post('/start', async (c) => {
  try {
    const ctx = c.var.envContext;
    const secretKey = c.env.STRIPE_SECRET_KEY;
    const publishableKey = c.env.STRIPE_PUBLISHABLE_KEY;
    const appUrl = c.env.APP_URL ?? '';

    if (!secretKey || !publishableKey) {
      return c.json(
        toErrorResponse(
          new ValidationError('Stripe not configured', { code: ErrorCodes.VALIDATION_ERROR }),
        ),
        503,
      );
    }

    const db = createAdminDb(c.env.DB);

    const existing = await db.query.creatorConnections.findFirst({
      where: (cc) => eq(cc.creatorId, ctx.userId),
    });

    if (existing?.stripeAccountId) {
      return c.json(
        toErrorResponse(
          new ValidationError('Creator already has a connected account', {
            code: ErrorCodes.VALIDATION_ERROR,
          }),
        ),
        400,
      );
    }

    // CSRF state — 32 cryptographically random bytes as hex
    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, '0')).join('');

    const returnUrl = `${appUrl}/creator/onboarding/callback`;
    const authUrl =
      `https://connect.stripe.com/oauth/authorize` +
      `?response_type=code&client_id=${publishableKey}&scope=read_write` +
      `&redirect_uri=${encodeURIComponent(returnUrl)}&state=${state}`;

    console.info('[creator-onboarding] OAuth started', { creatorId: ctx.userId });

    return c.json({ authUrl, state });
  } catch (error) {
    console.error('[creator-onboarding] start failed:', error);
    return c.json(toErrorResponse(new Error('Failed to start Stripe onboarding')), 500);
  }
});

/**
 * GET /api/creator/onboarding/callback?code=&state=
 * Handles OAuth callback from Stripe Connect.
 */
router.get('/callback', async (c) => {
  const appUrl = c.env.APP_URL ?? '';
  try {
    const ctx = c.var.envContext;
    const code = c.req.query('code');
    const state = c.req.query('state');

    if (!code || !state) {
      throw new ValidationError('Missing OAuth code or state', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const secretKey = c.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return c.json(
        toErrorResponse(
          new ValidationError('Stripe not configured', { code: ErrorCodes.VALIDATION_ERROR }),
        ),
        503,
      );
    }

    const stripe = getStripe(secretKey);
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    if (!response.stripe_user_id) {
      throw new ValidationError('Failed to get Stripe account ID from OAuth', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const db = createAdminDb(c.env.DB);

    await db
      .update(creatorConnections)
      .set({
        stripeAccountId: response.stripe_user_id,
        onboardingStatus: 'submitted',
        submittedAt: new Date(),
      })
      .where(eq(creatorConnections.creatorId, ctx.userId));

    console.info('[creator-onboarding] OAuth completed', {
      creatorId: ctx.userId,
      stripeAccountId: response.stripe_user_id,
    });

    return c.redirect(`${appUrl}/creator/settings?stripe_connected=true`);
  } catch (error) {
    console.error('[creator-onboarding] callback failed:', error);
    return c.redirect(
      `${appUrl}/creator/settings?stripe_error=${encodeURIComponent(
        error instanceof Error ? error.message : 'Unknown error',
      )}`,
    );
  }
});

/**
 * PUT /api/creator/onboarding/verify
 * Creator confirms they are ready for payouts after linking Stripe.
 * Idempotent — safe to call multiple times.
 */
router.put('/verify', async (c) => {
  try {
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
      where: (cc) => eq(cc.creatorId, ctx.userId),
    });

    if (!connection?.stripeAccountId) {
      throw new ValidationError('No Stripe account connected', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const account = await stripe.accounts.retrieve(connection.stripeAccountId);

    if (!account.charges_enabled || !account.payouts_enabled) {
      throw new ValidationError('Stripe account not fully verified', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    await db
      .update(creatorConnections)
      .set({
        onboardingStatus: 'verified',
        verifiedAt: new Date(),
        lastVerificationAttempt: new Date(),
        errorMessage: null,
      })
      .where(eq(creatorConnections.creatorId, ctx.userId));

    console.info('[creator-onboarding] account verified', {
      creatorId: ctx.userId,
      stripeAccountId: connection.stripeAccountId,
    });

    return c.json({
      status: 'verified',
      message: 'Stripe account verified and ready for payouts',
    });
  } catch (error) {
    console.error('[creator-onboarding] verify failed:', error);
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Verification failed')),
      error instanceof ValidationError ? 400 : 500,
    );
  }
});

/**
 * POST /api/creator/onboarding/resubmit
 * Creator re-triggers verification after fixing Stripe requirements.
 */
router.post('/resubmit', async (c) => {
  try {
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
      where: (cc) => eq(cc.creatorId, ctx.userId),
    });

    if (!connection?.stripeAccountId) {
      throw new ValidationError('No Stripe account to resubmit', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const account = await stripe.accounts.retrieve(connection.stripeAccountId);

    const newStatus =
      account.charges_enabled && account.payouts_enabled ? 'verified' : 'submitted';

    // `currently_due` is the modern Stripe Requirements field (replaces deprecated `pending`)
    const requirementsPending = account.requirements?.currently_due ?? [];
    const errorMessage =
      requirementsPending.length > 0
        ? `Pending requirements: ${requirementsPending.join(', ')}`
        : null;

    await db
      .update(creatorConnections)
      .set({
        onboardingStatus: newStatus,
        lastVerificationAttempt: new Date(),
        verificationAttempts: (connection.verificationAttempts ?? 0) + 1,
        errorMessage,
        verifiedAt: newStatus === 'verified' ? new Date() : connection.verifiedAt,
      })
      .where(eq(creatorConnections.creatorId, ctx.userId));

    console.info('[creator-onboarding] resubmitted', { creatorId: ctx.userId, newStatus });

    return c.json({
      status: newStatus,
      requirementsPending,
      message:
        newStatus === 'verified'
          ? 'Account is now fully verified'
          : 'Resubmission recorded — pending Stripe review',
    });
  } catch (error) {
    console.error('[creator-onboarding] resubmit failed:', error);
    return c.json(
      toErrorResponse(error instanceof Error ? error : new Error('Resubmit failed')),
      error instanceof ValidationError ? 400 : 500,
    );
  }
});

export default router;
