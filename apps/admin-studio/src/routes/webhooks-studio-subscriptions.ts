/**
 * W360-005 — Stripe subscription webhook (public, HMAC-signed).
 *
 * Mounted at `/webhooks/studio-subscriptions`.
 *
 * Handles:
 *   - customer.subscription.created  → activate entitlements, grant credits
 *   - customer.subscription.updated  → sync plan/status changes
 *   - customer.subscription.deleted  → revoke entitlements
 *
 * Security:
 *   - Stripe-Signature HMAC-SHA256 verified before any DB writes
 *   - 400 returned for missing/malformed signature (Stripe will retry)
 *   - 401 returned for bad signature
 *   - 200 always returned on success to prevent Stripe retries
 *   - All errors logged; none propagate to Stripe
 *
 * Idempotency:
 *   - Stripe may deliver each event more than once.
 *   - Subscription upserts and entitlement refreshes are idempotent by design
 *     (INSERT … ON CONFLICT DO UPDATE / upsert semantics in refreshEntitlements).
 */
import { Hono } from 'hono';
import { createDb } from '@latimer-woods-tech/neon';
import {
  verifyStripeSignature,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from '@latimer-woods-tech/neon';
import type { StripeEvent } from '@latimer-woods-tech/neon';
import type { AppEnv } from '../types.js';

const studioSubscriptions = new Hono<AppEnv>();

studioSubscriptions.post('/', async (c) => {
  const env = c.env;

  if (!env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_SUBSCRIPTION_WEBHOOK_SECRET not configured');
    return c.json({ error: 'Webhook receiver not configured' }, 503);
  }

  const raw = await c.req.text();
  const sig = c.req.header('stripe-signature');

  if (!sig) {
    return c.json({ error: 'Missing Stripe-Signature header' }, 400);
  }

  const valid = await verifyStripeSignature(raw, sig, env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET);
  if (!valid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const db = createDb(env.DB);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(db, event);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(db, event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(db, event);
        break;
      default:
        // Unrecognised event — acknowledge without processing
        console.info(`[stripe-webhook] unhandled event type: ${(event as { type: string }).type}`);
    }
  } catch (err) {
    // Log but still return 200 so Stripe does not retry indefinitely.
    // Operators should monitor Sentry / PostHog for these errors.
    console.error('[stripe-webhook] handler error:', err);
  }

  return c.json({ received: true });
});

export default studioSubscriptions;
