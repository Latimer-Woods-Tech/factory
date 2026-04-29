/**
 * Analytics Event Schema — Critical Journey Contract (W360-021)
 *
 * Defines the required properties for each critical Factory event.
 * Used by tests to verify events are emitted with the correct shape.
 *
 * Philosophy:
 * - Every business-critical event has a schema entry here.
 * - Tests import `assertEventShape` to fail loudly when shape is wrong.
 * - This is the single source of truth for what properties an event MUST have.
 * - "Optional but useful" properties are NOT listed here — only required fields.
 *
 * Adding Events:
 * - Add an entry to CRITICAL_EVENT_SCHEMAS below.
 * - Each entry is: event name → { required: string[], allowedTypes?: Record<string, string> }
 * - Run `npm test` — tests for the new event will be auto-discovered.
 */

/**
 * Schema definition for a single event.
 * - `required`: properties that MUST be present and non-null
 * - `types`: [optional] map of property name → expected typeof value
 */
export interface EventSchema {
  /** Property keys that must be present and non-null in the event properties. */
  required: string[];
  /** Optional runtime type constraints. Values must match `typeof` output. */
  types?: Record<string, 'string' | 'number' | 'boolean'>;
}

/**
 * Map of critical event name → required property schema.
 *
 * Journey coverage:
 * - Render flow: `render.*`
 * - Subscription/billing: `subscription.*`, `revenue.*`
 * - Auth: `auth.*`
 * - Booking (Xico): `booking.*`
 * - Webhook delivery: `webhook.*`
 */
export const CRITICAL_EVENT_SCHEMAS: Record<string, EventSchema> = {
  // ---------------------------------------------------------------------------
  // Render flow (Practitioner Studio)
  // ---------------------------------------------------------------------------
  'render.requested': {
    required: ['render_job_id', 'customer_id', 'app_id'],
    types: { render_job_id: 'string', customer_id: 'string', app_id: 'string' },
  },
  'render.started': {
    required: ['render_job_id', 'customer_id', 'app_id'],
    types: { render_job_id: 'string', customer_id: 'string', app_id: 'string' },
  },
  'render.completed': {
    required: ['render_job_id', 'customer_id', 'app_id', 'duration_ms', 'stream_uid'],
    types: { render_job_id: 'string', duration_ms: 'number', stream_uid: 'string' },
  },
  'render.failed': {
    required: ['render_job_id', 'customer_id', 'app_id', 'error_message'],
    types: { render_job_id: 'string', error_message: 'string' },
  },
  'render.credits_debited': {
    required: ['render_job_id', 'customer_id', 'credit_cost', 'remaining_credits'],
    types: { credit_cost: 'number', remaining_credits: 'number' },
  },
  'render.credits_refunded': {
    required: ['render_job_id', 'customer_id', 'credit_amount', 'reason'],
    types: { credit_amount: 'number', reason: 'string' },
  },

  // ---------------------------------------------------------------------------
  // Subscription / billing (Practitioner Studio)
  // ---------------------------------------------------------------------------
  'subscription.created': {
    required: ['customer_id', 'plan_id', 'stripe_subscription_id', 'billing_cycle'],
    types: { plan_id: 'string', stripe_subscription_id: 'string' },
  },
  'subscription.canceled': {
    required: ['customer_id', 'plan_id', 'stripe_subscription_id'],
    types: { plan_id: 'string', stripe_subscription_id: 'string' },
  },
  'subscription.payment_failed': {
    required: ['customer_id', 'stripe_subscription_id', 'invoice_id'],
    types: { stripe_subscription_id: 'string', invoice_id: 'string' },
  },

  // ---------------------------------------------------------------------------
  // Revenue events
  // ---------------------------------------------------------------------------
  'revenue.payment_received': {
    required: ['customer_id', 'amount_usd', 'stripe_payment_intent_id'],
    types: { amount_usd: 'number', stripe_payment_intent_id: 'string' },
  },
  'revenue.refund_issued': {
    required: ['customer_id', 'amount_usd', 'stripe_refund_id', 'reason'],
    types: { amount_usd: 'number', reason: 'string' },
  },

  // ---------------------------------------------------------------------------
  // Auth journey
  // ---------------------------------------------------------------------------
  'auth.login_success': {
    required: ['user_id', 'app_id'],
    types: { user_id: 'string', app_id: 'string' },
  },
  'auth.login_failed': {
    required: ['app_id', 'reason'],
    types: { app_id: 'string', reason: 'string' },
  },
  'auth.token_refreshed': {
    required: ['user_id', 'app_id'],
    types: { user_id: 'string', app_id: 'string' },
  },
  'auth.logout': {
    required: ['user_id', 'app_id'],
    types: { user_id: 'string', app_id: 'string' },
  },

  // ---------------------------------------------------------------------------
  // Booking journey (Xico City)
  // ---------------------------------------------------------------------------
  'booking.checkout_started': {
    required: ['experience_id', 'user_id', 'price_usd'],
    types: { experience_id: 'string', price_usd: 'number' },
  },
  'booking.confirmed': {
    required: ['booking_id', 'experience_id', 'user_id', 'host_id', 'price_usd'],
    types: { booking_id: 'string', price_usd: 'number' },
  },
  'booking.canceled': {
    required: ['booking_id', 'experience_id', 'user_id', 'reason'],
    types: { booking_id: 'string', reason: 'string' },
  },

  // ---------------------------------------------------------------------------
  // Webhook delivery observability
  // ---------------------------------------------------------------------------
  'webhook.received': {
    required: ['event_id', 'event_type', 'source'],
    types: { event_id: 'string', event_type: 'string', source: 'string' },
  },
  'webhook.processed': {
    required: ['event_id', 'event_type', 'duration_ms'],
    types: { event_id: 'string', duration_ms: 'number' },
  },
  'webhook.failed': {
    required: ['event_id', 'event_type', 'error_message'],
    types: { event_id: 'string', error_message: 'string' },
  },
  'webhook.duplicate_ignored': {
    required: ['event_id', 'event_type'],
    types: { event_id: 'string', event_type: 'string' },
  },
};

