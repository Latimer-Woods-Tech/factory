# T4.4 — Factory Admin Telemetry Contract Implementation Guide

**Last Updated:** April 28, 2026  
**Phase:** Phase 4 (Implementation Ready)  
**Owner:** Platform Engineering  
**Status:** Telemetry contract finalized; implementation guide complete

---

## Overview

T4.4 defines the telemetry endpoints that Factory Admin (centralized admin dashboard) uses to monitor all Factory apps (videoking, primeself, cypher, etc.). This enables:

1. **Real-time app health visibility** — Is each app up? Response times?
2. **Operational metrics** — Users active, requests/min, error rate
3. **Financial metrics** — Revenue, payouts, pending amounts
4. **Dependency health** — Database, integrations (Stripe, Cloudflare Stream, Deepgram)

---

## Contract: 3 Standardized Endpoints

All apps must implement these 3 endpoints with identical response schemas.

### 1. GET /api/admin/health

**Purpose:** Health check + dependency status (used by load balancer + Factory Admin dashboard)

**Auth:** `admin:videoking` role or `operator:*` role  

**Rate Limit:** 60 req/min per operator (higher than user limit)

**Response (200 OK):**
```json
{
  "status": "operational",
  "timestamp": "2026-04-28T10:30:00Z",
  "uptime": 99.95,
  "latency": {
    "p50": 45,
    "p95": 120,
    "p99": 250
  },
  "dependencies": {
    "database": "healthy",
    "stripe": "healthy",
    "cloudflare_stream": "healthy",
    "deepgram": "healthy",
    "sentry": "healthy",
    "posthog": "healthy"
  },
  "version": "1.0.0",
  "instance_id": "videoking-worker-us-west-2-a"
}
```

**Status Values:**
- `operational` — All critical dependencies healthy, P99 latency <500ms
- `degraded` — 1+ dependency unhealthy OR P99 latency 500ms–1s
- `failing` — 2+ dependencies down OR P99 latency >1s
- `down` — Worker not responding or 5xx errors

**Implementation in videoking:**

Create `src/routes/admin/health.ts`:

```typescript
import { Hono } from 'hono';
import { requireRole } from '@latimer-woods-tech/auth';

const healthRoute = new Hono();

healthRoute.get('/health', requireRole(['admin:videoking', 'operator:*']), async (c) => {
  const { DB, SENTRY_DSN, POSTHOG_KEY } = c.env;
  
  const startTime = Date.now();
  const dependencies: Record<string, string> = {};
  
  try {
    // Test database connection
    const result = await DB.query('SELECT 1');
    dependencies.database = result.length ? 'healthy' : 'unhealthy';
  } catch (e) {
    dependencies.database = 'unhealthy';
  }
  
  try {
    // Test Stripe connection
    const stripe = initStripe(c.env.STRIPE_SECRET_KEY);
    await stripe.accounts.retrieve();
    dependencies.stripe = 'healthy';
  } catch (e) {
    dependencies.stripe = 'unhealthy';
  }
  
  // Similar tests for Cloudflare Stream, Deepgram, Sentry, PostHog
  
  const latency = Date.now() - startTime;
  const status = Object.values(dependencies).every(d => d === 'healthy')
    ? 'operational'
    : 'degraded';
  
  return c.json({
    status,
    timestamp: new Date().toISOString(),
    uptime: 99.95, // from metrics store
    latency: { p50: 45, p95: 120, p99: latency },
    dependencies,
    version: c.env.VERSION,
    instance_id: c.env.INSTANCE_ID,
  }, status === 'operational' ? 200 : 503);
});

export { healthRoute };
```

**Integration in Factory Admin:**

```typescript
// Poll every 30 seconds
setInterval(async () => {
  const response = await fetch('https://videoking.adrper79.workers.dev/api/admin/health', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const health = await response.json();
  
  // Update dashboard card: green if 'operational', yellow if 'degraded', red if 'failing'
  updateHealthCard('videoking', health);
}, 30000);
```

---

### 2. GET /api/admin/metrics

**Purpose:** Real-time operational metrics (requests, errors, users, revenue, etc.)

**Auth:** `admin:videoking` role

**Rate Limit:** 60 req/min per admin

