# Videoking Engineering Guide

**Last Updated:** April 28, 2026  
**Phase:** Phase 4 (Production)  
**Audience:** Engineers working on videoking  

---

## Quick Links

- **README:** [README.md](./README.md) — Start here for overview + local setup
- **Architecture:** [Architecture Overview](#architecture)
- **Code Structure:** [Directory Layout](#directory-layout)
- **Development:** [Development Workflow](#development-workflow)
- **Testing:** [Testing & Coverage](#testing--coverage)
- **Deployment:** [Deployment](https://docs.factory.local/runbooks/deployment.md)
- **Troubleshooting:** [docs/videoking/TROUBLESHOOTING.md](../../docs/videoking/TROUBLESHOOTING.md)

---

## Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (Next.js / React)                                  │
│ └─ Creator dashboard, admin ops, viewer experience         │
├─────────────────────────────────────────────────────────────┤
│ API & Worker Layer (Hono on Cloudflare Workers)            │
│ ├─ REST API: POST /videos, GET /videos/{id}, etc.         │
│ ├─ WebSocket: Real-time notifications via Durable Objects │
│ └─ Scheduled tasks: Cron jobs (payout batch, queue cleanup)│
├─────────────────────────────────────────────────────────────┤
│ Database Layer (Neon PostgreSQL via Hyperdrive)            │
│ ├─ Videos, creators, payouts, analytics, audit logs       │
│ └─ Row-level security policies (creator sees own data)    │
├─────────────────────────────────────────────────────────────┤
│ Integration Layer                                           │
│ ├─ Stripe (payment processing + subscriptions)            │
│ ├─ Cloudflare Stream (video hosting)                       │
│ ├─ R2 (blob storage for transcoded videos)                │
│ ├─ Deepgram (speech-to-text for subtitles)                │
│ ├─ ElevenLabs (text-to-speech narration)                  │
│ ├─ Telnyx (SMS/call notifications)                         │
│ └─ PostHog (analytics events)                             │
├─────────────────────────────────────────────────────────────┤
│ DLQ & Reliability                                           │
│ ├─ Dead Letter Queue (failed jobs for manual retry)       │
│ ├─ Payout batching (weekly batch job)                      │
│ └─ Error tracking (Sentry)                                │
└─────────────────────────────────────────────────────────────┘
```

### Key Services

| Service | Purpose | Tech Stack | Status |
|---------|---------|-----------|--------|
| **Web Worker** | REST API, request routing, auth middleware | Hono + Cloudflare Workers | Production |
| **Subscription Worker** | WebSocket, real-time updates | Hono + Durable Objects | Production |
| **Scheduler** | Cron jobs (payout batches, cleanup) | CloudFlare Cron Triggers | Production |
| **DLQ Service** | Failed job management + retry logic | Cloudflare Workers | Beta |
| **Frontend** | Creator + viewer UX | Next.js + React | Production |
| **Database** | Persistent data storage | Neon PostgreSQL | Production |

---

## Directory Layout

```
apps/videoking/
├── README.md                           # Start here
├── ENGINEERING.md                      # This file
├── package.json                        # Dependencies + scripts
├── wrangler.toml                       # Cloudflare Worker config
├── tsconfig.json                       # TypeScript config
├── jest.config.js                      # Test config
│
├── src/
│   ├── index.ts                        # Worker entry point
│   ├── env.ts                          # Environment config (strongly typed)
│   ├── types.ts                        # Shared TypeScript types
│   ├── middleware/                     # Hono middleware
│   │   ├── auth.ts                     # JWT validation + RBAC
│   │   ├── cors.ts                     # CORS headers
│   │   ├── rate-limit.ts               # Rate limiter
│   │   ├── logging.ts                  # Request/response logging
│   │   └── error-handler.ts            # Global error handling
│   ├── routes/
│   │   ├── videos.ts                   # GET/POST /videos
│   │   ├── creators.ts                 # Creator management
│   │   ├── payouts.ts                  # Payout operations
│   │   ├── admin-telemetry.ts          # GET /api/admin/health, etc.
│   │   ├── webhooks.ts                 # Stripe, Cloudflare webhooks
│   │   └── health.ts                   # GET /health (liveness probe)
│   ├── services/
│   │   ├── video-service.ts            # Video processing logic
│   │   ├── creator-service.ts          # Creator onboarding, KYC
│   │   ├── payout-service.ts           # Payout batching + Stripe integration
│   │   ├── dlq-service.ts              # Dead letter queue management
│   │   ├── analytics.ts                # PostHog event tracking
│   │   └── notification-service.ts    # Email, SMS, push notifications
│   ├── db/
│   │   ├── schema.ts                   # Drizzle ORM schema
│   │   ├── migrations/                 # Database migrations (Drizzle)
│   │   │   ├── 001_bootstrap.sql
│   │   │   ├── 002_add_payouts.sql
│   │   │   └── ...
│   │   └── seed.ts                     # Development seed data
│   ├── models/                         # Database models + queries
│   │   ├── video.ts
│   │   ├── creator.ts
│   │   ├── subscription.ts
│   │   └── payout.ts
│   ├── validators/                     # Input validation
│   │   ├── video-validators.ts
│   │   ├── creator-validators.ts
│   │   └── request-schemas.ts          # Zod schemas for requests
│   ├── utils/
│   │   ├── errors.ts                   # Custom error types
│   │   ├── jwt.ts                      # JWT encoding/decoding
│   │   ├── time.ts                     # Date utilities
│   │   ├── retry.ts                    # Retry with exponential backoff
│   │   └── logger.ts                   # Structured logging
│   └── durable-objects/
│       └── subscription-notifier.ts   # Durable Object for WebSocket
│
├── __tests__/                          # Unit + integration tests
│   ├── unit/
│   │   ├── services/
│   │   │   ├── payout-service.test.ts
│   │   │   ├── video-service.test.ts
│   │   │   └── dlq-service.test.ts
│   │   ├── middleware/
│   │   │   ├── auth.test.ts
│   │   │   └── rate-limit.test.ts
│   │   └── validators/
│   │       ├── video-validators.test.ts
│   │       └── request-schemas.test.ts
│   ├── integration/
│   │   ├── payouts.test.ts             # Payout flow end-to-end
│   │   ├── video-upload.test.ts        # Upload + transcoding flow
│   │   ├── creator-onboarding.test.ts  # Creator signup to payout ready
│   │   └── dlq-recovery.test.ts        # DLQ retry scenarios
│   └── fixtures/
│       ├── seed.ts                     # Test data factory
│       └── mocks/
│           ├── stripe.ts               # Stripe API mocks
│           ├── cloudflare-stream.ts    # Stream API mocks
│           └── deepgram.ts             # Deepgram API mocks
│
├── docs/
│   ├── API.md                          # API endpoint docs
│   ├── DATABASE_OPERATIONS.md          # Running migrations, backups
│   ├── VIDEO_TRANSCODING_RUNBOOK.md   # Debugging video queue issues
│   ├── DURABLE_OBJECTS_RUNBOOK.md     # Real-time feature scaling
│   └── ADR/
│       ├── ADR-001-durable-objects.md # Why DO over WebSockets + Redis
│       ├── ADR-002-stripe-connect.md  # Why Stripe Connect
│       └── ADR-003-payout-batching.md # Why batching + DLQ
│
├── .eslintrc.json                      # Linting rules (must pass)
├── .prettierrc.json                    # Code formatting rules
└── .dev.vars.example                   # Template for local secrets
```

---

## Development Workflow

### 1. Local Setup (First Time)

```bash
git clone https://github.com/username/factory.git
cd apps/videoking

# Install dependencies
npm install

# Copy env template
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your local values (ask team for Stripe test keys, etc.)
vim .dev.vars

# Start dev server (watches for changes, hot reload)
npm run dev
# Server runs on http://localhost:8080

# In another terminal, run database (assumes Docker Postgres running locally)
# OR use: wrangler tunnel (for Hyperdrive via Cloudflare)
```

### 2. Git Workflow

```bash
# Create feature branch
git checkout -b feat/creator-dashboard-refresh

# Make changes; commit frequently with descriptive messages
git add .
git commit -m "feat(creator): add earnings chart to dashboard

- Display revenue by day for last 30 days
- Break out subscription vs. one-time revenue
- Show payment method breakdown"

# Before pushing, run full check
npm run typecheck        # TypeScript strict mode
npm run lint            # ESLint + Prettier
npm run test            # Unit tests
npm run test:integration  # Integration tests (slower; run before PR)

# If all pass, push to origin
git push origin feat/creator-dashboard-refresh

# Open PR on GitHub; link ticket + request reviews
```

### 3. Code Review Standards

**Every PR requires:**
- ✅ 2 approvals (one from tech lead, one from domain expert)
- ✅ All tests passing
- ✅ No ESLint errors
- ✅ TypeScript strict mode passes
- ✅ Test coverage >90% (new lines must be tested)
- ✅ No secrets in code

**Review SLA:** 24 hours (for non-blocking PRs), 2 hours (for blocking)

**Merge policy:** Squash commits (keep history clean); delete branch after merge

### 4. Debugging Tips

**Local debugging:**
```bash
# Run with verbose logging
DEBUG=videoking:* npm run dev

# Attach inspector in Chrome DevTools
node --inspect-brk node_modules/.bin/wrangler dev

# Query local database
psql -h localhost -U postgres -d videoking -c "SELECT * FROM videos LIMIT 5;"
```

**Staging debugging:**
```bash
# Tail logs in real-time
wrangler tail --env staging --format compact

# Get latest error from Sentry
curl https://sentry.io/api/0/projects/{org}/{project}/events/ \
  -H "Authorization: Bearer $SENTRY_TOKEN"
```

**Production debugging:**
```bash
# Never run production commands locally; use CloudFlare dashboard
# 1. Go to https://dash.cloudflare.com → Workers & Pages → videoking
# 2. View Logs → Filter by error, date, or endpoint
# 3. Check Sentry for full error + stack trace

# If database query is slow:
# EXPLAIN ANALYZE SELECT ... (run on staging first!)
```

---

## Testing & Coverage

### Unit Tests

Target: **>90% line + function coverage**, **>85% branch coverage**

```bash
# Run all unit tests
npm run test

# Run tests matching pattern
npm run test -- payout-service

# Watch mode (auto-rerun on change)
npm run test -- --watch

# Generate coverage report
npm run test:coverage
# Open coverage/index.html to see gaps
```

### Integration Tests

Target: **All critical paths tested end-to-end**

```bash
# Run integration tests (slower; use staging DB)
npm run test:integration

# Run subset
npm run test:integration -- creator-onboarding

# Run against production-like data
npm run test:integration -- --prod-like
```

### Smoke Tests

Target: **Verify key user journeys work after deploy**

```bash
# Run before merge to main
npm run smoke-test

# Run on staging after deploy
npm run smoke-test -- --env staging

# Test critical paths:
# 1. Creator signs up + verifies email
# 2. Creator uploads video (transcodes)
# 3. Creator gets payout in batch
# 4. Viewer discovers + watches video
# 5. Viewer subscribes to unlocked content
```

### Performance Budgets

- **API latency:** Any endpoint <2s p99
- **Page load:** LCP <2.5s, CLS <0.1, FID <100ms
- **Database:** No query >500ms (p99)
- **Worker CPU:** <50ms per request (Cloudflare limit)

```bash
# Test performance
npm run perf-test

# Compare to baseline
npm run perf-test -- --compare-to main
```

---

## Deployment

### Local to Staging

```bash
# Pull latest
git pull origin main

# Deploy to staging environment
npm run deploy:staging

# Verify
curl https://videoking-staging.adrper79.workers.dev/health

# Run smoke tests on staging
npm run smoke-test -- --env staging
```

### Staging to Production

**Requires:**
- Pre-release checklist passed (see docs/templates/PRE_RELEASE_CHECKLIST.md)
- Code review approved
- Tech lead approval
- Product sign-off (if feature changes)

```bash
# Deploy to production (only once all checks done)
npm run deploy:production

# Canary deployment (automated; 10% traffic for 30 min)
# → Verify no errors spike
# → Proceed to 100% (or auto-rollback if errors)

# Health check
curl https://videoking.adrper79.workers.dev/health

# Monitor Sentry for 1 hour
# Check CloudFlare analytics for latency spikes
```

### Rollback (if things go wrong)

```bash
# See docs/runbooks/rollback-runbook.md for detailed steps
wrangler rollback --env production --message "Revert bad feature X"
```

---

## Database Operations

### Running Migrations

```bash
# Apply pending migrations to local DB
npm run db:migrate

# Apply to staging
npm run db:migrate -- --env staging

# Apply to production (requires approval + takes minutes)
npm run db:migrate -- --env production --force

# Create new migration (auto-generates from code)
npm run db:generate -- "add_creator_tier_column"
# Edit _migrations/ to verify SQL before applying
```

### Backing Up & Restoring

```bash
# Automatic backups via Neon (kept for 7 days)
# To restore: Ask Neon team or use point-in-time restore

# Seed development database
npm run db:seed
# Loads test creators, videos, payouts

# Export production data (anonymized) for debugging
npm run db:export -- --env production --anonymize
```

---

## Troubleshooting

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED` on localhost:5432 | Postgres not running | `docker run -d --name postgres ...` or use Hyperdrive |
| `TypeError: Cannot read property 'user' of undefined` | Auth middleware not applied | Ensure `app.use(authMiddleware)` before routes |
| `SyntaxError: Unexpected token` (TypeScript) | Not in strict mode | Run `npm run typecheck` first |
| `504 Gateway Timeout` | Worker CPU exceeded | Profile with `wrangler deploy --log-tail` |
| `STRIPE_API_KEY not found` | Missing .dev.vars | Copy .dev.vars.example and fill in values |

See full troubleshooting: [TROUBLESHOOTING.md](../../docs/videoking/TROUBLESHOOTING.md)

---

## Performance Tuning

### Database Queries

```bash
# Identify slow queries
npm run db:slow-queries -- --env staging --threshold 100ms

# Explain query plan
npm run db:explain -- "SELECT * FROM videos WHERE creator_id = $1"

# Add index if needed
npm run db:generate -- "index_videos_on_creator_id"
```

### Worker Optimization

```bash
# Check CPU usage
wrangler tail --env production --format compact | grep "cpu_ms"

# Profile hot paths
npm run profile -- src/routes/videos.ts

# Measure impact of changes
npm run benchmark -- before after
```

---

## Related Docs

- **README:** [README.md](./README.md)
- **API Reference:** [docs/videoking/API.md](../../docs/videoking/API.md)
- **Video Processing:** [docs/videoking/VIDEO_TRANSCODING_RUNBOOK.md](../../docs/videoking/VIDEO_TRANSCODING_RUNBOOK.md)
- **Deployment:** [docs/runbooks/deployment.md](../../docs/runbooks/deployment.md)
- **Architecture Decisions:** [docs/videoking/adr/](../../docs/videoking/adr/)
- **Factory Docs:** [docs/IMPLEMENTATION_MASTER_INDEX.md](../../docs/IMPLEMENTATION_MASTER_INDEX.md)
