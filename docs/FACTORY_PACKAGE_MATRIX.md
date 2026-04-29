# Factory Package Matrix: Core App Consumption & Reuse Guide

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T4.1 — Map Factory Packages to App Delivery Concerns  
**Reference:** VideoKing + Factory infrastructure

---

## Mission

Create one canonical matrix showing:
1. **Which Factory packages VideoKing actually uses** (not theoretical)
2. **For each package, what app-specific vs. shared logic applies**
3. **Consumption examples** that new apps can copy
4. **Gaps** (shared capabilities that are missing)

This becomes the onboarding blueprint for the next app.

---

## Part 1: VideoKing Package Consumption Map

### `@adrper79-dot/errors`

**Purpose:** Shared error types and formatting conventions  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | `AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `PaymentError`, `OperationError` |
| Where | Worker routes, Stripe webhook handlers, payment operations |
| App-specific layers | Custom error to HTTP response mapping (payment errors → 402, ops errors → 500) |
| Integration points | Thrown from Factory auth package; caught and formatted in middleware |
| Expected by other pkgs | Errors package provides base types; `monitoring` pkg expects errors conforming to `AppError` shape |

**Consumption Pattern (for new apps):**
```typescript
import { AppError, PaymentError, ValidationError } from '@adrper79-dot/errors';

// In route handler
if (!stripe_id) throw new ValidationError('stripe_id required for payout');

// Middleware catches and formats
try { ... } catch (err) {
  if (err instanceof PaymentError) return c.json({ error: err.message }, 402);
  if (err instanceof AppError) return c.json({ error: err.message }, err.statusCode);
}
```

**Gaps in VideoKing:** ✅ None — errors package is sufficient

---

### `@adrper79-dot/monitoring`

**Purpose:** Error tracking, Sentry integration, event annotations  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | `captureException()`, `captureMessage()`, `setTag()`, `setContext()` |
| Where | Webhook handlers (critical), payout operations, any revenue-affecting code |
| App-specific layers | Correlation ID injection (tied to viewer session), custom tags (creator_id, payout_batch_id) |
| Integration points | Initialized in Worker entry point; middleware injects context |
| Sentry DSN | Configured via `env.SENTRY_DSN` (wrangler.toml); one per environment |

**Consumption Pattern (for new apps):**
```typescript
import { captureException, setContext } from '@adrper79-dot/monitoring';
import { v4 as uuid } from 'uuid';

// Middleware
app.use(async (c, next) => {
  const correlationId = c.req.header('x-correlation-id') || uuid();
  c.set('correlationId', correlationId);
  await next();
});

// Route handler
try {
  const result = await executePayoutBatch(batchId);
  setContext('payout_batch', { id: batchId, status: 'success' });
} catch (err) {
  captureException(err, { tags: { payout_batch_id: batchId, severity: 'critical' } });
  throw err;
}
```

**Gaps in VideoKing:** ⚠️ **Correlation ID not tied to viewer session context.** Recommendation: Add session middleware that reads `x-correlation-id` header or creates UUID; attach to all Sentry events.

---

### `@adrper79-dot/logger`

**Purpose:** Structured JSON logging with correlation IDs  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | `log()`, `info()`, `warn()`, `error()`, `debug()` |
| Where | Worker logs (stdout → Cloudflare dashboard), payout batch operations, webhook processing |
| App-specific layers | Log levels per concern (DEBUG for local, INFO for staging, WARN for production) |
| Integration points | Used by auth, errors, monitoring packages internally |
| Output format | JSON with correlation_id, timestamp, message, context |

**Consumption Pattern (for new apps):**
```typescript
import { logger } from '@adrper79-dot/logger';

// Batch operation
logger.info('payout_batch_created', {
  batch_id: batchId,
  creator_count: creators.length,
  total_amount: totalAmount,
  correlation_id: c.get('correlationId'),
});