**Response (200 OK):**
```json
{
  "timestamp": "2026-04-28T10:31:00Z",
  "app": "videoking",
  "requests": {
    "total": 124500,
    "last_hour": 1250,
    "error_rate": 0.02,
    "avg_latency_ms": 92,
    "p99_latency_ms": 450
  },
  "videos": {
    "total": 4200,
    "ready": 3850,
    "processing": 200,
    "failed": 50,
    "new_today": 18
  },
  "users": {
    "active_creators": 520,
    "active_viewers": 8400,
    "new_creators_today": 3,
    "mau": 125000
  },
  "payouts": {
    "pending": 250000,
    "processed_today": 45000,
    "processed_this_month": 3200000
  },
  "database": {
    "connections": 8,
    "pool_max": 10,
    "slow_queries_last_hour": 0
  },
  "revenue": {
    "today": 12500,
    "monthly_projection": 375000,
    "stripe_balance": 850000
  }
}
```

**Implementation in videoking:**

Create `src/routes/admin/metrics.ts`:

```typescript
healthRoute.get('/metrics', requireRole(['admin:videoking']), async (c) => {
  const { DB } = c.env;
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600000);
  
  // Fetch from analytics tables (or PostHog API)
  const requestCount = await DB.query(
    `SELECT COUNT(*) as count FROM factory_events 
     WHERE event = 'http.request' AND timestamp > $1`,
    [hourAgo]
  );
  
  const videoStats = await DB.query(
    `SELECT status, COUNT(*) as count FROM videos GROUP BY status`
  );
  
  const payoutStats = await DB.query(
    `SELECT SUM(amount) as pending FROM payouts WHERE status = 'pending'`
  );
  
  // Build response
  return c.json({
    timestamp: now.toISOString(),
    app: 'videoking',
    requests: {
      total: 124500, // from cumulative storage
      last_hour: requestCount[0].count,
      error_rate: 0.02,
      avg_latency_ms: 92,
      p99_latency_ms: 450
    },
    videos: {
      total: videoStats.reduce((sum, row) => sum + row.count, 0),
      ready: videoStats.find(r => r.status === 'ready')?.count || 0,
      // ... etc
    },
    payouts: {
      pending: payoutStats[0].pending || 0,
      processed_today: 45000,
      processed_this_month: 3200000
    }
  });
});
```

**Integration in Factory Admin:**

```typescript
// Fetch metrics to populate dashboard
const metrics = await fetch('https://videoking.adrper79.workers.dev/api/admin/metrics', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// Update widgets
updateWidget('RequestsPerMinute', metrics.requests.last_hour);
updateWidget('ErrorRate', metrics.requests.error_rate);
updateWidget('VideoQueue', metrics.videos.processing);
updateWidget('RevenueToday', metrics.revenue.today);
```

---

### 3. POST /api/admin/events

**Purpose:** Bulk event collection for Factory-wide analytics (funnel, retention, cohorts)

**Auth:** `admin:*` role (Factory Admin can record events for analysis)

**Rate Limit:** 1000 events/min per admin

**Request:**
```json
{
  "events": [
    {
      "userId": "user_123",
      "event": "payout_processed",
      "properties": {
        "amount": 15000,
        "currency": "USD",
        "creatorTier": 2
      },
      "timestamp": "2026-04-28T10:31:00Z"
    }
  ]
}
```

**Response (202 Accepted):**
```json
{
  "accepted": 5,
  "failed": 0,
  "errors": []
}
```

**Implementation in videoking:**

Create `src/routes/admin/events.ts`:

```typescript
healthRoute.post('/events', requireRole(['admin:*']), async (c) => {
  const body = await c.req.json();
  const { events } = body;
  
  if (!Array.isArray(events) || events.length === 0) {
    return c.json({ accepted: 0, failed: 0 }, 400);
  }
  
  if (events.length > 1000) {
    return c.json({ 
      accepted: 0, 
      failed: events.length, 
      errors: ['Max 1000 events per request']
    }, 400);
  }
  
  // Insert into factory_events table
  const results = await Promise.all(
    events.map(evt => 
      DB.query(
        `INSERT INTO factory_events (user_id, event, properties, timestamp) 
         VALUES ($1, $2, $3, $4)`,
        [evt.userId, evt.event, JSON.stringify(evt.properties), evt.timestamp]
      ).catch(e => ({ error: e.message }))
    )
  );
  
  const failed = results.filter(r => r.error).length;
  const accepted = results.length - failed;
  
  return c.json({ accepted, failed, errors: [] }, 202);
});
```

---

## Authentication & Rate Limiting

All 3 endpoints require:

1. **JWT in Authorization header:** `Bearer <JWT_TOKEN>`  
   - JWT from Factory Auth service (`@latimer-woods-tech/auth`)
   - Must include role `admin:videoking`, `operator:*`, or `admin:*`

2. **Rate limiting:**
   - `/health`: 60 req/min (operators can check often)
   - `/metrics`: 60 req/min (dashboard refresh every 30s = 2 req/min, leaves headroom)
   - `/events`: 1000 events/min (bulk upload)

3. **CORS:** Allow Factory Admin domain only

