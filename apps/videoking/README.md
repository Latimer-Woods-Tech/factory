# VideoKing: Updated README

**Last Updated:** April 28, 2026 (Phase 4)

---

## What is VideoKing?

VideoKing is a production-grade short-form video platform with creator monetization, subscriber management, and automated content moderation. Built on Cloudflare Workers + Neon PostgreSQL, serving 45K daily active users.

**Current Stats (April 2026):**
- 180K monthly active users
- 1,200+ active creators
- $112K monthly recurring revenue
- 99.82% uptime (Tier 1 SLO)
- 45% error budget remaining this month

---

## Quick Start

### Local Development

**Prerequisites:**
- Node.js 18+
- Cloudflare Wrangler CLI
- `.dev.vars` file with test secrets

**Setup:**

```bash
# Clone repository
git clone https://github.com/factory/videoking.git
cd videoking

# Install dependencies
npm install

# Copy development secrets
cp .dev.vars.example .dev.vars
# Edit .dev.vars: add ANTHROPIC_API_KEY, STRIPE_API_KEY, etc.

# Start development server
npm run dev

# Open http://localhost:3000
```

**What's Included Locally:**
- Edge runtime simulation (Wrangler)
- Mock database (SQLite or local Neon branch)
- Hot reload on file changes
- Inspector: `http://localhost:9222` (Worker debugging)

---

## Key Features

### 1. Viewer Experience

Users can:
- Browse public video feed (chronological or trending)
- Subscribe to tier-based content (free / Premium $9.99 / Pro $19.99)
- Unlock individual videos ($2.99 once-off)
- Watch full-length or clips

**Tech:** React 18 + Next.js, Cloudflare Stream embed, PostHog analytics

### 2. Creator Dashboard

Creators can:
- Upload video (auto-transcoding via Cloudflare Stream)
- Set pricing tier requirements
- View earnings (real-time + weekly batch)
- Manage Stripe Connect account
- Monitor watch count + funnels

**Tech:** React 18, TypeScript, Neon database queries, Stripe Connect API

### 3. Monetization 2.0

- **Subscriptions:** Tier-based access (via Stripe Subscriptions)
- **Unlocks:** One-time video purchase (via Stripe Charges)
- **Creator Payouts:** Weekly batched transfers to Stripe Connect accounts
- **Idempotency:** All transactions are idempotent (safe to retry webhook)
- **DLQ Pattern:** Failed payouts stored in dead letter queue + auto-retry with exponential backoff

**Implementation:** Webhook handlers, Stripe Connect API, DLQ worker, idempotency keys

### 4. Content Moderation

- **Auto-classification:** LLM (Claude) scores videos on 5 dimensions (hate speech, sexual content, violence, etc.)
- **Manual review queue:** Videos flagged 0.3–0.5 score go to ops
- **Auto-publish:** Videos ≤0.3 auto-approved
- **Auto-reject:** Videos >0.5 auto-rejected

**Stats Last Week:** 210 uploads / 88% auto-approved / 12 pending manual review

### 5. Observability

- **PostHog:** Event tracking (user actions, conversions, churn)
- **Sentry:** Error tracking + alerting
- **Health endpoint:** `/api/admin/health` for Factory Admin polling
- **SLO tracking:** Uptime %, error rate, latency percentiles

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare Workers (videoking.adrper79.workers.dev)       │
│  • Hono router + middleware                                 │
│  • Auth (JWT), rate limiting, CORS                         │
├─────────────────────────────────────────────────────────────┤
│ Hyperdrive ─→ Neon PostgreSQL                              │
│  • 92 tables (users, videos, subscriptions, payouts)       │
│  • Row-level security (RLS) enforced                       │
├─────────────────────────────────────────────────────────────┤
│ Cloudflare R2 + Stream                                      │
│  • Upload: Creator → Signed R2 URL → Direct upload         │
│  • Playback: Stream embed (adaptive bitrate)               │
├─────────────────────────────────────────────────────────────┤
│ Stripe                                                      │
│  • Stripe API: Subscriptions, charges                      │
│  • Stripe Connect: Creator payouts                         │
├─────────────────────────────────────────────────────────────┤
│ Observability                                               │
│  • PostHog: Event instrumentation                          │
│  • Sentry: Error tracking + alerting                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Tasks

