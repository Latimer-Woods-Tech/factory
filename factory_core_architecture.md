> ⚠️ **SUPERSEDED 2026-05-02** by [`docs/architecture/FACTORY_V1.md`](./docs/architecture/FACTORY_V1.md). This document is retained for historical context only. Do not rely on it for current architecture or policy.

---



| THE FACTORY Factory Core *Architecture Specification v1.0* |
| :---: |

Confidential — The Factory Internal  
April 2026

# **1\. Purpose & Scope**

Factory Core is the shared infrastructure layer for all applications built and operated by The Factory. It eliminates per-app duplication of cross-cutting concerns — logging, error handling, analytics, auth, billing, telephony, testing, marketing, and operations — replacing them with versioned, independently published packages under the @factory/\* namespace.

Every Factory application plugs into Factory Core at install time. Every Factory application can be unplugged — sold, transferred, or open-sourced — without carrying proprietary internals. The core packages become external dependencies on the new owner's terms.

| *Design Principle: Factory Core owns the plumbing. Apps own the product. Nothing in @factory/\* should contain business logic specific to any single application.* |
| :---- |

# **2\. Architectural Decisions (ADR Summary)**

### **ADR-001 — Distributed Packages over Monorepo**

Each Factory application lives in its own GitHub repository. Factory Core packages are published to GitHub Packages as private @factory/\* npm packages. Apps install them as versioned dependencies. This enables clean sale/transfer of any individual app — the new owner receives one repo with external package dependencies, not a slice of a monorepo.

### **ADR-002 — Pinned Versions \+ Renovate Automation**

All apps pin exact @factory/\* versions (no ^ or \~ ranges). A Renovate bot runs across all repos, opening automated PRs when Factory Core packages are updated. Upgrades are deliberate, tested, and logged — never silent.

### **ADR-003 — Sentry for Observability**

Sentry is the sole observability platform. Error tracking, performance monitoring, and alerting all route through one Sentry organization with one project per Factory application. No secondary log aggregation vendor required at launch.

### **ADR-004 — PostHog for Product Analytics**

PostHog handles product analytics (funnels, retention, session replay, feature flags). A first-party factory\_events table in Neon captures raw business events that PostHog does not own. PostHog feature flags replace all other feature flag infrastructure.

### **ADR-005 — Resend for Email**

Resend is the Factory email standard. Purpose-built for Cloudflare Workers edge delivery. All transactional and drip email routes through @factory/email with per-app template support.

### **ADR-006 — LLM Failover Chain**

All Factory applications use an identical LLM failover chain: Anthropic (primary) → Grok (secondary) → Groq (tertiary). This chain is implemented once in @factory/llm and imported by all apps. No app implements its own LLM routing.

### **ADR-007 — Neon Row-Level Security for Multi-Tenancy**

All multi-tenant Factory applications (Prime Self Engine, iJustus, CypherOfHealing) use a single Neon schema with Postgres Row-Level Security policies enforcing tenant isolation. No schema-per-tenant complexity. Neon's native RLS support makes this production-grade at zero additional infrastructure cost.

### **ADR-008 — Dual Admin UI Architecture**

Factory-level administration lives at admin.thefactory.dev as a standalone Cloudflare Worker — cross-app health, revenue, deployment status, and analytics in one view. Per-app administration is inherited from @factory/admin as a mounted Hono router at /admin in each app. Clean separation ensures per-app admin survives a sale without the Factory-level dashboard.

### **ADR-009 — Mintlify for Documentation**

All Factory Core package documentation is published via Mintlify. Each @factory/\* package ships a /docs folder with its Mintlify configuration. The Factory developer portal aggregates all package docs under one domain.

# **3\. Package Registry — @factory/\***

All packages are published to GitHub Packages under the @factory organization scope. Install in any app with npm install @factory/\<package-name\>.

## **3.1 Infrastructure Packages**

### **@factory/logger**

Structured, context-aware logging for Cloudflare Workers. Wraps console with JSON output, Worker name injection, request ID propagation, and automatic Sentry breadcrumb emission.

| Export | Description |
| :---- | :---- |
| createLogger(ctx) | Returns a bound logger instance with Worker context |
| log.info / warn / error | Structured log emission with automatic Sentry breadcrumb |
| withRequestId(req) | Middleware — injects x-request-id into context |

### **@factory/errors**

Standard error classes, typed HTTP error responses, and a global route error boundary for Hono. Eliminates per-app try/catch boilerplate.