// Error with context
logger.error('payout_batch_failed', {
  batch_id: batchId,
  error: err.message,
  stack: err.stack,
  attempted_creator_ids: creatorIds,
  correlation_id: c.get('correlationId'),
});
```

**Gaps in VideoKing:** ✅ None — logger package is being used correctly

---

### `@adrper79-dot/auth`

**Purpose:** JWT token generation, verification, role-based middleware  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | `generateToken()`, `verifyToken()`, `authMiddleware()`, `requireRole()` |
| Where | Login/signup routes, all protected endpoints, admin/operator routes |
| App-specific layers | Role definitions (VIEWER, CREATOR, ADMIN, OPERATOR), permission checks |
| Integration points | Auth token stored in SecureContext (httpOnly cookie), verified on every request |
| Token format | JWT with { user_id, role, account_type, exp } |

**Consumption Pattern (for new apps):**
```typescript
import { authMiddleware, requireRole, generateToken, verifyToken } from '@adrper79-dot/auth';

// Protected route
app.get('/api/earnings', authMiddleware, async (c) => {
  const { user_id } = c.get('auth');
  const earnings = await getEarnings(user_id);
  return c.json(earnings);
});

// Admin-only route
app.post('/api/payouts/execute', authMiddleware, requireRole('ADMIN'), async (c) => {
  const { batch_id } = await c.req.json();
  await executePayout(batch_id);
  return c.json({ success: true });
});

// Login route
app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await authenticateUser(email, password);
  const token = generateToken({ user_id: user.id, role: user.role });
  return c.json({ token });
});
```

**Gaps in VideoKing:** ⚠️ **No JWT_SECRET rotation procedure.** Recommendation: Add runbook for secret rotation without breaking existing sessions (dual-key window).

---

### `@adrper79-dot/neon`

**Purpose:** PostgreSQL connection pooling, query builders, migrations  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | `getConnection()`, `withTx()`, `runMigration()` |
| Where | All database operations (earnings, payouts, subscriptions, webhooks) |
| App-specific layers | Drizzle ORM schema + queries, connection pool config per environment |
| Integration points | Hyperdrive binding provides connection pool; package wraps it |
| Schema location | `packages/schedule/schema.ts` (canonical Drizzle schema) |

**Consumption Pattern (for new apps):**
```typescript
import { getConnection, withTx } from '@adrper79-dot/neon';
import { earnings, payouts } from '@adrper79-dot/schedule/schema';
import { eq, sum } from 'drizzle-orm';

// Single query
const conn = getConnection(env);
const totalEarnings = await conn
  .select({ total: sum(earnings.amount) })
  .from(earnings)
  .where(eq(earnings.creator_id, userId));

// Transaction (for money-moving)
await withTx(env, async (tx) => {
  // Create payout request
  const [payout] = await tx
    .insert(payouts)
    .values({ creator_id, amount, status: 'pending' })
    .returning();

  // Clear earnings balance
  await tx
    .update(earnings)
    .set({ paid_out_amount: sql`paid_out_amount + ${amount}` })
    .where(eq(earnings.creator_id, userId));

  return payout;
});
```

**Gaps in VideoKing:**
⚠️ **No query optimization runbooks.** Recommendation: Document common slow queries (N+1, missing indexes) + fix patterns.
⚠️ **No row-level security (RLS) policies.** Recommendation: Add PG RLS for viewer, creator, admin tables.

---

### `@adrper79-dot/stripe`

**Purpose:** Stripe API wrappers, webhook validation, idempotency keys  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | `createPayment()`, `createTransfer()`, `handleWebhook()`, `validateSignature()` |
| Where | Checkout, subscription renewal, creator payouts, webhook handlers |
| App-specific layers | Entitlement logic (subscription unlock + download), payout batching (daily snapshot), retry strategy |
| Integration points | Stripe API key via env; webhook secret for signature verification |
| Idempotency | All money-moving operations use idempotency keys (prevents double-charge on retry) |

**Consumption Pattern (for new apps):**
```typescript
import { createPayment, createTransfer, handleWebhook, validateSignature } from '@adrper79-dot/stripe';

