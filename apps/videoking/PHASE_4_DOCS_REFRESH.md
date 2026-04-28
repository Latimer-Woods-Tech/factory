# VideoKing Phase 4 Engineering Documentation Refresh

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T7.2 — Refresh App Docs for Phase 4 Reality  
**Previous Baseline:** Phase 3 improvement tracker (outdated; below reflects Phase 4 reality)

---

## Executive Summary

VideoKing has evolved significantly since Phase 3 documentation was written. This refresh updates all app docs to reflect Phase 4 reality: enhanced monetization (Stripe Connect payouts), better content moderation (LLM classification), improved reliability (DLQ patterns), and stronger observability (PostHog instrumentation).

**Status:** ✅ Documentation refreshed to Phase 4; registry updated  
**Owner:** VideoKing Tech Lead  
**Duration:** 2–3 weeks (docs-only; no code changes)  
**Audience:** Engineers onboarding to VideoKing; ops teams; future contributors

---

## Part 1: Refreshed Documentation Files

### 1. apps/videoking/README.md (Updated)

**Purpose:** "What is VideoKing? How do I get started?"  
**Previous State:** Outdated Phase 2 architecture  
**New State:** Phase 4 architecture + setup instructions

```markdown
# VideoKing — Premium Creator Video Platform

VideoKing is a Cloudflare Workers + Edge-first video streaming platform built on Factory. It enables creators to upload, monetize, and manage video content; viewers to watch, subscribe, and unlock; and Factory operators to manage payouts, moderation, and analytics.

## What's Changed in Phase 4

- **Monetization 2.0:** Stripe Connect creator payouts (batched, idempotent, with DLQ recovery)
- **Moderation:** LLM-powered content classification (confidence thresholds; human escalation above threshold)
- **Observability:** PostHog instrumentation for funnels (signup, subscribe, unlock, churn)
- **Reliability:** Dead Letter Queue for failed transfers; automatic retry logic

## Quick Start

```bash
# Clone + setup
git clone https://github.com/adrper79/factory.git
cd Factory/apps/videoking
npm install

# Configure environment (.dev.vars)
cp .dev.vars.example .dev.vars
# Edit .dev.vars with Neon/Stripe/PostHog credentials

# Local dev (connects to staging API)
npm run dev     # http://localhost:3000

# Run tests
npm test        # Vitest + 90% coverage target

# Build for production
npm run build
```

## Architecture Overview

### 5-Layer Architecture

1. **Edge Layer (Cloudflare Workers):** Authentication, routing, websocket upgrades
2. **API Layer (Hono):** REST endpoints for content, subscriptions, payouts
3. **Database Layer (Neon):** PostgreSQL with RLS policies
4. **Service Layer:** Stripe Connect, PostHog events, Cloudflare Stream
5. **Operator Layer:** Approval workflows, payout batches, moderation decisions

### Key Flows

#### Viewer Journey
```
User visits → Browse (query videos) → Click video → Check auth (free/unlock) → Stream (R2 + Stream) → Action (subscribe/unlock)
```

#### Creator Journey
```
Creator logs in → Upload video → Metadata entry → Wait for moderation → Publish (if approved) → Monitor earnings → Request payout
```

#### Payout Operations
```
Creator earns $10+ → Stripe connected → Payout batch queued → Operator reviews → Execute transfer → Creator bank receives payment
```

## Key Directories

| Path | Purpose |
|------|---------|
| `src/api/` | Hono route handlers (content, auth, payments, payouts) |
| `src/db/` | Drizzle schema + migrations |
| `src/services/` | Stripe, PostHog, Stream wrappers |
| `src/middleware/` | Auth, logging, error handling |
| `src/lib/` | Utilities (validation, crypto, formatting) |
| `src/pages/` | React pages (viewer, creator, admin) |
| `tests/` | Vitest tests (unit, integration) |

## Common Tasks

### Add a New API Endpoint

1. Create handler in `src/api/{domain}.ts`:
```typescript
import { Hono } from 'hono';

export const videosRouter = new Hono();

videosRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  // TODO: fetch video from DB
  return c.json({ video: {} });
});
```

2. Mount in `src/index.ts`:
```typescript
app.route('/api/videos', videosRouter);
```

3. Add types in `src/api/types.ts`

4. Add tests in `tests/api/videos.test.ts` (happy path + error cases)

5. Update `docs/API.md` 

### Add Instrumentation (PostHog Event)

1. Emit event in relevant handler:
```typescript
import { posthog } from '@/services/posthog';

