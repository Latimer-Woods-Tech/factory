# Factory Admin Integration — Telemetry Contract & API Design

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T4.4 — Prepare Factory Admin Roadmap Linkage  
**Scope:** Define app-level telemetry contract so Factory Admin can aggregate portfolio health

---

## Executive Summary

Factory Admin (future portfolio management app) needs **standardized endpoints** from each app (VideoKing, future App X, etc.) to pull health metrics. This document defines the contract: 3 standard endpoints delivering JSON with health status, key metrics, and event streams.

**Status:** ✅ Contract finalized  
**Implementation:** Pending VideoKing + future apps (Phase C+)  
**Owner:** Platform Lead  
**Timeline:** Contract ready May 1; VideoKing implementation May 8–10

---

## Part 1: Telemetry Contract Overview

### Why This Matters

**Current State:** Factory Admin has no way to know if VideoKing is healthy without SSHing into ops. Each app could report differently (or not at all).

**Future State:** Factory Admin queries 3 standard endpoints from each app; gets health status, key metrics, and recent events in predictable JSON format.

**Use Cases:**
1. Portfolio dashboard shows: "VideoKing: ✅ Healthy (99.8% uptime this week)"
2. Incident detection: When one metric hits threshold, Factory Admin auto-alerts ops
3. Trend analysis: Compare App X metrics vs VideoKing vs industry benchmarks

---

## Part 2: Three Standard Endpoints

### Endpoint 1: `/api/admin/health`

**Purpose:** Quick health check  
**Method:** GET  
**Auth:** `Authorization: Bearer {factory-auth-token}` + role: `admin:read`  
**Cadence:** Polled every 60 seconds by Factory Admin

**Response (200 OK):**

```json
{
  "status": "healthy",  // "healthy" | "degraded" | "down"
  "timestamp": "2026-04-28T14:22:33Z",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "healthy", "latency_ms": 45 },
    "authentication": { "status": "healthy" },
    "video_stream": { "status": "healthy", "latency_ms": 120 },
    "stripe_webhooks": { "status": "healthy", "pending_count": 0 }
  },
  "error_rate_last_minute": 0.002,  // 0.2%
  "p95_latency_ms": 185,
  "uptime_seconds": 8640000  // since last deploy
}
```

**Error Response (5xx):**

```json
{
  "status": "down",
  "timestamp": "2026-04-28T14:22:33Z",
  "error": "database_connection_failed",
  "error_details": "Connection pool exhausted; 120 pending queries"
}
```

### Endpoint 2: `/api/admin/metrics`

**Purpose:** Key performance indicators  
**Method:** GET  
**Auth:** Same as `/health`  
**Query Params:** `?window=24h` (or 7d, 30d)  
**Cadence:** Polled every 5 minutes by Factory Admin

**Response (200 OK):**

```json
{
  "app_id": "videoking",
  "window": "24h",
  "timestamp": "2026-04-28T14:22:33Z",
  "metrics": {
    "user": {
      "active_users_dau": 45120,
      "new_signups": 320,
      "conversion_rate": 3.2  // signup → first watch
    },
    "content": {
      "videos_uploaded": 210,
      "videos_published": 198,
      "moderation_queue_pending": 12,
      "auto_approve_rate": 0.88  // 88% of content auto-approved
    },
    "payments": {
      "subscription_count": 8940,
      "monthly_recurring_revenue_usd": 112400.00,
      "net_new_subscriptions": 145,
      "churn_rate": 2.1,  // % of subs cancelled
      "failed_charges": 23,
      "creator_earnings_usd": 28560.00
    },
    "reliability": {
      "uptime_pct": 99.82,
      "error_budget_remaining_pct": 45,  // of monthly budget
      "p95_latency_ms": 185,
      "p99_latency_ms": 450,
      "error_rate": 0.18  // errors per 1000 requests
    },
    "payout": {
      "pending_payouts_usd": 5200.00,
      "failed_transfers_in_dlq": 2,
      "last_batch_status": "success",
      "last_batch_time": "2026-04-28T09:00:00Z"
    }
  },
  "slo_status": {
    "tier_1_pct": 99.82,  // vs target 99.9%
    "tier_1_status": "🟡 WARNING: 8% of error budget used",
    "tier_2_pct": 99.85,
    "tier_2_status": "✅ OK"
  }
}
```