// Checkout: Create payment intent
app.post('/api/checkout', authMiddleware, async (c) => {
  const { tier_id, viewer_id } = await c.req.json();
  const tier = await getTierPricing(tier_id);
  const result = await createPayment({
    amount: tier.price_cents,
    currency: 'usd',
    customer_id: viewer_id,
    idempotency_key: `viewer_${viewer_id}_tier_${tier_id}_${Date.now()}`,
  });
  return c.json({ client_secret: result.client_secret });
});

// Webhook: Handle payment success
app.post('/webhooks/stripe', async (c) => {
  const body = await c.req.text();
  const signature = c.req.header('stripe-signature');
  
  try {
    const event = validateSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
    await handleWebhook(event);
    return c.json({ received: true });
  } catch (err) {
    logger.error('webhook_validation_failed', { error: err.message });
    return c.json({ error: 'signature_failed' }, 401);
  }
});

// Payout: Create transfer to creator connected account
await createTransfer({
  amount: totalAmount,
  currency: 'usd',
  destination: creatorStripeAccountId,
  description: `Payout batch ${batchId}`,
  idempotency_key: `batch_${batchId}`,
});
```

**Gaps in VideoKing:**
⚠️ **Idempotency keys not persisted in DB.** Recommendation: Add `stripe_idempotency_key` column to payouts table; check before creating transfer.
⚠️ **No DLQ for failed Stripe operations.** Recommendation: Use neon package to persist failed transfers; manual retry via operator dashboard.

---

### `@adrper79-dot/llm`

**Purpose:** Anthropic/Grok/Groq API wrappers, prompt versioning, usage tracking  
**VideoKing Usage:** ❌ **Not Used**

| Concern | Details |
|---------|---------|
| Why not used | No content generation, moderation, or recommendations yet |
| When new app needs it | If implementing copy generation, comment moderation, or video script synthesis |
| Exports available | `generateText()`, `moderateContent()`, `selectModel()`, `trackUsage()` |

**Consumption Pattern (future):**
```typescript
import { generateText, moderateContent } from '@adrper79-dot/llm';

// Video title/description generation
const script = await generateText({
  model: 'anthropic',
  prompt: `Generate a YouTube-style title and 3-line description for: [video topic]`,
  maxTokens: 200,
});

// Comment moderation
const isSafe = await moderateContent({
  text: userComment,
  context: 'video_comment',
  threshold: 0.8, // 80% confidence
});
```

---

### `@adrper79-dot/telephony`

**Purpose:** Telnyx + Deepgram + ElevenLabs wrappers for SMS, voice, and TTS  
**VideoKing Usage:** ❌ **Not Used**

| Concern | Details |
|---------|---------|
| Why not used | No SMS verification, phone support, or voice notifications yet |
| When new app needs it | SMS 2FA, voice alerts, automated call routing, TTS narration |
| Exports available | `sendSMS()`, `submitTranscriptionJob()`, `generateSpeech()` |

---

### `@adrper79-dot/analytics`

**Purpose:** PostHog event tracking, funnel definitions, analytics package  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | `track()`, `identify()`, `setUserProperties()`, `trackPageView()` |
| Where | Frontend (React): video watched, subscription initiated, creator upload started |
| Worker side | Backend events: webhook received, payout batch created, creator connected |
| App-specific setup | Event naming convention (video_played, subscription_success), property definitions (duration, tier, revenue) |
| Integration points | PostHog API key via env; frontend SDK via NPM |

**Consumption Pattern (for new apps):**
```typescript
// Backend
import { track } from '@adrper79-dot/analytics';

app.post('/api/video-watch', authMiddleware, async (c) => {
  const { video_id, duration_seconds } = await c.req.json();
  track('video_watched', {
    viewer_id: c.get('auth').user_id,
    video_id,
    duration_seconds,
    timestamp: new Date().toISOString(),
  });
  return c.json({ success: true });
});

// Frontend (React)
import { track } from '@adrper79-dot/analytics'; // Client-side SDK

