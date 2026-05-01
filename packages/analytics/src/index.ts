import { InternalError } from '@latimer-woods-tech/errors';
import { sql } from '@latimer-woods-tech/neon';
import type { FactoryDb } from '@latimer-woods-tech/neon';

// Event schema contract (W360-021) — re-exported for consumer tests
export {
  validateEventShape,
  assertEventShape,
  getCriticalEventNames,
  CRITICAL_EVENT_SCHEMAS,
} from './event-schemas.js';
export type { EventSchema, EventValidationResult } from './event-schemas.js';

/**
 * Routing destination for an analytics event.
 */
export type EventDestination = 'posthog' | 'factory_events' | 'both';

/**
 * Configuration provided to {@link initAnalytics}.
 */
export interface AnalyticsConfig {
  postHogKey: string;
  db: FactoryDb;
  appId: string;
}

/**
 * Analytics interface returned by {@link initAnalytics}.
 */
export interface Analytics {
  /**
   * Routes to PostHog + `factory_events` based on event type.
   */
  track(
    event: string,
    properties?: Record<string, unknown>,
    userId?: string,
  ): Promise<void>;
  /**
   * Identifies a user — PostHog only.
   */
  identify(userId: string, traits: Record<string, unknown>): Promise<void>;
  /**
   * Records a revenue or compliance event to `factory_events` only.
   */
  businessEvent(
    event: string,
    properties: Record<string, unknown>,
    userId?: string,
  ): Promise<void>;
  /**
   * Tracks a page view — PostHog only.
   */
  page(name: string, properties?: Record<string, unknown>): Promise<void>;
}

/** @internal Looser fetch signature compatible with vi.fn mocks. */
type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * @internal Injected dependencies — primarily for testing.
 */
export interface AnalyticsDeps {
  fetch?: FetchFn;
}

const POSTHOG_URL = 'https://app.posthog.com/capture/';

/**
 * Business events that are always stored in `factory_events` (and never sent
 * to PostHog to avoid leaking revenue data to a third-party SaaS).
 */
const BUSINESS_EVENT_PREFIXES = ['revenue.', 'subscription.', 'compliance.', 'billing.'] as const;

function isBusinessEvent(event: string): boolean {
  return BUSINESS_EVENT_PREFIXES.some((prefix) => event.startsWith(prefix));
}

async function sendToPostHog(
  key: string,
  event: string,
  distinctId: string,
  properties: Record<string, unknown>,
  fetchImpl: FetchFn,
): Promise<void> {
  const res = await fetchImpl(POSTHOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      event,
      distinct_id: distinctId,
      properties,
      timestamp: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new InternalError(`PostHog capture failed with status ${String(res.status)}`, {
      status: res.status,
    });
  }
}

async function insertFactoryEvent(
  db: FactoryDb,
  appId: string,
  event: string,
  properties: Record<string, unknown>,
  userId: string | undefined,
): Promise<void> {
  const props = JSON.stringify(properties);
  const uid = userId ?? null;
  try {
    await db.execute(
      sql`INSERT INTO factory_events (app_id, event, properties, user_id, occurred_at)
          VALUES (${appId}, ${event}, ${props}::jsonb, ${uid}, NOW())`,
    );
  } catch (err) {
    throw new InternalError(`factory_events insert failed: ${(err as Error).message}`, {
      event,
    });
  }
}

/**
 * Initialises analytics with the provided config and returns an {@link Analytics} instance.
 *
 * @example
 * ```ts
 * const analytics = initAnalytics({ postHogKey: env.POSTHOG_KEY, db, appId: 'ijustus' });
 * await analytics.track('button.clicked', { button: 'cta' }, userId);
 * ```
 */
export function initAnalytics(config: AnalyticsConfig, deps: AnalyticsDeps = {}): Analytics {
  const fetchImpl: FetchFn = deps.fetch ?? fetch;

  return {
    async track(event, properties = {}, userId): Promise<void> {
      // Business events go to both PostHog and factory_events;
      // regular events go to PostHog only.
      const dest: EventDestination = isBusinessEvent(event) ? 'both' : 'posthog';
      const distinctId = userId ?? 'anonymous';
      const enriched = { ...properties, app_id: config.appId };

      if (dest === 'both' || dest === 'posthog') {
        await sendToPostHog(config.postHogKey, event, distinctId, enriched, fetchImpl);
      }
      if (dest === 'both') {
        await insertFactoryEvent(config.db, config.appId, event, enriched, userId);
      }
    },

    async identify(userId, traits): Promise<void> {
      const props = { ...traits, app_id: config.appId };
      await sendToPostHog(config.postHogKey, '$identify', userId, props, fetchImpl);
    },

    async businessEvent(event, properties, userId): Promise<void> {
      const enriched = { ...properties, app_id: config.appId };
      await insertFactoryEvent(config.db, config.appId, event, enriched, userId);
    },

    async page(name, properties = {}): Promise<void> {
      const enriched = { ...properties, app_id: config.appId, $current_url: name };
      await sendToPostHog(config.postHogKey, '$pageview', 'anonymous', enriched, fetchImpl);
    },
  };
}
export {};