| Export | Description |
| :---- | :---- |
| FactoryError | Base error class with code, status, and context fields |
| NotFoundError / AuthError / ValidationError | Typed HTTP error subclasses |
| withErrorBoundary(handler) | Hono middleware — catches all unhandled errors, formats response |
| errorResponse(err) | Serializes any error to standard JSON error envelope |

### **@factory/auth**

JWT authentication middleware for Hono, extracted from CypherOfHealing and standardized. Handles token issuance, verification, refresh, and role-based route guards.

| Export | Description |
| :---- | :---- |
| jwtMiddleware(secret) | Hono middleware — verifies Bearer token, injects user into context |
| issueToken(payload, secret) | Creates signed JWT with configurable expiry |
| requireRole(role) | Hono route guard — rejects requests without required role |
| refreshToken(token, secret) | Issues a new token from a valid unexpired token |

### **@factory/stripe**

Stripe webhook processing, subscription status management, and billing event normalization. Currently duplicated across Prime Self Engine, iJustus, and CypherOfHealing.

| Export | Description |
| :---- | :---- |
| stripeWebhookHandler(secret) | Hono route handler — validates signature, emits typed events |
| getSubscription(customerId) | Returns normalized subscription status and tier |
| createCheckoutSession(opts) | Creates Stripe Checkout session with Factory defaults |
| onSubscriptionChange(cb) | Event hook — fires on create / upgrade / cancel / lapse |

### **@factory/neon**

Neon Postgres connection management via Cloudflare Hyperdrive. Connection pooling, RLS context injection, and query helpers. Every Factory app connects to Neon through this package — never via raw connection string.

| Export | Description |
| :---- | :---- |
| createDb(hyperdrive) | Creates Drizzle client bound to Hyperdrive binding |
| withTenant(db, tenantId) | Sets app.tenant\_id for RLS policy evaluation in session |
| runMigrations(db) | Runs pending Drizzle migrations against target Neon branch |

## **3.2 Voice & Telephony Packages**

### **@factory/telephony**

Unified configuration and client abstraction for Telnyx (SIP/PSTN), Deepgram (STT), and ElevenLabs (TTS). The three voice AI apps (The Calling, iJustus, Prime Self Engine) currently each manage their own telephony config. This package centralizes it.

| Export | Description |
| :---- | :---- |
| createTelnyxClient(apiKey) | Configured Telnyx client with Factory webhook defaults |
| transcribe(audio, opts) | Deepgram STT with model, language, and diarization config |
| synthesize(text, voice, opts) | ElevenLabs TTS with voice profile and streaming support |
| handleTelnyxWebhook(req) | Parses and validates inbound Telnyx webhook payloads |
| VoiceSession | Stateful session abstraction over STT → LLM → TTS pipeline |

### **@factory/llm**

The standard Anthropic → Grok → Groq failover chain, implemented once. Handles provider-specific request formatting, error detection, automatic failover on rate limit or API failure, and response normalization.

| Export | Description |
| :---- | :---- |
| complete(messages, opts) | Sends to Anthropic, auto-fails to Grok, then Groq on error |
| stream(messages, opts) | Streaming completion with failover support |
| withSystemPrompt(prompt) | Returns a bound complete() with system prompt pre-loaded |
| LLMError | Typed error with provider, status, and retryable fields |

## **3.3 Observability Packages**

### **@factory/analytics**

Dual-channel analytics: PostHog for product events (funnels, retention, session replay) and a first-party factory\_events Neon table for raw business events. Apps import one track() function — the package handles routing to the correct destination.

| Export | Description |
| :---- | :---- |
| track(event, props) | Emits to PostHog and/or factory\_events based on event type |
| identify(userId, traits) | Associates user identity in PostHog |
| page(name, props) | Page view tracking for PostHog funnels |
| businessEvent(event, props) | Routes exclusively to factory\_events table — not PostHog |

### **@factory/monitoring**

Sentry integration with Factory-standard configuration. One import, consistent error capture, performance tracing, and alert rules across all apps.

| Export | Description |
| :---- | :---- |
| initSentry(dsn, opts) | Configures Sentry with Factory defaults (release, env, traces) |
| captureError(err, ctx) | Sends error to Sentry with Worker context and request data |
| withPerformance(name, fn) | Wraps a function in a Sentry performance transaction |
| setUserContext(user) | Attaches user identity to all subsequent Sentry events |

## **3.4 Marketing & Distribution Packages**

### **@factory/email**

Resend-based email with per-app template support. Handles transactional (receipts, confirmations, password resets) and drip sequences (onboarding, re-engagement). Brand voice config per app inherits from the copy system.