function SubscribeButton() {
  return (
    <button onClick={() => {
      track('subscribe_clicked', { tier_id, price });
      initiateCheckout();
    }}>
      Subscribe
    </button>
  );
}
```

**Gaps in VideoKing:**
⚠️ **No funnel definitions for monetization.** Recommendation: Create PostHog funnels for: view → subscribe → first renewal → payout reached.
⚠️ **Frontend events not tracked consistently.** Recommendation: Add analytics instrumentation to checkout, subscribe, and creator upload flows.

---

### `@adrper79-dot/email`

**Purpose:** Resend email service + templating  
**VideoKing Usage:** ⚠️ **Minimal**

| Concern | Details |
|---------|---------|
| Exports used | `sendEmail()` |
| Where | Creator onboarding (Stripe Connect status), subscription confirmation (future) |
| App-specific layers | Custom email templates per app (branding, copy) |
| Integration points | Resend API key via env |

**Consumption Pattern (for new apps):**
```typescript
import { sendEmail } from '@adrper79-dot/email';

app.post('/webhooks/stripe/account.updated', async (c) => {
  const event = await c.req.json();
  if (event.data.object.charges_enabled) {
    await sendEmail({
      to: creatorEmail,
      template: 'creator_onboarding_complete',
      data: { creator_name: creatorName, dashboard_url: 'https://app.com/dashboard' },
    });
  }
});
```

**Gaps in VideoKing:** ⚠️ **No transactional email templates.** Recommendation: Add: subscription_confirmed, renewal_failed, payout_completed, account_review_required.

---

### `@adrper79-dot/video`

**Purpose:** Cloudflare Stream + R2 wrappers for video storage and playback  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | `uploadToStream()`, `getStreamUrl()`, `deleteVideo()` |
| Where | Creator upload, video playback (embedded iframe), admin purge |
| App-specific layers | Upload progress tracking, transcoding status checks, playback authorization |
| Integration points | Stream Token + R2 credentials via env |

**Consumption Pattern (for new apps):**
```typescript
import { uploadToStream, getStreamUrl } from '@adrper79-dot/video';

// Upload
app.post('/api/creator/upload', authMiddleware, async (c) => {
  const file = await c.req.formData().then(fd => fd.get('file'));
  const metadata = await c.req.formData().then(fd => fd.get('metadata'));
  
  const result = await uploadToStream({
    file,
    metadata: JSON.parse(metadata),
    creator_id: c.get('auth').user_id,
  });
  
  return c.json({ stream_id: result.uid, status: result.status });
});

// Playback
const streamUrl = getStreamUrl(videoStreamId);
// Embed: <iframe src={streamUrl}></iframe>
```

**Gaps in VideoKing:** ✅ None — video package is working well

---

### `@adrper79-dot/schedule`

**Purpose:** Database schema + video production calendar + job scheduling  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | DB schema (tables: video_calendar, production_jobs, payouts, earnings) |
| Where | All business logic queries (earnings, payouts, job status) |
| App-specific layers | Canonical app schema; other packages consume it |
| Integration points | Drizzle ORM; neon package reads it |

**Consumption Pattern (for new apps):**
```typescript
// Schema is defined once in schedule package
import { payouts, production_jobs, earnings } from '@adrper79-dot/schedule/schema';

// Apps import and use
const getCreatorEarnings = (conn, creatorId) =>
  conn.select({ total: sum(earnings.amount) })
    .from(earnings)
    .where(eq(earnings.creator_id, creatorId));
```

**Gaps in VideoKing:**
⚠️ **Schema docs incomplete.** Recommendation: Add field-level JSDoc comments (why this field? constraints?).

---

### `@adrper79-dot/deploy`

**Purpose:** Deployment automation scripts (not code; for ops and CI)  
**VideoKing Usage:** ✅ **Used in CI**

| Concern | Details |
|---------|---------|
| Exports | Shell scripts for migrations, smoke tests, rollback verification |
| Where | GitHub Actions: pre/post-deploy hooks |
| App-specific setup | Smoke tests tailored to app endpoints (auth, video, payments) |

**Consumption Pattern (for new apps):**
```bash
# In GitHub Actions workflow
- name: Run smoke tests (deploy package)
  run: npm run deploy:smoke-tests
  env:
    HEALTH_CHECK_URL: https://staging.app.com/health
    AUTH_TEST_URL: https://staging.app.com/auth/verify
    VIDEO_TEST_URL: https://staging.app.com/video/stream/test-id