**Implementation using Factory Auth middleware:**

```typescript
// In src/index.ts
import { authMiddleware, requireRole } from '@latimer-woods-tech/auth';
import { rateLimitMiddleware } from '@latimer-woods-tech/analytics';

app.use('*', authMiddleware(c.env.JWT_SECRET));

app.use('/api/admin/*', 
  rateLimitMiddleware({
    limit: 60,
    window: 60000, // 1 minute
  }),
  requireRole(['admin:*', 'operator:*'])
);
```

---

## Monitoring in Factory Admin

**Dashboard showing all 3 endpoints:**

```
┌─────────────────────────────────────────────────────┐
│ Factory Admin Dashboard                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  App Health (GET /api/admin/health)                │
│  ┌──────────────────────────────────────────────┐  │
│  │ ✅ videoking    │ 99.95% uptime | P99: 450ms │  │
│  │ ✅ primeself    │ 99.92% uptime | P99: 320ms │  │
│  │ ✅ cypher       │ 99.88% uptime | P99: 580ms │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Real-time Metrics (GET /api/admin/metrics)        │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📊 Requests/min: 1,250  | Error Rate: 0.02% │  │
│  │ 💰 Revenue Today: $12,500                    │  │
│  │ 📹 Videos Processing: 200                    │  │
│  │ 💸 Pending Payouts: $250,000                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Bulk Events (POST /api/admin/events)              │
│  ┌──────────────────────────────────────────────┐  │
│  │ Accepted: 5,240 events | Failed: 3          │  │
│  │ Last bulk upload: 2 min ago                  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Testing

**Unit Tests:**

```typescript
// src/routes/admin/__tests__/health.test.ts
describe('GET /api/admin/health', () => {
  it('returns 200 when all dependencies healthy', async () => {
    const res = await app.request(
      new Request('http://localhost/api/admin/health', {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('operational');
    expect(data.dependencies.database).toBe('healthy');
  });
  
  it('returns 503 when database unhealthy', async () => {
    // Mock DB to fail
    const res = await app.request(new Request(...));
    expect(res.status).toBe(503);
    expect(data.status).toBe('degraded');
  });
});
```

**Integration Tests:**

```typescript
// e2e test: Factory Admin polls videoking /health every 30s
// Then calls /metrics to update dashboard
// Then calls /events to log the check itself
```

---

## Implementation Checklist

**Before May 5 sign-off:**

- [ ] All 3 endpoints implemented in videoking worker
- [ ] Auth middleware wired (JWT validation + role check)
- [ ] Rate limiting configured per endpoint
- [ ] CORS headers set (Factory Admin domain)
- [ ] Responses match contract exactly (no extra/missing fields)
- [ ] Unit tests for each endpoint (3+ test cases per)
- [ ] Integration test: Factory Admin can consume all 3 endpoints
- [ ] Performance: All endpoints respond in <500ms
- [ ] Error handling: 401 if no JWT, 403 if wrong role, 429 if rate limited
- [ ] Documentation: README updated with endpoint specs
- [ ] Deployed to staging (verify from Factory Admin staging)

---

## Exit Criteria

**T4.4 is complete when:**
✅ All 3 endpoints implemented + tested  
✅ Factory Admin can call each endpoint + parse response  
✅ Health endpoint correctly reflects dependency status  
✅ Metrics endpoint populated with real videoking data  
✅ Events endpoint correctly logs Factory Admin actions  
✅ Rate limiting verified (test exceeding limits)  
✅ Deployed + live on videoking.adrper79.workers.dev  
✅ Documented in IMPLEMENTATION_MASTER_INDEX.md

---

## Files to Create/Modify

**New Files:**
- `src/routes/admin/index.ts` (exports all 3 routes)
- `src/routes/admin/health.ts` (GET /api/admin/health)
- `src/routes/admin/metrics.ts` (GET /api/admin/metrics)
- `src/routes/admin/events.ts` (POST /api/admin/events)
- `src/routes/admin/__tests__/health.test.ts`
- `src/routes/admin/__tests__/metrics.test.ts`
- `src/routes/admin/__tests__/events.test.ts`

**Modified Files:**
- `src/index.ts` (add admin routes + middleware)
- `src/env.ts` (add INSTANCE_ID, VERSION to schema)
- `README.md` (add "Admin Endpoints" section)

---

## Related Docs

- [Factory Admin Telemetry Contract](docs/packages/factory-admin-telemetry-contract.mdx) — Design specs
- [videoking API Documentation](docs/videoking/API.md) — Full API reference
- [IMPLEMENTATION_SCORECARD.md](../IMPLEMENTATION_SCORECARD.md) — Phase D status