| Export | Description |
| :---- | :---- |
| sendTransactional(opts) | Sends single transactional email via Resend |
| enrollDrip(userId, sequence) | Enrolls user in a named drip sequence |
| renderTemplate(name, data) | Renders React Email template with app brand config |
| unsubscribe(userId) | Handles unsubscribe and list management |

### **@factory/copy**

Brand voice configurations per Factory application. Feeds into Claude API calls for on-brand content generation. Each app registers a voice profile (tone, vocabulary, register, avoid list). The Classic Man profile (CypherOfHealing), Prime Self register, and iJustus enterprise tone are all defined here.

| Export | Description |
| :---- | :---- |
| getVoiceProfile(appId) | Returns the registered brand voice config for an app |
| generateCopy(prompt, appId) | Claude API call scoped to app voice profile |
| registerVoice(appId, config) | Registers a new app brand voice config |

### **@factory/content**

Content calendar, post template management, and scheduling queue. Feeds the social distribution pipeline. Stores scheduled content in Neon with status tracking through draft → approved → queued → published states.

### **@factory/social**

Social media distribution layer. Wraps the Appium/ADB mobile automation infrastructure for TikTok, Instagram, X/Twitter, and Pinterest. Targets platforms without official APIs via device emulation. Runs on a VPS host — Cloudflare Workers serve as the webhook/trigger layer only.

| *Compliance Note: Platform ToS vary on automation. The social package implements fingerprint evasion (timing randomization, real device profiles, account warming) and is used for content the Factory owns. Legal review required before use on behalf of clients.* |
| :---- |

### **@factory/seo**

Meta tag standards, sitemap generation, and structured data (JSON-LD) schemas shared across all Factory landing pages. Ensures consistent search presence without per-app implementation.

## **3.5 Operations Packages**

### **@factory/deploy**

Standardized Wrangler deployment scripts, environment variable management conventions, and GitHub Actions CI/CD templates. Every Factory app gets the same deployment pipeline at scaffold time.

| Asset | Description |
| :---- | :---- |
| deploy.sh | Wrangler deploy with env validation and Sentry release tagging |
| ci.yml | GitHub Actions workflow — test, build, deploy on main push |
| env.schema.ts | Zod schema for all required environment variables |
| secrets.md | Cloudflare secret binding conventions and rotation runbook |

### **@factory/testing**

Standard Vitest setup, mock factories for all external dependencies (Neon, Stripe, Telnyx, Deepgram, ElevenLabs, Resend, Sentry, PostHog), and shared test utilities. Every Factory app inherits the same test harness at scaffold time.

| Export | Description |
| :---- | :---- |
| mockNeon() | In-memory D1/Neon mock with transaction support |
| mockStripe() | Stripe client mock with webhook simulation |
| mockTelnyxSession() | Full voice session mock (inbound call through transcript) |
| mockLLM(responses) | LLM client mock with canned response sequences |
| createTestUser(opts) | Factory for test user records with all required fields |

## **3.6 Revenue Operations Packages**

### **@factory/crm**

Lightweight lead and customer tracking across all Factory apps feeding one Neon schema. Tracks which app a user originated from, trial/conversion events, subscription history, and churn signals. No external CRM vendor — this data stays in the Factory.

| Export | Description |
| :---- | :---- |
| trackLead(userId, appId, source) | Records lead origin and attribution |
| trackConversion(userId, plan, mrr) | Records paid conversion event |
| getCustomerView(userId) | Returns cross-app customer history and current status |
| churnRisk(userId) | Returns churn risk signals based on usage and billing events |

### **@factory/compliance**

TCPA/FDCPA compliance flag layer, consent logging, and data retention policies. Directly unblocks Wordis Bond / CallMonitor. Consent records are immutable append-only entries in Neon.

| Export | Description |
| :---- | :---- |
| checkTCPA(phone) | Validates number against DNC registry and consent records |
| logConsent(userId, type, ip) | Immutable consent record with timestamp and IP |
| checkFDCPA(contactId) | Validates contact attempt against FDCPA call rules |
| retentionPolicy(dataType) | Returns retention period and deletion handler for data type |

# **4\. Repository Structure**

Factory Core packages live in a dedicated GitHub organization repository: github.com/thefactory/core. Each package is an independent publishable unit.