```

---

### `@adrper79-dot/testing`

**Purpose:** Mock factories, test fixtures, Vitest integration  
**VideoKing Usage:** ✅ **Active**

| Concern | Details |
|---------|---------|
| Exports used | `createMockUser()`, `createMockStripeEvent()`, `createMockPayoutBatch()`, `createMockVideoFile()` |
| Where | Unit tests, integration tests (payments, webhooks, batch processing) |
| App-specific layers | Fixtures extend base factories with app-specific defaults |
| Integration points | Vitest config uses `@cloudflare/vitest-pool-workers` |

**Consumption Pattern (for new apps):**
```typescript
import { createMockUser, createMockStripeEvent } from '@adrper79-dot/testing';
import { expect, it } from 'vitest';

it('should process webhook and create payout', async () => {
  const mockCreator = createMockUser({ role: 'CREATOR' });
  const mockEvent = createMockStripeEvent({
    type: 'account.updated',
    data: { charges_enabled: true, id: mockCreator.stripe_account_id },
  });

  await handleStripeWebhook(mockEvent);
  
  expect(await getCreatorStatus(mockCreator.id)).toEqual({ charges_enabled: true });
});
```

**Gaps in VideoKing:** ✅ None — testing package is comprehensive

---

### `@adrper79-dot/validation`

**Purpose:** Worker-safe output quality validation for AI responses, synthetic monitors, and CI gates  
**VideoKing Usage:** ❌ **Not Used**

| Concern | Details |
|---------|---------|
| Exports used | n/a — added for SelfPrime output validation and future app adoption |
| Where | CI gates, production synthetic checks, Worker response guards before rendering AI output |
| App-specific layers | Required sections, required chart facts, brand voice terms, blocked phrases, and pass score |
| Integration points | Pairs with `@adrper79-dot/llm`, records quality results through `@adrper79-dot/analytics`, reports critical failures through `@adrper79-dot/monitoring` |
| Privacy posture | Emits rule IDs, scores, and redacted evidence snippets only; apps must not log raw private chart payloads |

**Consumption Pattern (for new apps):**
```typescript
import { validateAiOutput } from '@adrper79-dot/validation';

const result = validateAiOutput(generatedReading, {
  minCharacters: 180,
  requiredSections: [
    { id: 'pattern', label: 'Pattern', pattern: /pattern/i },
    { id: 'practice', label: 'Practice', pattern: /practice/i },
  ],
  requiredFacts: [
    { label: 'energy type', expectedText: 'Builder' },
  ],
  brandVoice: {
    requiredTerms: ['Energy Blueprint'],
    blockedTerms: ['fortune telling'],
  },
});

if (!result.passed) {
  await analytics.businessEvent('output.validation_failed', {
    score: result.score,
    issues: result.issues.map((entry) => entry.rule),
  });
}
```

**Gaps in VideoKing:** ✅ Not applicable — this package is for apps that generate AI/user-facing text.

---

### `@adrper79-dot/compliance`

**Purpose:** Data retention, GDPR/CCPA compliance, audit logging  
**VideoKing Usage:** ⚠️ **Minimal**

| Concern | Details |
|---------|---------|
| Exports used | `logAuditEvent()`, `scheduleDataRetention()` |
| Where | Admin operations (rarely), data retention jobs (scheduled) |
| App-specific layers | Retention policies per data type (videos, earnings, user data) |
| Integration points | Audit log stored in Neon; retention jobs run via Workers cron |

**Consumption Pattern (for new apps):**
```typescript
import { logAuditEvent, scheduleDataRetention } from '@adrper79-dot/compliance';

