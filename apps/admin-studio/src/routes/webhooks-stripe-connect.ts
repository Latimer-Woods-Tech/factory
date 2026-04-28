/**
 * Stripe Connect webhooks for creator account status updates
 * - account.updated: Status changes, verification completion
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

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEventAsync(
        body,
        signature,
        c.env.STRIPE_CONNECT_WEBHOOK_SECRET
      );
    } catch (error) {
      logger.warn('Webhook signature verification failed', { error });
      return c.json({ received: true }, 200); // Return 200 to tell Stripe we got it (even if invalid)
    }

    const db = createDb(c.env.DB);

    // Handle account.updated events
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;

      // Find creator with this Stripe account
      const connection = await db.query.creatorConnections.findFirst({
        where: (cc) => eq(cc.stripeAccountId, account.id),
      });

      if (!connection) {
        logger.warn('Received account.updated for unknown Stripe account', {
          stripeAccountId: account.id,
        });
        return c.json({ received: true }, 200);
      }

      // Determine new status based on Stripe account state
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

      // Update connection if status changed
      if (newStatus !== connection.onboardingStatus) {
        await db.update(creatorConnections)
          .set({
            onboardingStatus: newStatus,
            lastVerificationAttempt: new Date(),
            errorMessage,
            verifiedAt: newStatus === 'verified' ? new Date() : undefined,
          })
          .where(eq(creatorConnections.creatorId, connection.creatorId));

        logger.info('Updated creator Stripe status via webhook', {
          creatorId: connection.creatorId,
          stripeAccountId: account.id,
          newStatus,
        });

        // Track analytics event
        await c.get('analytics')?.track({
          event: 'creator:stripe_account_updated',
          properties: {
            creatorId: connection.creatorId,
            stripeAccountId: account.id,
            status: newStatus,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    return c.json({ received: true }, 200);
  } catch (error) {
    logger.error('Webhook handler error', { error });
    return c.json({ received: false }, 500);
  }
});

export default router;
