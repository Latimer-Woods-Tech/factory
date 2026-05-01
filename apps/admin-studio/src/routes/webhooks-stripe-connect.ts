/**
 * Stripe Connect webhooks for creator account status updates
 * - account.updated: Status changes, verification completion
 */

import { Hono } from 'hono';
import type { AppEnv } from '../types.js';
import {
  ValidationError,
  ErrorCodes,
} from '@latimer-woods-tech/errors';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import {
  createAdminDb,
  creatorConnections,
} from '../lib/admin-db.js';

const router = new Hono<AppEnv>();

/**
 * POST /webhooks/stripe-connect
 * Handles Stripe Connect webhook events (account.updated, etc.)
 */
router.post('/', async (c) => {
  try {
    const body = await c.req.text();
    const signature = c.req.header('stripe-signature');

    if (!signature) {
      throw new ValidationError('Missing Stripe signature', {
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    const secretKey = c.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return c.json({ received: false, error: 'Stripe not configured' }, 503);
    }
    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        c.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? '',
      );
    } catch (error) {
      console.warn('[webhooks-stripe] signature verification failed:', error);
      return c.json({ received: true }, 200); // Return 200 to tell Stripe we got it (even if invalid)
    }

    const db = createAdminDb(c.env.DB);

    // Handle account.updated events
    if (event.type === 'account.updated') {
      const account = event.data.object;

      // Find creator with this Stripe account
      const connection = await db.query.creatorConnections.findFirst({
        where: (cc) => eq(cc.stripeAccountId, account.id),
      });

      if (!connection) {
        console.warn('[webhooks-stripe] account.updated for unknown account:', account.id);
        return c.json({ received: true }, 200);
      }

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

      if (newStatus !== connection.onboardingStatus) {
        await db
          .update(creatorConnections)
          .set({
            onboardingStatus: newStatus,
            lastVerificationAttempt: new Date(),
            errorMessage,
            verifiedAt: newStatus === 'verified' ? new Date() : connection.verifiedAt,
          })
          .where(eq(creatorConnections.creatorId, connection.creatorId));

        console.info('[webhooks-stripe] creator status updated', {
          creatorId: connection.creatorId,
          stripeAccountId: account.id,
          newStatus,
        });
      }
    }

    return c.json({ received: true }, 200);
  } catch (error) {
    console.error('[webhooks-stripe] handler error:', error);
    return c.json({ received: false }, 500);
  }
});

export default router;