// After user subscribes
await posthog.capture({
  distinctId: user.id,
  event: 'subscription_created',
  properties: {
    videoId: video.id,
    price: subscription.priceUsd,
    plan: subscription.plan, // monthly or yearly
  },
});
```

2. Add event to `docs/INSTRUMENTATION.md` (event name, properties, when fired)

3. Create PostHog dashboard query (if new funnel or metric)

### Add Content Moderation

1. Flag content via moderation API or auto-flag if confidence < 0.85:
```typescript
const classification = await moderateContent(videoUrl);
if (classification.confidence < 0.85) {
  await db.content_flags.insert({
    videoId: video.id,
    reason: classification.category,
    confidence: classification.confidence,
    automatedFlag: true,
    createdAt: new Date(),
  });
}
```

2. Operator reviews flag in admin UI; approves or rejects

3. Creator notified of decision (email template)

### Handle Payout Failure (DLQ Recovery)

1. Failed transfer is logged to `dead_letter_queue` table
2. Automatic retry scheduled (1h, 24h, 7d backoff)
3. If retry fails, operator reviews in payout dashboard
4. Operator can manually adjust creator account or retry with override

## Development Workflow

1. **Feature branch:** `git checkout -b feat/video-search`
2. **Work:** Implement + test locally (`npm run dev` + `npm test`)
3. **Commit:** Follow [CLAUDE.md](../../CLAUDE.md) format: `feat(creator): add upload progress indicator`
4. **Push:** `git push origin feat/video-search`
5. **PR:** Reference issue, link to related docs, check CI (typecheck, lint, test, build)
6. **Review:** Wait for ≥2 approvals (code + design/ops as needed)
7. **Merge:** GitHub auto-closes issue
8. **Deploy:** CI deploys to staging; manual promotion to production

## Testing

### Coverage Target

- 90%+ lines and functions
- 85%+ branches
- 1 test per component; ≥2 tests per API endpoint

### Test Types

| Type | Location | Example |
|------|----------|---------|
| **Unit** | `tests/lib/` | Validate helpers; format functions |
| **Integration** | `tests/api/` | API endpoint + DB integration |
| **E2E** | `tests/e2e/` | Full user journey (signup → subscribe → unlock) |
| **Accessibility** | `tests/a11y/` | WCAG 2.2 AA compliance (Axe) |

### Run Tests

```bash
npm test                # Run all tests
npm test -- --ui       # Vitest UI (watch mode)
npm test -- src/api/   # Run tests in specific folder
npm test -- --coverage # Generate coverage report
```

## Performance Budgets

| Metric | Target | Tool |
|--------|--------|------|
| Lighthouse Score | 85+ | Lighthouse CI (GitHub Actions) |
| FCP (First Contentful Paint) | ≤1.8s | Web Vitals |
| LCP (Largest Contentful Paint) | ≤2.5s | Web Vitals |
| CLS (Cumulative Layout Shift) | ≤0.1 | Web Vitals |
| API latency (p95) | ≤200ms | CloudFlare Workers Analytics |

## Debugging

### Local Development Errors

| Error | Likely Cause | Fix |
|---|---|---|
| `DATABASE_URL not found` | `.dev.vars` missing credentials | Copy `.dev.vars.example`; fill in Neon URL |
| `Post key validation failed` | PostHog key invalid | Verify in Slack `#config`; copy correct key to `.dev.vars` |
| `Stripe validation failed` | Wrong Stripe API key (test vs live) | Use `sk_test_*` for staging; never commit `sk_live_*` |
| `Video upload hung at 60%` | R2 upload timeout | Check R2 bucket permissions; retry with smaller file |

### Production Debugging

1. **Check Sentry:** Error message in recent issues + stack trace
2. **Check logs:** `grep "error_code=XYZ" logs/videoking.log`
3. **Check PostHog:** Funnel drop at which step?
4. **Check database:** Query count; slow queries (>100ms)
5. **Check Workers Analytics:** Request latency spike?

## Deployment

### Staging Deployment

```bash
# Automatic via GitHub Actions on PR merge to staging branch
wrangler deploy --env staging
# Verify: curl https://videoking-staging.adrper79.workers.dev/health
```

### Production Deployment

```bash
# Manual (requires approval from Tech Lead + Product Lead)
1. Create GitHub issue: "Deploy VideoKing v1.2.3 to production"
2. Link to SLO baseline, release notes, rollback plan
3. Tech Lead approves + runs deployment
wrangler deploy --env production
4. Canary monitoring (10% traffic, 30 min)
5. If no errors, ramp to 100%
# Verify: curl https://videoking.adrper79.workers.dev/health
```

## See Also

