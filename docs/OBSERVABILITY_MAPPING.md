# Observability Mapping: End-to-End Tracing & Instrumentation

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T5.2 — Complete observability from user action to operator recovery  
**Scope:** Define correlation ID propagation, trace structure, and instrumentation contracts across edge + database + background jobs

---

## Executive Summary

**Problem:** When something fails in VideoKing, we have isolated data:
- Frontend logs say "request timed out"
- Worker logs show "database query slow"
- Database logs show "connection pool exhausted"
- But no single trace connecting all three

**Solution:** Correlation IDs + structured logging across all layers, enabling one-click diagnosis.

**Result by May 15:**
- ✅ User action → Worker request → Database query → Background job → Operator recovery all in one trace
- ✅ Operators can paste a user ID or transaction ID and see full flow
- ✅ Sentry/Datadog can aggregate across all layers (same `trace_id`)
- ✅ PostHog events linked to error traces (debugging conversions + errors in parallel)

---

## Part 1: Correlation ID Strategy

### What is a Correlation ID?

A unique identifier (UUIDv4) assigned to a user action that flows through:
1. Browser → Worker HTTP header (`X-Correlation-ID`)
2. Worker → Database (connection parameter + SQL comments)
3. Worker → Background job / DLQ (message metadata)
4. All logs include `correlation_id` field
5. Sentry + PostHog + Database logs all tagged with same ID

### When to Create vs Propagate

**Create a NEW correlation ID:**
- User session starts: `POST /auth/login` → generate UUID
- External webhook: Stripe webhook `POST /webhooks/stripe` → generate UUID
- Scheduled job: Payout worker fires `* * * * * /jobs/weekly-payout` → generate UUID

**Propagate EXISTING correlation ID:**
- User request with `X-Correlation-ID` header → include in all Worker responses
- Worker → Database: Pass in connection context
- Worker → Background job: Include in message payload
- Worker → External API: Include in request header

### Structure in Code

```typescript
// src/middleware/correlation.ts
import { randomUUID } from 'crypto';

export function correlationMiddleware(c, next) {
  const incoming = c.req.header('X-Correlation-ID') || randomUUID();
  
  // Store in context for access in handlers
  c.set('correlationId', incoming);
  
  // Add to response headers (so client can reference in support tickets)
  c.res.headers.set('X-Correlation-ID', incoming);
  
  // Add to all logs
  c.set('logContext', { correlationId: incoming });
  
  return next();
}

app.use(correlationMiddleware);
```

---

## Part 2: Structured Logging by Layer

### Layer 1: Frontend (Browser)

**Event Captured:**
- User initiates action: "Watch video", "Subscribe", "Upload"
- Browser captures: `correlationId`, `userId`, `timestamp`, `action`

```typescript
// Frontend: src/instrumentation.ts
export function logUserAction(action: string, metadata: any) {
  const trace_id = window.sessionStorage.getItem('trace_id') || generateTraceID();
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    trace_id,
    source: 'browser',
    action,
    user_id: currentUser?.id,
    metadata,
  }));
  
  // Also send to error tracking (Sentry)
  Sentry.captureMessage(`User action: ${action}`, {
    tags: { 
      trace_id,
      action,
      component: 'VideoWatch' 
    }
  });
}
```

### Layer 2: Worker (Edge)

**HTTP Request → Response:**