### Endpoint 3: `/api/admin/events`

**Purpose:** Event stream for real-time monitoring  
**Method:** GET (WebSocket also supported for streaming)  
**Auth:** Same as `/health`  
**Query Params:** `?since={timestamp}&limit=100&severity=warn|error`  
**Cadence:** Polled every 10 seconds by Factory Admin (or WebSocket for real-time)

**Response (200 OK):**

```json
{
  "app_id": "videoking",
  "events": [
    {
      "timestamp": "2026-04-28T14:22:15Z",
      "severity": "error",
      "event_type": "payment_failure",
      "message": "Stripe charge declined; card expired",
      "details": {
        "subscription_id": "sub_xyz123",
        "creator_id": "creator_abc789",
        "charge_amount_usd": 9.99,
        "error_code": "card_expired",
        "attempt": 1,
        "will_retry": true,
        "next_retry_time": "2026-04-30T14:22:15Z"
      },
      "action_required": false,
      "affected_users": 1
    },
    {
      "timestamp": "2026-04-28T14:21:45Z",
      "severity": "warn",
      "event_type": "dlq_retention_warning",
      "message": "Dead letter queue has 2 unresolved transfers; oldest is 24h old",
      "details": {
        "dlq_count": 2,
        "oldest_dlq_item_age_hours": 24,
        "threshold_hours": 48
      },
      "action_required": true,
      "action_link": "https://videoking.adrper79.workers.dev/admin/dlq"
    },
    {
      "timestamp": "2026-04-28T14:19:00Z",
      "severity": "info",
      "event_type": "payout_batch_executed",
      "message": "Weekly payout batch completed: 156 creators paid $28,560",
      "details": {
        "batch_id": "batch_2026-04-28",
        "creator_count": 156,
        "total_amount_usd": 28560.00,
        "success_rate": 0.99,  // 1 failed out of 156
        "execution_time_seconds": 127
      },
      "action_required": false,
      "affected_users": 156
    }
  ],
  "pagination": {
    "total_events_since_param": 847,
    "returned": 3,
    "next_cursor": "evt_2026-04-28T14:18:59Z"
  }
}
```

---

## Part 3: Authentication & Authorization

### Factory Auth RBAC Integration

All 3 endpoints require:

```http
Authorization: Bearer {jwt-token}
```

Token must include `admin:read` permission (Factory Auth scope).

**VideoKing Implementation:**

```typescript
// In middleware
import { verifyAuth } from '@latimer-woods-tech/auth';

export const adminAuthMiddleware = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  
  const claims = await verifyAuth(token, env.JWT_SECRET);
  if (!claims.scope?.includes('admin:read')) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }
  
  c.set('adminClaims', claims);
  await next();
};

app.use('/api/admin/*', adminAuthMiddleware);
```

---

## Part 4: VideoKing Implementation Checklist

### Phase B Preparation (by May 10)

- [ ] Define response shapes in TypeScript types (already done above ✅)
- [ ] Wire up `/api/admin/health` endpoint (1 hour)
  - [ ] Health checks for database, auth, video stream, webhooks
  - [ ] Error rate + latency calculations
  - [ ] Test locally: `curl http://localhost:3000/api/admin/health`
- [ ] Wire up `/api/admin/metrics` endpoint (2 hours)
  - [ ] Query database for KPIs (DAU, subscriptions, MRR, failure rates)
  - [ ] Query PostHog for funnel metrics (conversion rates, churn)
  - [ ] Calculate SLO status (uptime vs target)
  - [ ] Test: `curl 'http://localhost:3000/api/admin/metrics?window=24h'`
- [ ] Wire up `/api/admin/events` endpoint (2 hours)
  - [ ] Query `audit_log` + `error_log` for recent events
  - [ ] Filter by severity (error, warn, info)
  - [ ] Pagination support
  - [ ] Test: `curl 'http://localhost:3000/api/admin/events?severity=error&limit=10'`
