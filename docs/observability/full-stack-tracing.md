# Full-Stack Tracing with Correlation IDs

**Goal:** Every request is traceable end-to-end: frontend action → worker log → database query → Sentry error → DLQ event. All linked by a single `correlationId`.

**Benefits:**
- Support can resolve "creator said payout failed" in <10 min using a single ID
- On-call can find root cause of auth failures in <5 min
- Ops can retrieve full request history from frontend to database layer
- DLQ events linked to original user requests (not floating in the void)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Video Studio)                     │
│  window.fetch('POST /api/...', {                               │
│    headers: { 'x-correlation-id': correlationId }              │
│  })                                                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP request + header
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               WORKER (Cloudflare Workers / Hono)                │
│  1. correlationIdMiddleware() extracts/generates correlationId  │
│  2. Attaches to Hono context ( c.get('correlationId') )       │
│  3. Passes to logger, Sentry, database client                  │
│  4. Returns in response header (x-correlation-id)              │
│  5. On error → captureError(err, { correlationId })           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
           ┌──────────┐  ┌─────────┐  ┌──────────┐
           │  Logger  │  │ Sentry  │  │ Database │
           │  (JSON)  │  │ (Event) │  │(Drizzle) │
           └──────────┘  └─────────┘  └──────────┘
                │            │            │
                │ JSON logs   │ Error ctx  │ Query ctx
                │ with ID     │ with ID    │ with ID
                ▼            ▼            ▼
           ┌──────────────────────────────────────┐
           │        Centralized Observability      │
           │  - PostHog (events)                  │
           │  - Sentry (errors)                   │
           │  - Logs (Cloudflare, stdout)         │
           │  - Database logs (slow queries)      │
           │  - DLQ events (failures)             │
           └──────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
        ┌──────────────┐     ┌──────────────────────┐
        │   Incident   │     │  Full Trace Retrieval│
        │  Dashboard   │     │ GET /trace/:corrId   │
        │  (Sentry)    │     │ Returns all logs     │
        └──────────────┘     └──────────────────────┘
```

---

## Implementation

### 1. Frontend: Generate and Send Correlation ID

**Video Studio (Next.js):**

```typescript
// lib/tracing.ts
export function getOrCreateCorrelationId(): string {
  // First time: generate
  let id = sessionStorage.getItem('correlationId');
  if (!id) {
    id = generateUUID();
    sessionStorage.setItem('correlationId', id);
  }
  return id;
}

// Middleware to attach to all requests
export async function withCorrelationId(request: Request): Promise<Request> {
  const correlationId = getOrCreateCorrelationId();
  request.headers.set('x-correlation-id', correlationId);
  return request;
}

// Usage in fetch wrappers:
const response = await fetch('/api/payment/checkout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-correlation-id': getOrCreateCorrelationId(),
  },
  body: JSON.stringify(payload),
});
```

**Also track in analytics:**

```typescript
// Track page views and errors with correlationId
posthog.capture('page_view', {
  correlationId: getOrCreateCorrelationId(),
});

window.addEventListener('error', (event) => {
  captureException(event.error, {
    correlationId: getOrCreateCorrelationId(),
  });
});
```

---

### 2. Worker: Extract/Inject via Middleware

**apps/worker/src/middleware/correlation.ts (using @adrper79-dot/logger):**

```typescript
import { correlationIdMiddleware } from '@adrper79-dot/logger';

app.use(correlationIdMiddleware('x-correlation-id'));

// Now all handlers have access
app.post('/api/payment/checkout', async (c) => {
  const correlationId = c.get('correlationId');
  const logger = c.get('logger');

  logger.info('payment checkout started', {
    correlationId, // Automatically included
    creatorId: c.req.json().creatorId,
  });

  // ... process payment ...
  // correlationId flows to database, errors, DLQ
  // Response header:
  return c.json({ ... }, {
    headers: { 'x-correlation-id': correlationId },
  });
});
```

---

### 3. Database: Include in Query Context

**Drizzle Integration:**

```typescript
import { createQueryContext } from '@adrper79-dot/logger';