```typescript
// src/handlers/videos.ts
export async function handleVideoWatch(c) {
  const correlationId = c.get('correlationId');
  const userId = c.var.user.id;
  const videoId = c.req.param('id');
  
  // Log request
  logger.info('video_watch_started', {
    correlation_id: correlationId,
    user_id: userId,
    video_id: videoId,
    method: c.req.method,
    path: c.req.path,
    timestamp: new Date().toISOString(),
  });
  
  try {
    // Pass correlation ID to database
    const result = await env.DB.execute(
      `INSERT INTO video_watches (video_id, viewer_id, correlation_id, watched_at)
       VALUES (?, ?, ?, NOW())`,
      [videoId, userId, correlationId]
    );
    
    // Log success
    logger.info('video_watch_recorded', {
      correlation_id: correlationId,
      db_insert_ms: result.duration,
      row_id: result.lastRowId,
    });
    
    return c.json({ status: 'ok' });
  } catch (err) {
    // Log error with trace
    logger.error('video_watch_failed', {
      correlation_id: correlationId,
      error_message: err.message,
      error_code: err.code,
      stack_trace: err.stack, // Only in logs; never in response
    });
    
    // Alert Sentry
    Sentry.captureException(err, {
      tags: { correlation_id: correlationId },
    });
    
    return c.json({ error: 'Failed to record watch' }, 500);
  }
}
```

### Layer 3: Database (Neon)

**Audit Log Integration:**

Every write operation is logged to `audit_log` table with correlation ID:

```typescript
// src/db/audit.ts
export async function logAuditEvent(
  userId: string,
  entityType: string,
  action: string,
  correlationId: string,
  oldValues?: any,
  newValues?: any
) {
  await db.execute(
    `INSERT INTO audit_log 
     (user_id, entity_type, action, correlation_id, old_values, new_values, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [userId, entityType, action, correlationId, JSON.stringify(oldValues), JSON.stringify(newValues)]
  );
}

// SQL comment for database logs (visible in pg_stat_statements)
async function executeWithTrace(query: string, params: any[], correlationId: string) {
  const annotatedQuery = `/* trace_id=${correlationId} */ ${query}`;
  return await db.execute(annotatedQuery, params);
}
```

### Layer 4: Background Jobs (Payout Worker)

**DLQ Pattern with Correlation:**

```typescript
// src/jobs/weekly-payout.ts
export async function weeklyPayoutJob(env: Env) {
  const jobCorrelationId = randomUUID();
  
  logger.info('payout_batch_started', {
    correlation_id: jobCorrelationId,
    batch_id: jobCorrelationId,  // batch ID = correlation ID
    trigger: 'scheduled',
    timestamp: new Date().toISOString(),
  });
  
  try {
    const creators = await env.DB.query(
      `SELECT id, stripe_account_id, pending_earnings 
       FROM creators WHERE pending_earnings > 0`
    );
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const creator of creators) {
      try {
        const transfer = await initiateStripeTransfer(creator, jobCorrelationId);
        
        await env.DB.execute(
          `INSERT INTO payouts (creator_id, batch_id, transfer_id, correlation_id, status, created_at)
           VALUES (?, ?, ?, ?, 'pending', NOW())`,
          [creator.id, jobCorrelationId, transfer.id, jobCorrelationId]
        );
        
        successCount++;
      } catch (err) {
        failureCount++;
        
        // Store in DLQ with correlation
        await env.DB.execute(
          `INSERT INTO dlq_transfers (transfer_id, reason, correlation_id, created_at)
           VALUES (?, ?, ?, NOW())`,
          [err.transferId || 'unknown', err.message, jobCorrelationId]
        );
        
        logger.error('payout_creator_failed', {
          correlation_id: jobCorrelationId,
          batch_id: jobCorrelationId,
          creator_id: creator.id,
          error_message: err.message,
        });
      }
    }
    
    logger.info('payout_batch_completed', {
      correlation_id: jobCorrelationId,
      batch_id: jobCorrelationId,
      creators_processed: creators.length,
      success_count: successCount,
      failure_count: failureCount,
      dlq_count: failureCount,
    });
  } catch (err) {
    logger.error('payout_batch_failed', {
      correlation_id: jobCorrelationId,
      error_message: err.message,
      error_code: err.code,
    });
  }
}
```

---

## Part 3: Query Instrumentation (End-to-End Tracing)

### Trace Context Propagation

```typescript
// src/db/trace.ts
import { tracer } from '@adrper79-dot/monitoring';

export class TracedQuery {
  private correlationId: string;
  private parentSpanId: string;