- [ ] Add CI/CD tests for endpoints (1 hour)
  - [ ] 200 response + valid JSON schema
  - [ ] Auth check (401 if no token, 403 if wrong scope)
  - [ ] Performance (endpoints respond in <500ms)
- [ ] Documentation: Add to `apps/videoking/API.md` (30 min)

**Total Effort:** ~6 hours (1 engineer, May 8–10)

### Phase C+ Usage (Future)

- Factory Admin queries `/api/admin/metrics` every 5 min from each app
- If any metric crosses threshold, Factory Admin aggregates + alerts ops
- Operators view portfolio dashboard: "1 app degraded; 6 healthy; 1 offline"

---

## Part 5: Schema Validation

All responses must pass JSON Schema validation (prevents breaking changes):

```json
// health-response.schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["status", "timestamp", "checks", "error_rate_last_minute", "p95_latency_ms"],
  "properties": {
    "status": { "enum": ["healthy", "degraded", "down"] },
    "timestamp": { "type": "string", "format": "date-time" },
    "version": { "type": "string" },
    "checks": { "type": "object" },
    "error_rate_last_minute": { "type": "number", "minimum": 0, "maximum": 1 },
    "p95_latency_ms": { "type": "integer", "minimum": 0 },
    "uptime_seconds": { "type": "integer", "minimum": 0 }
  }
}
```

---

## Part 6: Versioning & Evolution

### Current Version: 1.0

Backwards-compatible requirements:
- New fields can be added (Factory Admin ignores unknown fields)
- Existing fields cannot be removed or changed type
- New top-level endpoints get new paths (e.g., `/api/admin/metrics/v2`)

### Breaking Change Process

If major revision needed:
1. Add new endpoint (`/api/admin/metrics-v2`)
2. Keep v1 endpoint live for ≥6 months
3. Notify Factory Admin team 30 days before deprecation
4. Sunset v1 after 6-month grace period

---

## Part 7: Integration with Factory Admin

### Factory Admin Polling Strategy

```typescript
// factory-admin worker: src/jobs/poll-app-metrics.ts

const APPS = [
  { id: 'videoking', health_url: 'https://videoking.adrper79.workers.dev/api/admin/health' },
  { id: 'app-x', health_url: 'https://app-x.adrper79.workers.dev/api/admin/health' },
];

// Run every 60 seconds
export async function pollAppHealth(env) {
  for (const app of APPS) {
    try {
      const res = await fetch(app.health_url, {
        headers: { 'Authorization': `Bearer ${env.FACTORY_ADMIN_TOKEN}` }
      });
      const health = await res.json();
      
      // Store in time-series DB
      await env.DB.execute(
        `INSERT INTO app_health_history (app_id, status, error_rate, latency_p95, timestamp)
         VALUES (?, ?, ?, ?, NOW())`,
        [app.id, health.status, health.error_rate_last_minute, health.p95_latency_ms]
      );
      
      // Check for threshold breaches
      if (health.status === 'down') {
        await notifyOps(`🔴 ${app.id} is DOWN`, { app, health });
      } else if (health.error_rate_last_minute > 0.05) {
        await notifyOps(`🟡 ${app.id} error rate elevated`, { app, health });
      }
    } catch (err) {
      await notifyOps(`⚠️ Failed to poll ${app.id}`, { error: err.message });
    }
  }
}
```

---

## Part 8: Exit Criteria (T4.4)

- [x] Telemetry contract defined (3 endpoints with schemas)
- [x] Response shapes documented with examples
- [x] Authentication & authorization specified
- [x] VideoKing implementation roadmap (May 8–10)
- [x] JSON Schema validation specs created
- [x] Versioning & evolution policy documented
- [x] Factory Admin polling strategy sketched
- [ ] VideoKing endpoints implemented (May 8–10)
- [ ] Endpoints tested & verified (May 10)
- [ ] Integrated with Factory Admin prototype (Phase C+)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Platform Lead | T4.4 telemetry contract; 3 admin endpoints; auth integration; roadmap |

---

**Status:** ✅ T4.4 CONTRACT READY FOR IMPLEMENTATION  
**Next Action:** Implement endpoints in VideoKing (May 8–10); verify with Factory Admin polling (May 15+)