// Admin action
app.post('/admin/creator/suspend', authMiddleware, requireRole('ADMIN'), async (c) => {
  const { creator_id, reason } = await c.req.json();
  await suspendCreator(creator_id);
  await logAuditEvent({
    action: 'creator_suspended',
    actor_id: c.get('auth').user_id,
    target_id: creator_id,
    reason,
    timestamp: new Date(),
  });
  return c.json({ success: true });
});

// Scheduled retention
// In wrangler.toml: [[triggers.crons]] cron = "0 2 * * SUN"
app.on('scheduled', async (c) => {
  await scheduleDataRetention({
    table: 'videos',
    retention_days: 90, // Delete videos older than 90 days
  });
  return c.json({ success: true });
});
```

**Gaps in VideoKing:**
⚠️ **No audit logging for payout operations.** Recommendation: Add compliance logs for batch creation, execution, refunds.
⚠️ **GDPR data override not implemented.** Recommendation: Add endpoint for user data purge (right to be forgotten).

---

### `@adrper79-dot/crm`

**Purpose:** Creator relationship management + lifecycle tracking  
**VideoKing Usage:** ❌ **Not Used**

| Concern | Details |
|---------|---------|
| Why not used | No lifecycle automation or retention campaigns yet |
| When new app needs it | Creator success tracking, churn prevention, outreach automation |
| Exports available | `trackCreatorLifecycle()`, `sendCampaign()`, `measureRetention()` |

---

### `@adrper79-dot/social`

**Purpose:** Social discovery, sharing, and content distribution  
**VideoKing Usage:** ❌ **Not Used**

| Concern | Details |
|---------|---------|
| Why not used | No social sharing or cross-platform distribution yet |
| When new app needs it | Video sharing to Twitter/Instagram, social login, viral loops |
| Exports available | `generateShareUrl()`, `trackShare()`, `getMentions()` |

---

### `@adrper79-dot/copy`

**Purpose:** Dynamic copy generation + A/B test variants  
**VideoKing Usage:** ❌ **Not Used**

| Concern | Details |
|---------|---------|
| Why not used | Marketing copy is static; no personalization or experimentation yet |
| When new app needs it | Personalized onboarding, dynamic pricing copy, CTA variants |
| Exports available | `generateCopy()`, `selectVariant()`, `trackCopyPerformance()` |

---

### `@adrper79-dot/content`

**Purpose:** Content moderation, classification, recommendations  
**VideoKing Usage:** ⚠️ **Minimal**

| Concern | Details |
|---------|---------|
| Exports used | `classifyContent()`, `getPeerRecommendations()` |
| Where | Video upload validation, recommendation feed (future) |
| App-specific layers | Content policies per creator type (verified, standard, blocked) |
| Integration points | LLM-powered classification via llm package |

**Consumption Pattern (for new apps):**
```typescript
import { classifyContent } from '@adrper79-dot/content';

app.post('/api/creator/upload', authMiddleware, async (c) => {
  const { title, description } = await c.req.json();
  const classification = await classifyContent({
    text: `${title} ${description}`,
    context: 'video_metadata',
  });

  if (classification.isAdult || classification.isViolent) {
    return c.json({ error: 'content_policy_violation' }, 403);
  }

  // Proceed with upload
});
```

**Gaps in VideoKing:**
⚠️ **No automated moderation for comments.** Recommendation: Classify user comments on video pages; hide high-risk ones pending review.

---

### `@adrper79-dot/seo`

**Purpose:** SEO metadata, sitemap generation, canonical URLs  
**VideoKing Usage:** ⚠️ **Minimal**

| Concern | Details |
|---------|---------|
| Exports used | `generateMetaTags()`, `registerSitemap()` |
| Where | Video page rendering (HTML head tags) |
| App-specific setup | Video title/description as meta content; video URL as canonical |

**Consumption Pattern (for new apps):**
```typescript
import { generateMetaTags } from '@adrper79-dot/seo';