  constructor(correlationId: string, parentSpanId?: string) {
    this.correlationId = correlationId;
    this.parentSpanId = parentSpanId || 'root';
  }

  async execute(query: string, params: any[]) {
    const spanId = randomUUID();
    
    // Create child span for this query
    const span = tracer.startSpan('db.query', {
      trace_id: this.correlationId,
      span_id: spanId,
      parent_span_id: this.parentSpanId,
      query: query.substring(0, 100),  // Truncate for privacy
      params_count: params.length,
    });
    
    try {
      const startTime = performance.now();
      const result = await env.DB.execute(query, params);
      const duration = performance.now() - startTime;
      
      span.setTag('duration_ms', Math.round(duration));
      span.setTag('rows_affected', result.rowsAffected);
      span.finish();
      
      return result;
    } catch (err) {
      span.setTag('error', true);
      span.setTag('error_message', err.message);
      span.finish();
      throw err;
    }
  }
}

// Usage in handlers
export async function recordWatch(c) {
  const correlationId = c.get('correlationId');
  const traceContext = new TracedQuery(correlationId);
  
  await traceContext.execute(
    `INSERT INTO video_watches (...) VALUES (...)`,
    [...]
  );
}
```

### Datadog / Honeycomb Integration (Optional Phase C)

Once set up:
```typescript
// config/datadog.ts
Datadog.setTraceContext({
  'trace_id': correlationId,
  'span_id': spanId,
});
```

Result: All logs, traces, and metrics in Datadog/Honeycomb tied to single correlation ID.

---

## Part 4: Error Trace Enrichment

### When Error Occurs

```typescript
// src/handlers/checkout.ts
export async function handleCheckout(c) {
  const correlationId = c.get('correlationId');
  
  try {
    // ... checkout logic
  } catch (err) {
    // Enrich error with full context
    const errorTrace = {
      correlation_id: correlationId,
      error_id: randomUUID(),  // For support tickets
      user_id: c.var.user?.id,
      endpoint: c.req.path,
      method: c.req.method,
      user_agent: c.req.header('User-Agent'),
      ip_address: c.req.raw.headers.get('cf-connecting-ip'),
      timestamp: new Date().toISOString(),
      error_message: err.message,
      error_code: err.code,
      error_type: err.constructor.name,
      stack_trace: err.stack,  // Only for logging, never in response
    };
    
    // Send to error tracking
    Sentry.captureException(err, {
      tags: {
        correlation_id: correlationId,
        error_type: err.constructor.name,
      },
      contexts: {
        user: { id: c.var.user?.id },
        http: {
          method: c.req.method,
          url: c.req.path,
        }
      },
      extra: errorTrace,
    });
    
    // Also log locally
    logger.error('checkout_error', errorTrace);
    
    // Return error to client (without stack trace!)
    return c.json({
      status: 'error',
      message: 'Checkout failed',
      error_id: errorTrace.error_id,  // Customer can use to reference
    }, 500);
  }
}
```

---

## Part 5: Operator Recovery View

### Factory Admin: Trace View

Once integrated, Factory Admin can display:

```
🔍 Search by Correlation ID: [abc-123-def-456]

📊 Trace Timeline:
  ├─ [14:22:33.100] 🟢 Browser: "Subscribe to tier 1"
  ├─ [14:22:33.150] 🟢 Worker: POST /api/subscriptions (200ms)
  │  ├─ [14:22:33.160] Database: INSERT subscriptions (45ms)
  │  ├─ [14:22:33.210] Stripe API: Create subscription (120ms)
  │  └─ [14:22:33.235] Audit log: subscription_created
  ├─ [14:22:34.500] 🔴 Webhook: Stripe invoice.payment_succeeded FAILED
  │  ├─ [14:22:34.600] DLQ: Added to retry queue
  │  └─ [14:22:39.650] DLQ: Retry attempt 1 → SUCCESS
  └─ [14:22:40.200] 🟢 Database: UPDATE subscriptions SET status='active'