app.post('/api/payment/checkout', async (c) => {
  const correlationId = c.get('correlationId');
  const userId = c.get('user')?.id;

  // Create context for database
  const queryCtx = createQueryContext(
    correlationId,
    userId,
  );

  // Pass to database operations
  const creator = await db
    .select()
    .from(creators)
    .where(eq(creators.id, creatorId))
    .with(queryCtx) // Metadata passed to slow query logger
    .executeTakeFirst();

  // Slow query (> 200ms) includes in logs:
  // {
  //   "event": "slow_query",
  //   "correlationId": "abc-123",
  //   "userId": "user_456",
  //   "query": "SELECT * FROM creators WHERE id = $1",
  //   "duration_ms": 250
  // }
});
```

---

### 4. Error Handling: Preserve Correlation ID in Sentry

**Monitoring (@adrper79-dot/monitoring):**

```typescript
import { captureError } from '@adrper79-dot/monitoring';

app.use(async (c, next) => {
  try {
    await next();
  } catch (err) {
    const correlationId = c.get('correlationId');

    // Sentry event includes correlationId
    captureError(err, {
      correlationId,
      userId: c.get('user')?.id,
      requestPath: c.req.path,
    });

    // Return error response with same correlationId
    return c.json(
      { error: 'Internal server error', correlationId },
      { status: 500, headers: { 'x-correlation-id': correlationId } },
    );
  }
});
```

---

### 5. DLQ Events: Store Correlation ID for Transaction Tracing

**Dead Letter Queue (packages/monitoring):**

```typescript
interface DLQEvent {
  id: string;
  eventType: 'transfer_failed' | 'webhook_timeout' | 'webhook_malformed';
  correlationId: string; // ← CRITICAL: Links back to original request
  creatorId: string;
  earningsId?: string;
  payload: Record<string, unknown>;
  error: string;
  retryCount: number;
  createdAt: Date;
}

// When a payout transfer fails:
async function enqueueDLQEvent(
  correlationId: string,
  creatorId: string,
  error: string,
  payload: Record<string, any>,
) {
  await db.insert(dlqTable).values({
    id: `dlq_${randomId(12)}`,
    correlationId, // ← Preserve original
    creatorId,
    eventType: 'transfer_failed',
    error,
    payload,
    retryCount: 0,
    createdAt: new Date(),
  });

  logger.warn('transfer queued to DLQ', {
    correlationId,
    creatorId,
    error,
  });
}
```

---

## Trace Retrieval Endpoint

**POST /trace/:correlationId** — Retrieves all logs/events for a transaction

### Endpoint: `src/routes/admin/trace.ts`

```typescript
import { Router } from 'hono';

export const traceRouter = new Router();