| Path | Contents |
| :---- | :---- |
| packages/logger/ | @factory/logger source, tests, Mintlify docs |
| packages/errors/ | @factory/errors source, tests, Mintlify docs |
| packages/auth/ | @factory/auth source, tests, Mintlify docs |
| packages/stripe/ | @factory/stripe source, tests, Mintlify docs |
| packages/neon/ | @factory/neon source, tests, Mintlify docs |
| packages/telephony/ | @factory/telephony source, tests, Mintlify docs |
| packages/llm/ | @factory/llm source, tests, Mintlify docs |
| packages/analytics/ | @factory/analytics source, tests, Mintlify docs |
| packages/monitoring/ | @factory/monitoring source, tests, Mintlify docs |
| packages/email/ | @factory/email source, tests, Mintlify docs |
| packages/copy/ | @factory/copy source, tests, Mintlify docs |
| packages/content/ | @factory/content source, tests, Mintlify docs |
| packages/social/ | @factory/social source, tests, Mintlify docs |
| packages/seo/ | @factory/seo source, tests, Mintlify docs |
| packages/deploy/ | @factory/deploy scripts, CI templates, docs |
| packages/testing/ | @factory/testing mock factories, test utilities |
| packages/crm/ | @factory/crm source, tests, Mintlify docs |
| packages/compliance/ | @factory/compliance source, tests, Mintlify docs |
| packages/admin/ | @factory/admin Hono router, UI components, docs |
| .github/workflows/ | CI for test, build, and publish on tag |
| scripts/scaffold/ | New app scaffolding script (see Section 6\) |

# **5\. Data Architecture**

## **5.1 Neon Schema Conventions**

All Factory apps share a single Neon organization with one database per app. Cross-app data (CRM, compliance, Factory-level analytics) lives in a dedicated factory\_core database. Row-Level Security is enabled on all multi-tenant tables.

| Database | Owner | Description |
| :---- | :---- | :---- |
| factory\_core | @factory/crm, @factory/compliance | Cross-app CRM, compliance logs, factory\_events |
| prime\_self | Prime Self Engine | Practitioners, charts, readings, subscriptions |
| ijustus | iJustus | Organizations, simulators, calls, scores |
| cypher\_healing | CypherOfHealing | Clients, bookings, courses, store, consultations |
| the\_calling | The Calling | Games, players, questions, leaderboards |
| wordis\_bond | Wordis Bond | Accounts, contacts, campaigns, consent\_log |
| neighbor\_aid | NeighborAid | Users, requests, offers, geospatial data |

## **5.2 RLS Pattern**

Every multi-tenant table includes a tenant\_id column. The withTenant() call from @factory/neon sets the session variable that RLS policies evaluate. No query can read or write another tenant's data without explicit policy grant.

\-- Enable RLS on every tenant table

ALTER TABLE readings ENABLE ROW LEVEL SECURITY;

\-- Policy: users see only their own tenant's rows

CREATE POLICY tenant\_isolation ON readings

  USING (tenant\_id \= current\_setting('app.tenant\_id')::uuid);

## **5.3 factory\_events Schema**

All raw business events across all apps write to factory\_events in the factory\_core database. This is the source of truth for revenue attribution, conversion analysis, and churn signals independent of any analytics vendor.

| Column | Type | Description |
| :---- | :---- | :---- |
| id | uuid | Primary key |
| app\_id | text | Originating Factory app (prime\_self, ijustus, etc.) |
| user\_id | uuid | Factory user ID (nullable for anonymous) |
| event | text | Event name (subscription.created, call.completed, etc.) |
| properties | jsonb | Event-specific payload |
| created\_at | timestamptz | Event timestamp (immutable) |

# **6\. New App Scaffold Protocol**

Every new Factory application is created using the scaffold script. Running it produces a fully configured repo with all @factory/\* packages installed, wrangler.jsonc configured, CI/CD in place, and first deployment ready.

| Step | Action | Result |
| :---- | :---- | :---- |
| 1 | npx @factory/scaffold \<app-name\> | Creates GitHub repo, installs all @factory/\* packages |
| 2 | Configure .env.factory | Sets Neon, Stripe, Sentry, PostHog, Resend, Telnyx keys |
| 3 | npx wrangler hyperdrive create | Creates Hyperdrive binding for Neon connection pool |
| 4 | npm run db:migrate | Runs base schema migrations including factory\_events sink |
| 5 | npm run deploy:staging | First deployment to staging Worker on workers.dev |
| 6 | Configure Sentry DSN | Registers new app project in Factory Sentry org |
| 7 | Configure PostHog project | Creates PostHog project and links feature flags |
| 8 | npm run deploy:production | Production deployment with custom domain binding |

| *Time-to-Deploy Target: A new Factory app should reach a live production Worker with auth, error handling, logging, and analytics working in under 2 hours from scaffold. The scaffold protocol is the benchmark.* |
| :---- |