⚡ Summary:
  Duration: 7.1 seconds
  Status: ✅ Completed (after retry)
  Issues: 1 webhook timeout; auto-recovered
  Revenue: $9.99 initialized; $8.33 to creator
```

### Recovery Actions (Operator Clicks)

```
[🔄 Retry Webhook] [📧 Send Confirmation Email] [🔗 Link to Sentry Issue] [📋 View Full Audit Trail]
```

---

## Part 6: Instrumentation Backlog (Priority 1 - By May 15)

| Event | Why | Owner | Status |
|-------|-----|-------|--------|
| `user_login` | Auth baseline | Backend | 🟡 In progress |
| `video_watched` | Viewer engagement | Backend | ✅ Done |
| `subscription_initiated` | Revenue entry point | Backend | ✅ Done |
| `subscription_succeeded` (webhook) | Revenue confirmation | Backend | 🟡 In progress |
| `video_uploaded` | Creator engagement | Backend | ✅ Done |
| `video_moderation_queued` | Moderation SLA tracking | Backend | ✅ Done |
| `payout_batch_initiated` | Financial ops | Backend | 🟡 In progress |
| `payout_transfer_succeeded` | Revenue to creator | Backend | 🟡 In progress |

**Effort:** 16 hours (2 engineers × 2 weeks)

---

## Part 7: PostHog Event Linking

### Connect Events to Error Traces

```typescript
// Middleware: After auth
export async function enrichPostHogWithTracing(c, next) {
  const correlationId = c.get('correlationId');
  const user = c.var.user;
  
  PostHog.capture({
    distinctId: user.id,
    event: 'api_request',
    properties: {
      correlation_id: correlationId,  // Link to error traces
      endpoint: c.req.path,
      timestamp: new Date(),
    }
  });
  
  await next();
}
```

**Use Case:** User reports "My subscription didn't activate"
1. Search PostHog: `user_id = xyz; event = subscription_initiated`
2. Grab `correlation_id` from that event
3. Paste into Factory Admin trace view
4. See full flow: Browser → Worker → Stripe → Webhook → DLQ retry → Success

---

## Part 8: Implementation Checklist (May 1–15)

- [ ] **Week 1 (May 1–5):**
  - [ ] Correlation ID middleware (Worker)
  - [ ] Structured logging library (Factory support package if needed)
  - [ ] Propagate through database calls
  
- [ ] **Week 2 (May 8–12):**
  - [ ] Instrument all money-moving flows (subscription, unlock, payout)
  - [ ] Add audit log with correlation ID
  - [ ] DLQ pattern uses correlation ID
  
- [ ] **Week 3 (May 15):**
  - [ ] Integrate with Sentry + PostHog
  - [ ] Build Factory Admin trace view
  - [ ] Operator training on using traces

**Total Effort:** 24 hours (Platform Lead + Backend Engineer)

---

## Part 9: DNA: Correlation ID Regex

For parsing logs / traces:

```regex
correlation_id: [a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}
```

**Usage:** Parse logs, search Sentry/PostHog, find all related events.

---

## Part 10: Exit Criteria (T5.2)

- [x] Correlation ID strategy documented (why, when to create vs propagate)
- [x] Logging standardized across 4 layers (frontend, Worker, database, job)
- [x] Error trace enrichment design (with Sentry integration)
- [x] DLQ + background job instrumentation
- [x] Operator recovery view sketch (Factory Admin trace feature)
- [x] Instrumentation backlog prioritized (8 priority-1 events)
- [ ] Correlation IDs implemented in VideoKing (May 8–15)
- [ ] PostHog event linking live (May 15)
- [ ] Operator training on trace views (May 15)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Platform Lead | T5.2 observability mapping; 4-layer tracing strategy; operator recovery view |

---

**Status:** ✅ T5.2 DESIGN READY FOR IMPLEMENTATION  
**Next Action:** Implement correlation IDs in VideoKing (May 8–15); factory Admin trace view (May 15+)