/**
 * Validation result returned by {@link validateEventShape}.
 */
export interface EventValidationResult {
  valid: boolean;
  missingFields: string[];
  typeErrors: Array<{ field: string; expected: string; actual: string }>;
}

/**
 * Validates that event properties conform to the registered schema.
 *
 * Returns a result object — use {@link assertEventShape} in tests to throw on failure.
 *
 * @param eventName - The event name (e.g. `'render.completed'`)
 * @param properties - The properties object submitted with the event
 */
export function validateEventShape(
  eventName: string,
  properties: Record<string, unknown>,
): EventValidationResult {
  const schema = CRITICAL_EVENT_SCHEMAS[eventName];
  if (!schema) {
    // Unknown event: not in critical registry — no constraints to check
    return { valid: true, missingFields: [], typeErrors: [] };
  }

  const missingFields: string[] = [];
  const typeErrors: Array<{ field: string; expected: string; actual: string }> = [];

  for (const field of schema.required) {
    if (properties[field] === undefined || properties[field] === null) {
      missingFields.push(field);
    }
  }

  if (schema.types) {
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (properties[field] !== undefined && properties[field] !== null) {
        const actualType = typeof properties[field];
        if (actualType !== expectedType) {
          typeErrors.push({ field, expected: expectedType, actual: actualType });
        }
      }
    }
  }

  return {
    valid: missingFields.length === 0 && typeErrors.length === 0,
    missingFields,
    typeErrors,
  };
}

/**
 * Asserts that event properties conform to the registered schema.
 * Throws a descriptive error in tests if validation fails.
 *
 * @example
 * ```ts
 * assertEventShape('render.completed', {
 *   render_job_id: 'job-001',
 *   customer_id: 'cust-01',
 *   app_id: 'prime_self',
 *   duration_ms: 5000,
 *   stream_uid: 'abc123',
 * });
 * ```
 */
export function assertEventShape(
  eventName: string,
  properties: Record<string, unknown>,
): void {
  const result = validateEventShape(eventName, properties);
  if (!result.valid) {
    const parts: string[] = [`Event shape validation failed for "${eventName}":`, ''];

    if (result.missingFields.length > 0) {
      parts.push(`  Missing required fields: ${result.missingFields.join(', ')}`);
    }
    for (const te of result.typeErrors) {
      parts.push(`  Type error on "${te.field}": expected ${te.expected}, got ${te.actual}`);
    }

    throw new Error(parts.join('\n'));
  }
}

/**
 * Lists all registered critical event names.
 * Useful for test discovery: ensure every schema has at least one test.
 */
export function getCriticalEventNames(): string[] {
  return Object.keys(CRITICAL_EVENT_SCHEMAS);
}