app.get('/video/:id', async (c) => {
  const video = await getVideo(req.params.id);
  const metaTags = generateMetaTags({
    title: video.title,
    description: video.description,
    url: `https://app.com/video/${video.id}`,
    image: video.thumbnail_url,
  });

  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        ${metaTags}
      </head>
      <body>
        <div id="app"></div>
      </body>
    </html>
  `);
});
```

---

## Part 2: Consumption Matrix (Quick Reference)

| Package | Purpose | VideoKing Status | New App Baseline | Priority |
|---------|---------|------------------|------------------|----------|
| errors | Error types & formatting | ✅ Used | Required | P0 |
| monitoring | Error tracking (Sentry) | ✅ Used | Required | P0 |
| logger | Structured logging | ✅ Used | Required | P0 |
| auth | JWT tokens + auth middleware | ✅ Used | Required | P0 |
| neon | DB connection + queries | ✅ Used | Required | P0 |
| stripe | Payment + payout wrappers | ✅ Used | Required (if payments) | P1 |
| deployment | Deploy automation | ✅ Used | Required | P1 |
| testing | Mock factories + testbed | ✅ Used | Required | P1 |
| validation | AI/output quality gates | ❌ Unused | Required if AI output reaches users | P1 |
| analytics | PostHog event tracking | ✅ Used | Highly Recommended | P1 |
| video | Stream + R2 storage | ✅ Used | Only if videos | P2 |
| schedule | DB schema + jobs | ✅ Used | App-specific | P2 |
| email | Resend templating | ⚠️ Minimal | Recommended | P2 |
| llm | LLM API wrappers | ❌ Unused | Only if needed | P3 |
| content | Moderation + recommendations | ⚠️ Minimal | Optional | P3 |
| compliance | Audit + retention | Minimal | Recommended | P3 |
| telephony | SMS/Voice/TTS | ❌ Unused | Only if needed | P3 |
| seo | Meta tags + sitemap | ⚠️ Minimal | Recommended | P3 |
| crm | Creator lifecycle | ❌ Unused | Optional | P4 |
| social | Sharing + discovery | ❌ Unused | Optional | P4 |
| copy | Copy generation + A/B | ❌ Unused | Optional | P4 |
| admin | Admin UI package | TBD | Not yet | Future |

---

## Part 3: Integration Patterns

### Middleware Chain (in order)

All app Workers should follow this pattern:

```typescript
import app from 'hono';
import { logger } from '@adrper79-dot/logger';
import { authMiddleware } from '@adrper79-dot/auth';
import { setContext, captureException } from '@adrper79-dot/monitoring';
import { v4 as uuid } from 'uuid';

const app = new Hono();

// 1. Correlation ID + logging
app.use(async (c, next) => {
  const correlationId = c.req.header('x-correlation-id') || uuid();
  c.set('correlationId', correlationId);
  logger.debug('request_started', { method: c.req.method, path: c.req.path, correlationId });
  await next();
});

// 2. Error handling wrapper
app.use(async (c, next) => {
  try {
    await next();
  } catch (err) {
    const correlationId = c.get('correlationId');
    logger.error('request_failed', { error: err.message, correlationId });
    captureException(err, { tags: { correlationId } });
    
    return c.json({ error: 'internal_server_error', correlationId }, 500);
  }
});

// 3. Auth (if protected)
// app.use('/api/*', authMiddleware);

// Routes
app.get('/health', (c) => c.json({ status: 'ok' }));
app.get('/api/profile', authMiddleware, async (c) => {
  const { user_id } = c.get('auth');
  const user = await getUser(user_id);
  return c.json(user);
});

export default app;
```

### Database + Transaction Pattern

```typescript
import { getConnection, withTx } from '@adrper79-dot/neon';
import { logger } from '@adrper79-dot/logger';

// Single query
const getCreatorEarnings = async (env, creatorId) => {
  try {
    const conn = getConnection(env);
    const result = await conn
      .select({ total: sum(earnings.amount) })
      .from(earnings)
      .where(eq(earnings.creator_id, creatorId));
    
    return result[0]?.total || 0;
  } catch (err) {
    logger.error('query_failed', { query: 'getCreatorEarnings', error: err.message });
    throw new DatabaseError('Failed to fetch earnings');
  }
};

// Transaction (money-moving)
const createPayoutBatch = async (env, creatorIds) => {
  return withTx(env, async (tx) => {
    // Create batch record
    const [batch] = await tx
      .insert(payouts)
      .values({
        id: uuid(),
        status: 'pending',
        created_at: new Date(),
        creator_count: creatorIds.length,
      })
      .returning();

    // Mark earnings as paid
    for (const creatorId of creatorIds) {
      await tx
        .update(earnings)
        .set({ batch_id: batch.id, paid_at: new Date() })
        .where(eq(earnings.creator_id, creatorId));
    }

    logger.info('payout_batch_created', { batch_id: batch.id, creator_count: creatorIds.length });
    return batch;
  });
};
```

---

## Part 4: New App Onboarding Checklist

**Use this when scaffolding a new app:**

- [ ] **Core Packages (P0)**
  - [ ] Import `@adrper79-dot/errors`
  - [ ] Import `@adrper79-dot/monitoring`; initialize Sentry DSN
  - [ ] Import `@adrper79-dot/logger`; wire correlation IDs
  - [ ] Import `@adrper79-dot/auth`; add authMiddleware
  - [ ] Import `@adrper79-dot/neon`; wire Hyperdrive

- [ ] **Operational Packages (P1)**
  - [ ] Import `@adrper79-dot/testing`; add mock factories
  - [ ] Add GitHub Actions workflow for deploy automation
  - [ ] Define app-specific SLOs (from T5.1 framework)

- [ ] **Feature Packages (P2+)**
  - [ ] If payments: Import `@adrper79-dot/stripe`
  - [ ] If analytics: Import `@adrper79-dot/analytics`; instrument funnels
  - [ ] If videos: Import `@adrper79-dot/video`
  - [ ] If emails: Import `@adrper79-dot/email`; create templates

- [ ] **Documentation**
  - [ ] Create README with package dependencies
  - [ ] Link to this matrix for package guidance
  - [ ] Document app-specific schema (in style of schedule package)

---

## Part 5: Gaps & Next Steps

### Known Gaps in Factory Packages

1. **JWT rotation (auth package)** — Add dual-key window for secret rotation
2. **Idempotency persistence (stripe package)** — Store idempotency keys in DB to detect retries
3. **RLS policies (neon package)** — Add PostgreSQL row-level security templates
4. **Funnel definitions (analytics package)** — Pre-built PostHog funnels for checkout, renewal, churn
5. **Email templates (email package)** — Transactional templates for subscription, payout, alerts
6. **Audit logging (compliance package)** — Automated audit trail for payout operations

### Recommendations for T4.2 (Front-End Standards)

Since VideoKing has substantial React code, T4.2 should define:
- Component naming conventions
- Accessibility testing patterns (Axe integration into CI)
- Performance budget targets (Lighthouse automation)
- Form validation patterns (reusable error formatting)
- API error response to UI state mapping

---

## Part 6: Package Dependency Graph

```
errors
  ↓
monitoring, logger ← (depend on errors)
  ↓
auth ← (depends on logger)
  ↓
neon ← (depends on logger)
  ↓
stripe ← (depends on neon, logger)
  ↓
schedule ← (schema used by neon, stripe)
  ↓
All app-specific queries ↑ (import from schedule schema)
```

---

## T4.1 Exit Criteria (by May 15, 2026)

- [x] Matrix showing VideoKing package consumption (all 20 packages assessed)
- [x] Integration patterns documented (middleware chain, transaction pattern)
- [x] New app onboarding checklist created
- [x] Known gaps and recommendations listed
- [ ] New app scaffolded using this matrix as guide (validated live)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Platform Lead | Initial Factory package matrix; VideoKing consumption map; new app checklist |

---

**Status:** ✅ T4.1 READY FOR IMPLEMENTATION  
**Next:** T4.2 (Front-End Standards) + T1.2 (Journey Maps) — starts May 5–8