interface TraceEntry {
  timestamp: string;
  source: 'worker_log' | 'database' | 'sentry' | 'dlq' | 'analytics';
  message: string;
  context?: Record<string, unknown>;
  severity?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * GET /admin/trace/:correlationId
 *
 * Returns full request trace in chronological order.
 * Searches across:
 * - Worker/server logs (Cloudflare, stdout)
 * - Database slow query logs
 * - Sentry events
 * - DLQ events
 * - PostHog events
 *
 * Time: <5s for typical request trace (100–500 entries)
 */
traceRouter.get('/admin/trace/:correlationId', async (c) => {
  const correlationId = c.req.param('correlationId');

  // Verify admin role
  const user = c.get('user');
  if (user?.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, { status: 403 });
  }

  const trace: TraceEntry[] = [];

  // 1. Fetch worker/server logs (Cloudflare Logpush, stdout storage)
  const workerLogs = await fetchWorkerLogs(correlationId);
  trace.push(
    ...workerLogs.map((log) => ({
      timestamp: log.timestamp,
      source: 'worker_log' as const,
      message: log.message,
      context: log.context,
      severity: log.level,
    })),
  );

  // 2. Fetch database slow query logs
  const slowQueries = await fetchSlowQueries(correlationId);
  trace.push(
    ...slowQueries.map((q) => ({
      timestamp: new Date(q.created_at).toISOString(),
      source: 'database' as const,
      message: `Slow query: ${q.query}`,
      context: {
        duration_ms: q.duration_ms,
        query: q.query,
      },
      severity: q.duration_ms > 500 ? 'warn' : 'info',
    })),
  );

  // 3. Fetch Sentry events
  const sentryEvents = await fetchSentryEvents(correlationId);
  trace.push(
    ...sentryEvents.map((evt) => ({
      timestamp: evt.timestamp,
      source: 'sentry' as const,
      message: evt.message || evt.exception?.values?.[0]?.value,
      context: {
        eventId: evt.event_id,
        tags: evt.tags,
      },
      severity: 'error',
    })),
  );

  // 4. Fetch DLQ events
  const dlqEvents = await fetchDLQEvents(correlationId);
  trace.push(
    ...dlqEvents.map((evt) => ({
      timestamp: evt.created_at.toISOString(),
      source: 'dlq' as const,
      message: `DLQ event: ${evt.event_type}`,
      context: {
        eventId: evt.id,
        creatorId: evt.creator_id,
        error: evt.error,
        retryCount: evt.retry_count,
      },
      severity: 'warn',
    })),
  );

  // 5. Fetch PostHog events
  const posthogEvents = await fetchPostHogEvents(correlationId);
  trace.push(
    ...posthogEvents.map((evt) => ({
      timestamp: new Date(evt.timestamp).toISOString(),
      source: 'analytics' as const,
      message: evt.event,
      context: evt.properties,
      severity: 'info',
    })),
  );

  // Sort by timestamp
  trace.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return c.json({
    correlationId,
    trace,
    summary: {
      totalEntries: trace.length,
      startTime: trace[0]?.timestamp,
      endTime: trace[trace.length - 1]?.timestamp,
      errorCount: trace.filter((t) => t.severity === 'error').length,
      dlqEventCount: trace.filter((t) => t.source === 'dlq').length,
    },
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWorkerLogs(correlationId: string) {
  // Query Cloudflare Logpush or internal log storage
  // Example: SELECT * FROM logs WHERE correlation_id = $1 ORDER BY timestamp
  return [];
}

async function fetchSlowQueries(correlationId: string) {
  // Query database slow query table (Postgres pg_stat_statements integration)
  // Example: SELECT * FROM slow_queries WHERE correlation_id = $1
  return [];
}

async function fetchSentryEvents(correlationId: string) {
  // Query Sentry API for events tagged with correlationId
  // API: GET https://sentry.io/api/0/organizations/{org}/events/?tag:correlationId={id}
  return [];
}

async function fetchDLQEvents(correlationId: string) {
  // Query DLQ table in Neon
  // Example: SELECT * FROM dlq_events WHERE correlation_id = $1 ORDER BY created_at
  return [];
}

async function fetchPostHogEvents(correlationId: string) {
  // Query PostHog for events with correlationId in properties
  // API: GET /api/event/?distinct_id={userId}&properties___correlationId={id}
  return [];
}
```

**Response Example:**

```json
{
  "correlationId": "abc-123-def-456",
  "trace": [
    {
      "timestamp": "2026-04-28T14:32:10.100Z",
      "source": "analytics",
      "message": "page_view",
      "context": {
        "page": "/studio/create-video",
        "referrer": "dashboard"
      },
      "severity": "info"
    },
    {
      "timestamp": "2026-04-28T14:32:11.250Z",
      "source": "worker_log",
      "message": "POST /api/payment/checkout started",
      "context": {
        "creatorId": "creator_123",
        "tierId": "tier_pro"
      },
      "severity": "info"
    },
    {
      "timestamp": "2026-04-28T14:32:11.500Z",
      "source": "database",
      "message": "Slow query: SELECT * FROM creators WHERE id = $1",
      "context": {
        "duration_ms": 150,
        "query": "SELECT creator_id, subscription_status FROM creators..."
      },
      "severity": "info"
    },
    {
      "timestamp": "2026-04-28T14:32:12.000Z",
      "source": "worker_log",
      "message": "Stripe session created",
      "context": {
        "sessionId": "cs_live_abc123",
        "amount": 999
      },
      "severity": "info"
    },
    {
      "timestamp": "2026-04-28T14:32:13.100Z",
      "source": "sentry",
      "message": "Error: Stripe API rate limit",
      "context": {
        "eventId": "sentry_evt_123",
        "tags": { "critical": true }
      },
      "severity": "error"
    },
    {
      "timestamp": "2026-04-28T14:32:13.200Z",
      "source": "dlq",
      "message": "DLQ event: transfer_failed",
      "context": {
        "eventId": "dlq_xyz789",
        "creatorId": "creator_123",
        "error": "Stripe account disabled",
        "retryCount": 0
      },
      "severity": "warn"
    }
  ],
  "summary": {
    "totalEntries": 6,
    "startTime": "2026-04-28T14:32:10.100Z",
    "endTime": "2026-04-28T14:32:13.200Z",
    "errorCount": 1,
    "dlqEventCount": 1
  }
}
```

---

## Protocol for Ops/Support

### Scenario 1: "Creator says payout failed"

1. **Get correlationId:** Ask creator for request timestamp or check email
2. **Retrieve trace:** `curl https://api.videoing.io/trace/corr_abc123`
3. **Scan summary:** Error count, DLQ events
4. **Find root cause:** Stripe Connect disabled? Webhook timeout? Network error?
5. **Retry if safe:** `/api/admin/dlq/{dlqEventId}/retry`
6. **Verify:** Check POST `/trace/corr_abc123` again — earnings should now be processed

**Time:** <10 min

---

### Scenario 2: "Uploads always fail for this creator"

1. **Collect correlationId** from recent upload attempt (in browser DevTools)
2. **Retrieve trace** for that request
3. **Find pattern:** Same error appearing? (e.g., "R2 connection timeout")
4. **Check infrastructure:** Is R2 available? Rate limits?
5. **Escalate if infrastructure:** Open incident, notify platform team
6. **Retry upload:** Once infrastructure recovered

**Time:** <5 min to diagnose

---

### Scenario 3: "Auth is broken for all users"

1. **Grab any recent failed login correlationId** (multiple users for pattern)
2. **Retrieve traces** for 3–5 failed attempts
3. **Compare logs:** Same error? Different errors?
4. **Identify root cause:** JWT verification? Database connection? Cloudflare rate limit?
5. **Apply fix:** Rotate secret? Increase pool size? Adjust rate limits?
6. **Verify:** New login attempts should appear in trace with success

**Time:** <5 min diagnosis + fix time

---

## Testing Observability

**File:** `apps/worker/__tests__/observability-flow.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Full-Stack Tracing', () => {
  it('traces correlationId through entire request', async () => {
    const correlationId = 'test_corr_123';

    // 1. Make request with correlationId
    const response = await fetch('POST /api/payment/checkout', {
      headers: { 'x-correlation-id': correlationId },
      body: JSON.stringify({ creatorId: 'test_creator' }),
    });

    // 2. Response includes correlationId
    expect(response.headers.get('x-correlation-id')).toBe(correlationId);

    // 3. Latency >500ms
    expect(response.headers.get('x-latency-ms')).toBeGreaterThan(500);

    // 4. Wait for logs to be indexed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 5. Retrieve trace
    const traceResponse = await fetch(`GET /admin/trace/${correlationId}`);
    const trace = await traceResponse.json();

    // 6. Verify all layers appear
    expect(trace.summary.totalEntries).toBeGreaterThan(0);
    expect(trace.trace).toContainEqual(
      expect.objectContaining({ source: 'worker_log' }),
    );
    expect(trace.trace).toContainEqual(
      expect.objectContaining({ source: 'database' }),
    );
    expect(trace.trace).toContainEqual(
      expect.objectContaining({
        source: 'analytics',
        message: 'page_view',
      }),
    );

    // 7. If error occurred, Sentry event present
    if (response.status >= 400) {
      expect(trace.trace).toContainEqual(
        expect.objectContaining({ source: 'sentry', severity: 'error' }),
      );
    }
  });

  it('correlationId survives DLQ retry', async () => {
    // 1. Trigger transfer failure (Stripe disabled)
    const correlationId = 'dlq_test_456';
    const response = await fetch('POST /api/admin/payouts/batch/batch_123/execute', {
      headers: {
        'x-correlation-id': correlationId,
        'Authorization': 'Bearer admin_token',
      },
    });

    // 2. DLQ event created with same correlationId
    const dlqEventId = response.json().dlqEvents[0].id;

    // 3. Retry DLQ event
    await fetch(`POST /api/admin/dlq/${dlqEventId}/retry`, {
      headers: { 'x-correlation-id': correlationId },
    });

    // 4. Retrieve trace — should span original request → DLQ → retry
    const trace = await fetch(`GET /admin/trace/${correlationId}`).then((r) =>
      r.json(),
    );

    expect(trace.summary.dlqEventCount).toBe(1);
    expect(trace.trace).toContainEqual(
      expect.objectContaining({
        message: expect.stringMatching(/DLQ event/),
      }),
    );
    expect(trace.trace).toContainEqual(
      expect.objectContaining({
        message: expect.stringMatching(/retry/i),
      }),
    );
  });

  it('trace retrieval completes in <5s', async () => {
    const correlationId = 'perf_test_789';

    // Generate trace
    await fetch('POST /api/payment/checkout', {
      headers: { 'x-correlation-id': correlationId },
      body: JSON.stringify({ creatorId: 'perf_test_creator' }),
    });

    // Retrieve trace
    const start = performance.now();
    const response = await fetch(`GET /admin/trace/${correlationId}`);
    const duration = performance.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(5000);
  });
});
```

---

## Implementation Checklist (for VideoKing Developers)

- [ ] Add `correlationIdMiddleware` to worker `src/index.ts`
- [ ] Update logger to accept `correlationId` in context
- [ ] Update Sentry error capture to include `correlationId`
- [ ] Add `x-correlation-id` header to response in all routes
- [ ] Update DLQ schema: add `correlation_id` column
- [ ] Implement `/admin/trace/:correlationId` endpoint
- [ ] Add test harness: `observability-flow.test.ts`
- [ ] Document in runbooks (support / ops procedures)
- [ ] Deploy to staging, test with real traces
- [ ] Train support team on trace lookup

---

## FAQ

**Q: Will this slow down requests?**  
A: No. correlationId generation is O(1), and context passing doesn't add measurable latency.

**Q: What if frontend doesn't send correlationId?**  
A: Middleware generates one automatically. No requests are lost.

**Q: How long are traces retained?**  
A: Follow your observability platform retention (Sentry: default 90 days, configurable)

**Q: Can I search by user ID instead of correlationId?**  
A: Yes, but fewer results. Recommend `GET /admin/trace?userId={id}&limit=50` for page.

---

## Related Docs

- [Debugging with Correlation IDs](./debugging-with-correlation-ids.md)
- [Durable Objects Tracing](./durable-objects-tracing.md) (VideoRoom, UserPresence)
- [SLO & Observability](../runbooks/slo.md#observability)