### Upload a Video

```bash
# As creator, get upload URL
curl -X POST https://videoking.adrper79.workers.dev/api/videos \
  -H "Authorization: Bearer {creator_jwt}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My awesome video",
    "description": "Check this out!",
    "category": "entertainment"
  }'

# Response:
# { 
#   "video_id": "vid_xyz123",
#   "upload_url": "https://s3-compatible-presigned-url"
# }

# Upload video directly to R2 (bypasses Worker payload limit)
curl -X PUT {upload_url} \
  --data-binary @video.mp4 \
  -H "Content-Type: video/mp4"

# Cloudflare Stream auto-encodes after upload
# Check status via GET /api/videos/vid_xyz123
```

### Check Your Earnings

```bash
curl https://videoking.adrper79.workers.dev/api/creators/{creator_id} \
  -H "Authorization: Bearer {jwt}"

# Response:
# {
#   "creator_id": "crt_123",
#   "total_earnings_usd": 2840.00,
#   "pending_payout_usd": 140.00,
#   "last_payout_at": "2026-04-21T09:00:00Z",
#   "stripe_account_status": "verified"
# }
```

### Subscribe to a Tier

```bash
curl -X POST https://videoking.adrper79.workers.dev/api/subscriptions \
  -H "Authorization: Bearer {viewer_jwt}" \
  -H "Content-Type: application/json" \
  -d '{
    "tier_id": 1,
    "payment_token": "pm_xyz123"
  }'

# Response: { "status": "pending", "redirect_url": "https://stripe.com/pay/..." }
```

---

## Deployment

### Staging

```bash
npm run deploy:staging
# Deploys to videoking-staging.adrper79.workers.dev
# Simulated on main Neon database (not isolated)
```

### Production

```bash
git tag v1.2.3
git push origin v1.2.3
# GitHub Actions automatically:
# 1. Runs tests
# 2. Builds Worker
# 3. Deploys to staging (canary)
# 4. Monitors health for 5 min
# 5. Gradual rollout to prod (1% → 5% → 25% → 100%)
```

**Verify after deploy:**
```bash
curl https://videoking.adrper79.workers.dev/health
# Should return: { "status": "healthy", "uptime_seconds": ... }
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Video upload stuck in pending" | Check `/api/admin/events` for LLM service errors; may auto-retry |
| "Subscription not activating after payment" | Check DLQ for unprocessed webhook; manually retry via Factory Admin |
| "Creator hasn't received payout" | Check Stripe account status; ensure onboarding complete; check payout batch status |
| "Rate limiting (429 errors)" | Temporary spike; usually auto-recovers; contact ops if persists >5 min |

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more detailed diagnostics.

---

## Testing

```bash
# Unit tests
npm run test

# Integration tests (full Worker + mock DB)
npm run test:integration

# Money-moving tests (95% coverage target)
npm run test:money-moving
```

---

## Documentation

- **[PHASE_4_ENGINEERING_BASELINE.md](./PHASE_4_ENGINEERING_BASELINE.md)** – Complete architecture, monetization flow, moderation, observability, known limitations
- **[API.md](./API.md)** – Endpoint reference
- **[DATABASE.md](./DATABASE.md)** – Schema reference
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** – Common errors + diagnostic steps

---

**Status:** ✅ Production  
**Uptime This Week:** 99.82% (Tier 1 SLO: 99.9%)  
**Error Budget:** 45% remaining  
**Last Deployed:** April 28, 2026 15:30 UTC  
**Next Phase:** May 2026 (real-time notifications, A/B testing framework)