# **7\. App Divestiture Protocol**

When a Factory application is sold or transferred, the receiving party inherits a clean, self-contained codebase with @factory/\* packages as external versioned dependencies. The protocol ensures no Factory internals are carried in the sale.

| Step | Action | Owner |
| :---- | :---- | :---- |
| 1 | Freeze @factory/\* versions in package.json | Factory |
| 2 | Transfer GitHub repo to new owner's org | Factory |
| 3 | Fork relevant Neon database to new owner's org | Factory |
| 4 | Transfer Cloudflare Workers to new owner's account | Factory |
| 5 | Transfer Stripe products and customers to new account | Factory / Stripe |
| 6 | Transfer Telnyx numbers and SIP config | Factory / Telnyx |
| 7 | Update @factory/\* package registry access (read-only for 90 days) | Factory |
| 8 | New owner migrates off @factory/\* at their own pace | New Owner |
| 9 | Revoke registry access at 90-day mark | Factory |

| *The 90-day transition window gives the new owner time to replace @factory/\* packages with their own implementations or third-party alternatives without a hard cutover.* |
| :---- |

# **8\. Phased Build Plan**

Factory Core is built in five phases. Each phase delivers working packages before the next begins. No phase is skipped.

| Phase | Packages | Trigger | Duration |
| :---- | :---- | :---- | :---- |
| 1 — Foundation | @factory/errors, @factory/logger, @factory/auth, @factory/neon, @factory/stripe | Immediate — highest duplication pain | 2 weeks |
| 2 — Voice | @factory/telephony, @factory/llm, @factory/testing | Phase 1 stable — voice apps are the differentiator | 2 weeks |
| 3 — Operations | @factory/deploy, @factory/monitoring, @factory/analytics | Phase 2 stable — ops stability before scaling | 1 week |
| 4 — Marketing | @factory/email, @factory/copy, @factory/content, @factory/social, @factory/seo | Phase 3 stable — apps ready for traffic | 2 weeks |
| 5 — Revenue Ops | @factory/crm, @factory/compliance, @factory/admin | Phase 4 stable — compliance unblocks Wordis Bond | 2 weeks |

# **9\. Engineering Standards**

## **9.1 TypeScript**

All @factory/\* packages are TypeScript strict mode. No any types in package public APIs. All exported functions have full JSDoc with @param and @returns documentation.

## **9.2 Testing**

Minimum 90% unit test coverage on all packages. Vitest is the test runner. Every package ships its own test suite. Integration tests run against Neon preview branches, never production.

## **9.3 Versioning**

Semantic versioning (semver) for all @factory/\* packages. Breaking changes increment the major version. All breaking changes require a migration guide in the package CHANGELOG.md.

## **9.4 Security**

No secrets in source code. All keys via Cloudflare Workers secrets or wrangler.toml vars (non-sensitive only). All webhooks verified by signature. All auth tokens short-lived (1 hour access, 7 day refresh).

## **9.5 Documentation**

Every exported function is documented in Mintlify. Package READMEs include a quickstart that goes from install to working code in under 10 lines. Docs are updated in the same PR as code changes — never as a follow-up.

# **10\. Factory Stack Reference**

Canonical vendor assignments across all Factory applications. Deviation from this stack requires a new ADR.

| Layer | Vendor | Package |
| :---- | :---- | :---- |
| Edge Compute | Cloudflare Workers | wrangler \+ Hono |
| Database | Neon Postgres | @factory/neon (via Hyperdrive) |
| Payments | Stripe | @factory/stripe |
| Auth | JWT (self-managed) | @factory/auth |
| LLM — Primary | Anthropic | @factory/llm |
| LLM — Secondary | Grok (xAI) | @factory/llm |
| LLM — Tertiary | Groq | @factory/llm |
| Telephony | Telnyx | @factory/telephony |
| Speech-to-Text | Deepgram | @factory/telephony |
| Text-to-Speech | ElevenLabs | @factory/telephony |
| Email | Resend | @factory/email |
| Error Tracking | Sentry | @factory/monitoring |
| Product Analytics | PostHog | @factory/analytics |
| Feature Flags | PostHog | @factory/analytics |
| Documentation | Mintlify | Per-package /docs |
| Source Control | GitHub | github.com/thefactory/\* |
| Package Registry | GitHub Packages | @factory/\* namespace |
| CI/CD | GitHub Actions | @factory/deploy |
| Social Automation | Appium / ADB | @factory/social (VPS-hosted) |

*The Factory  ·  Factory Core v1.0  ·  Confidential*  
*"Build once. Ship everywhere."*