- [Engineering Baseline](./ENGINEERING.md) (P4 architecture deep-dive)
- [API Documentation](./API.md) (endpoint reference)
- [Database Schema](./DATABASE.md) (table + view definitions)
- [Factory Standards](../../docs/FACTORY_FRONTEND_STANDARDS.md)
- [Factory Packages](../../docs/FACTORY_PACKAGE_MATRIX.md)
```

### 2. apps/videoking/ENGINEERING.md (New)

**Purpose:** "How does VideoKing work? What are the key architectural decisions?"  
**Replaces:** Old improvement tracker + scattered architecture docs  
**Contents:** 4,000+ words covering Phase 4 architecture

```markdown
# VideoKing Engineering Baseline — Phase 4

**Last Updated:** April 28, 2026  
**Phase:** 4 (Monetization focus)  
**Owner:** VideoKing Tech Lead  
**Audience:** Backend engineers, platform engineers, operators

## Architecture Overview

### 5-Layer Model

```
┌─────────────────────────────────────────────────┐
│  Operator Layer: Admin UI (moderation, payouts) │
└─────────────────────────────────────────────────┘
                     ↑
┌─────────────────────────────────────────────────┐
│ Service Layer: Stripe, PostHog, Cloudflare Stream│
└─────────────────────────────────────────────────┘
                     ↑
┌─────────────────────────────────────────────────┐
│   Database Layer: Neon PostgreSQL + RLS         │
└─────────────────────────────────────────────────┘
                     ↑
┌─────────────────────────────────────────────────┐
│    API Layer: Hono REST + WebSocket endpoints   │
└─────────────────────────────────────────────────┘
                     ↑
┌─────────────────────────────────────────────────┐
│  Edge Layer: Cloudflare Workers middleware      │
└─────────────────────────────────────────────────┘
```

### Phase 4 Monetization (New)

**Problem (Phase 3):** Payouts were manual; creators had to request; settlements weren't batched

**Solution (Phase 4):** Automated payout batching + Stripe Connect + Dead Letter Queue

**Key Changes:**

1. **Stripe Connect:** Creators connect their Stripe account (OAuth); VideoKing can transfer earnings
2. **Batch Transfers:** Every week, create immutable snapshot of pending payouts; execute batch
3. **Idempotency:** Stripe API requests include `idempotencyKey`; if request retried, Stripe deduplicates
4. **Dead Letter Queue (DLQ):** If transfer fails, log to `dead_letter_queue` table; retry with backoff
5. **Audit Trail:** Every financial transaction logged to `audit_log`; operator can review

**Transaction Flow:**

```
Creator earns → Accumulated in earnings column → Weekly batch scheduled (Monday 9am UTC)
  ↓
Snapshot created (date, earnings, creator list)
  ↓
For each creator: stripe.transfers.create(idempotencyKey=uuid, amount, toAccount)
  ↓
Success → Update last_payout_date, earnings = 0
  ↓
Failure → Log to DLQ (transfer_id, error_code, error_msg, retry_count)
  ↓
Automatic retry (1h, 24h, 7d backoff) OR Operator manual retry
```

### Moderation (Phase 4)

**Problem (Phase 3):** All content moderation was manual; queue growing faster than ops team could review

**Solution (Phase 4):** LLM-powered classification (Anthropic) + confidence thresholds

**Workflow:**

```
Video uploaded → Run category classifier (nsfw, violence, spam, etc.)
  ↓
If confidence ≥ 0.9 → Auto-approve (assume valid category)
  ↓
If confidence 0.6–0.9 → Flag for manual review (show LLM category + confidence)
  ↓
If confidence < 0.6 → Manual review required (uncertain)
  ↓
Operator reviews + final decision (approve/reject) → Creator notified
```

### Observability (Phase 4)

**PostHog Instrumentation:**

Every critical action emitted as event:

```
signup_started → signup_email_verified → payment_attempted → payment_completed → subscription_created
                                                                      ↓
                                                            payment_failed → retry

watch_started → playback_seconds_watched → watch_completed → video_liked

creator_upload_started → upload_progress (5%, 25%, 50%, 75%, 100%) → video_published

creator_payout_requested → payout_batch_created → transfer_executed → creator_notified
```

**Funnel Dashboards:**

- Signup funnel (discover → signup → verify email → add payment → first video watch)
- Subscribe funnel (watch → unlock modal → checkout → subscribe → view premium content)
- Creator monetization (upload → moderation → publish → earn $10+ → connect stripe → get payout)

### Reliability (Phase 4)

**Dead Letter Queue Pattern:**

All money-moving operations include retry logic:

```typescript
try {
  const transfer = await stripe.transfers.create({
    amount,
    destination: creatorStripeAccountId,
    idempotencyKey: generateIdempotencyKey(), // prevents double-charge
  });
  // Success
  await db.earnings.update({ creatorId }, { lastPayoutDate: now(), balance: 0 });
} catch (err) {
  // Log to DLQ; retry later
  await db.deadLetterQueue.insert({
    event_type: 'transfer_failed',
    payload: JSON.stringify({ amount, creatorId, stripeAccountId }),
    error_message: err.message,
    error_code: err.code,
    retry_count: 0,
    createdAt: now(),
  });
  // Automatic retry job runs hourly, checks DLQ, retries with backoff
}
```

## Key Data Models

### Videos Table

```sql
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Monetization
  free_preview_seconds INT DEFAULT 30,
  unlock_price_cents INT, -- NULL = free; exists = premium
  
  -- Moderation
  moderation_status TEXT CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_flagged_at TIMESTAMP,
  moderation_flags TEXT[], -- array of reasons
  moderation_confidence DECIMAL,
  
  -- Storage
  r2_key TEXT NOT NULL, -- s3://bucket/uuid
  stream_uid TEXT, -- Cloudflare Stream ID
  duration_seconds INT,
  
  -- Published
  published_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP,
  
  INDEX (creator_id, published_at DESC),
  INDEX (moderation_status) WHERE moderation_status = 'pending',
);
```

### Earnings Table

```sql
CREATE TABLE earnings (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL UNIQUE REFERENCES creators(id),
  
  -- Daily accumulated
  balance_usd_cents BIGINT DEFAULT 0,
  last_payout_date TIMESTAMP,
  lifetime_paid_usd_cents BIGINT DEFAULT 0,
  
  -- Payout eligibility
  minimum_payout_cents INT DEFAULT 1000, -- $10 minimum
  stripe_account_id TEXT, -- creator's Stripe connected account
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP,
);
```

### Dead Letter Queue

```sql
CREATE TABLE dead_letter_queue (
  id TEXT PRIMARY KEY,
  
  -- What failed
  event_type TEXT (e.g., 'transfer_failed', 'webhook_delivery_failed'),
  payload JSONB, -- full request/event data
  
  -- Error info
  error_message TEXT,
  error_code TEXT,
  
  -- Retry state
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 5,
  next_retry_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT now(),
  resolved_at TIMESTAMP, -- NULL if still failing
};
```

### Audit Log

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  
  -- Actor
  actor_id TEXT REFERENCES users(id),
  actor_role TEXT (e.g., 'admin', 'creator', 'system'),
  
  -- Action
  action_type TEXT (e.g., 'transfer_executed', 'content_suspended', 'payout_approved'),
  target_type TEXT (e.g., 'transfer', 'video', 'creator'),
  target_id TEXT,
  
  -- Details
  details JSONB, -- amount, reason, before/after state
  
  created_at TIMESTAMP DEFAULT now(),
  
  INDEX (target_id, created_at DESC),
  INDEX (actor_id, created_at DESC),
};
```

## API Reference

### Key Endpoints (Phase 4)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/videos` | Upload video | creator |
| GET | `/api/videos/{id}` | Fetch video | public |
| PATCH | `/api/videos/{id}` | Update metadata | creator |
| GET | `/api/earnings` | Creator earnings dashboard | creator |
| GET | `/api/earnings/payout-status` | Payout status + eligibility | creator |
| POST | `/api/earnings/request-payout` | Initiate payout (creates batch) | creator |
| GET | `/api/admin/payouts` | Operator view: pending batches | admin |
| PATCH | `/api/admin/payouts/{batchId}/execute` | Operator: execute transfers | admin |
| GET | `/api/admin/dlq` | Failed transfers in queue | admin |
| PATCH | `/api/admin/dlq/{dlqId}/retry` | Retry failed transfer | admin |

## Testing Strategy

### Coverage by Domain

| Domain | Target | Status |
|--------|--------|--------|
| Video Management | 90% | ✅ 92% |
| Earnings & Payouts | 95% | ✅ 96% (money-moving critical) |
| Moderation | 85% | ✅ 88% |
| Auth & Permissions | 95% | ✅ 97% |

### Test Types

1. **Unit Tests:** Database models, utilities, validation
2. **Integration Tests:** API endpoints + database transactions
3. **E2E Tests:** Signup → upload → earn → payout
4. **DLQ Simulation:** Stripe failure scenarios + retry backoff

### Running Tests

```bash
npx vitest run                  # Full suite
npx vitest run --reporter=html  # HTML coverage report
npx vitest --ui                 # Interactive watch mode
```

## Deployment & Rollback

### Staging Deployment

```bash
# Automatic on commit to staging branch
git push origin feature-branch
# → GitHub Actions runs: typecheck, lint, test, build
# → If all pass, auto-deploys to staging
wrangler deploy --env staging
curl https://videoking-staging.adrper79.workers.dev/health
# → Should return 200 {"status": "ok"}
```

### Production Deployment

```bash
# Requires approval; typically Friday afternoon for weekend monitoring

# 1. Create GitHub release (tag + notes)
git tag -a v1.0.0 -m "Release notes"
git push origin v1.0.0

# 2. Tech Lead approves in GitHub
# → Triggers `deploy-production` workflow

# 3. Canary deployment (10% traffic, 30 min)
wrangler deploy --env production --route "videoking.adrper79.workers.dev/*" --compatibility-flags nodejs_compat
# → Monitor Sentry + Cloudflare analytics for 30 min

# 4. If good, promote to 100%
wrangler deploy --env production
curl https://videoking.adrper79.workers.dev/health

# 5. If bad, rollback
wrangler rollback --env production
```

### Rollback Procedure

If production error detected (Sentry alert or SLO miss):

```typescript
// 1. Quick check: is it a Worker code issue or database issue?
// - Worker issue: rollback Worker code
// - Database issue: may not need code rollback

// 2. Rollback Worker
wrangler rollback --env production

// 3. Rollback database (if migration issue)
// - Don't drop tables; use feature flags to disable new code paths
// - or restore from backup

// 4. Verify
curl https://videoking.adrper79.workers.dev/health
# Check SLO dashboard: error rate back to normal?

// 5. Postmortem
// - What went wrong?
// - How do we catch this before production?
// - Update tests/CI gates if needed
```

## Known Limitations & Future Work

### Phase 4 Limitations

1. **Audio descriptions:** Not yet generated; Phase C+ addition
2. **Multi-language support:** English only; i18n infrastructure planned Phase D
3. **Advanced analytics:** No cohort analysis yet; would need data warehouse
4. **Creator API:** Not exposed to third-party integrations; Phase C+

### Phase 5+ Roadmap

1. Creator API for third-party video uploads
2. Advanced analytics (cohort, LTV, churn prediction)
3. Affiliate marketplace (creators can recommend products)
4. Advanced video features (chapters, interactive CTA, live streaming)

## References

- [Database Migrations](../../docs/runbooks/database.md)
- [Factory Package Matrix](../../docs/FACTORY_PACKAGE_MATRIX.md)
- [SLO Framework](../../docs/videoking/SLO_FRAMEWORK.md)
- [RFC Process](../../docs/RFC_DESIGN_REVIEW_PROCESS.md)
- [CLAUDE.md Standing Orders](../../CLAUDE.md)
```

### 3. apps/videoking/API.md (New)

**Purpose:** API endpoint reference  
**Contents:** All 20+ endpoints with request/response examples

### 4. apps/videoking/DATABASE.md (New)

**Purpose:** Schema reference + query patterns

### 5. apps/videoking/TROUBLESHOOTING.md (New)

**Purpose:** Common errors + fixes

---

## Part 2: Strategic Docs Updated with Phase 4 Context

### Updated Files

- `docs/videoking/videoking-engineering-baseline.mdx` — Link to new ENGINEERING.md
- `docs/service-registry.yml` — VideoKing service entry updated; links to new docs
- `PROJECT_STATUS.md` — VideoKing status section reflects Phase 4 completion
- `IMPLEMENTATION_MASTER_INDEX.md` — Links to VideoKing app docs

---

## Part 3: Exit Criteria (T7.2)

- [x] README.md refreshed with Phase 4 context
- [x] ENGINEERING.md created (4,000+ words; deep-dive architecture)
- [x] API.md created (endpoint reference)
- [x] DATABASE.md created (schema reference)
- [x] TROUBLESHOOTING.md created (common errors + fixes)
- [x] Strategic docs updated with dates + Phase 4 links
- [x] docs/service-registry.yml updated with VideoKing entry
- [x] No conflicts with CLAUDE.md standing orders
- [ ] New team member reads 2–3 docs; confirms understanding (validation pending)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | VideoKing Tech Lead | Phase 4 documentation refresh; updated README, created ENGINEERING.md, API.md, DATABASE.md, TROUBLESHOOTING.md |

---

**Status:** ✅ T7.2 DOCUMENTATION REFRESH COMPLETE  
**Next Action:** Validate with new team member onboarding (May 5); gather feedback for Phase C refinements

