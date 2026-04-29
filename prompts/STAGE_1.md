# HISTORICAL ONLY — DO NOT USE FOR CURRENT EXECUTION

This prompt predates the current Factory execution model and uses stale package scope/name assumptions.
Use `prompts/README.md` and `prompts/AGENT_SUCCESS_CONTRACT.md` for current work.

---

# FACTORY CORE — STAGE 1: FOUNDATION PACKAGES
# Claude Code Command: claude --continue --allowedTools Bash,Write,Read

## PRE-FLIGHT (run before anything else)
```bash
cat CLAUDE.md                    # read standing orders fully
git log --oneline -5             # confirm Stage 0 is complete
ls packages/                     # confirm 19 directories exist
gh auth status                   # confirm GitHub auth
```
If any check fails — STOP. Fix the prerequisite. Do not proceed.

---

## MISSION
Build, test, and publish the 5 Phase 1 Foundation packages in strict 
dependency order. Each package must pass all quality gates and be 
published to GitHub Packages before the next package begins.

Stage 1 is complete when these 5 packages are published at v0.1.0:
- [ ] @factory/errors      published ✅
- [ ] @factory/monitoring  published ✅
- [ ] @factory/logger      published ✅
- [ ] @factory/auth        published ✅
- [ ] @factory/neon        published ✅
- [ ] @factory/stripe      published ✅

---

## QUALITY GATE SEQUENCE
Run this exact sequence after completing each package.
ALL steps must pass before tagging and publishing.

```bash
cd packages/<package-name>
npm run lint        # zero warnings
npm run typecheck   # zero errors  
npm run test        # coverage >= 90% lines/fns, 85% branches
npm run build       # dist/ produced, zero errors
```

If any gate fails: fix the root cause. Never suppress. Never skip.

---

## PACKAGE 1: @factory/errors
**No dependencies. Build this first.**

### Specification
Implement these exports in `packages/errors/src/index.ts`:

```typescript
// Base error class
export class FactoryBaseError extends Error {
  constructor(
    public readonly code:      string,
    message:                   string,
    public readonly status:    number,
    public readonly retryable: boolean = false,
    public readonly context?:  Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Typed subclasses
export class NotFoundError   extends FactoryBaseError  // status 404, retryable false
export class AuthError       extends FactoryBaseError  // status 401, retryable false
export class ForbiddenError  extends FactoryBaseError  // status 403, retryable false
export class ValidationError extends FactoryBaseError  // status 422, retryable false
export class InternalError   extends FactoryBaseError  // status 500, retryable true
export class RateLimitError  extends FactoryBaseError  // status 429, retryable true

// Standard error codes enum
export const ErrorCodes = { ... } as const
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// Response envelope types
export interface FactoryResponse<T> {
  data:    T | null;
  error:   FactoryErrorShape | null;
  meta?: {
    requestId: string;
    duration:  number;
    timestamp: string;
  };
}

export interface FactoryErrorShape {
  code:      string;
  message:   string;
  status:    number;
  retryable: boolean;
  context?:  Record<string, unknown>;
}

// Serializer — converts any error to FactoryResponse<never>
export function toErrorResponse(
  err: unknown,
  requestId?: string
): FactoryResponse<never>

// Hono middleware — catches all unhandled route errors
export function withErrorBoundary(): MiddlewareHandler

// Type guard
export function isFactoryError(err: unknown): err is FactoryBaseError
```

### ErrorCodes — implement all of these
```typescript
export const ErrorCodes = {
  // Auth
  AUTH_TOKEN_MISSING:       'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_EXPIRED:       'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID:       'AUTH_TOKEN_INVALID',
  AUTH_FORBIDDEN:           'AUTH_FORBIDDEN',
  // Database
  DB_CONNECTION_FAILED:     'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED:          'DB_QUERY_FAILED',
  DB_NOT_FOUND:             'DB_NOT_FOUND',
  DB_CONSTRAINT_VIOLATION:  'DB_CONSTRAINT_VIOLATION',
  // LLM
  LLM_ALL_PROVIDERS_FAILED: 'LLM_ALL_PROVIDERS_FAILED',
  LLM_RATE_LIMITED:         'LLM_RATE_LIMITED',
  LLM_CONTEXT_TOO_LARGE:    'LLM_CONTEXT_TOO_LARGE',
  // Telephony
  TELEPHONY_SESSION_FAILED: 'TELEPHONY_SESSION_FAILED',
  TELEPHONY_STT_FAILED:     'TELEPHONY_STT_FAILED',
  TELEPHONY_TTS_FAILED:     'TELEPHONY_TTS_FAILED',
  // Billing
  STRIPE_WEBHOOK_INVALID:   'STRIPE_WEBHOOK_INVALID',
  STRIPE_PAYMENT_FAILED:    'STRIPE_PAYMENT_FAILED',
  // Generic
  VALIDATION_ERROR:         'VALIDATION_ERROR',
  INTERNAL_ERROR:           'INTERNAL_ERROR',
  NOT_FOUND:                'NOT_FOUND',
  RATE_LIMITED:             'RATE_LIMITED',
} as const;
```

### withErrorBoundary — Hono implementation
```typescript
import type { MiddlewareHandler } from 'hono';

export function withErrorBoundary(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      const response = toErrorResponse(err, c.get('requestId'));
      return c.json(response, (response.error?.status ?? 500) as any);
    }
  };
}
```

### Tests required (packages/errors/src/errors.test.ts)
- FactoryBaseError: name, code, status, retryable, context, stack trace
- Each subclass: correct default status and retryable values
- toErrorResponse: FactoryBaseError input, plain Error input, unknown input
- withErrorBoundary: catches thrown FactoryBaseError, catches unknown error
- isFactoryError: true for FactoryBaseError, false for plain Error

### Publish
```bash
cd packages/errors
npm install
# run quality gate sequence
git add -A
git commit -m "feat(errors): implement base error classes and response envelope"
git tag errors/v0.1.0
git push && git push --tags
```

---

## PACKAGE 2: @factory/monitoring
**Depends on: @factory/errors. Install it first.**

```bash
cd packages/monitoring
npm install @factory/errors@0.1.0
```

### Specification
Sentry integration with Factory-standard configuration.

```typescript
import * as Sentry from '@sentry/cloudflare';

export interface MonitoringConfig {
  dsn:         string;
  environment: 'development' | 'staging' | 'production';
  release?:    string;
  tracesSampleRate?: number;  // default 0.1
}

export function initMonitoring(config: MonitoringConfig): void

export function captureError(
  err:     unknown,
  context?: {
    userId?:    string;
    tenantId?:  string;
    requestId?: string;
    extra?:     Record<string, unknown>;
  }
): string   // returns Sentry event ID

export function captureMessage(
  message:  string,
  level?:   'debug' | 'info' | 'warning' | 'error',
  context?: Record<string, unknown>
): string

export function withPerformance<T>(
  name: string,
  fn:   () => Promise<T>
): Promise<T>

export function setUserContext(user: {
  id:       string;
  tenantId: string;
  email?:   string;
}): void

// Hono middleware — attaches Sentry to request lifecycle
export function sentryMiddleware(config: MonitoringConfig): MiddlewareHandler
```

### Tests required
- initMonitoring: configures Sentry with correct dsn and environment
- captureError: calls Sentry.captureException, returns event ID
- captureMessage: calls Sentry.captureMessage with correct level
- withPerformance: executes fn, returns result, handles fn rejection
- sentryMiddleware: attaches to context, calls next()

### Publish
```bash
git commit -m "feat(monitoring): implement Sentry integration with Factory config"
git tag monitoring/v0.1.0
git push && git push --tags
```

---

## PACKAGE 3: @factory/logger
**Depends on: @factory/errors, @factory/monitoring**

```bash
cd packages/logger
npm install @factory/errors@0.1.0 @factory/monitoring@0.1.0
```

### Specification
```typescript
export interface LogContext {
  workerId:   string;
  requestId:  string;
  userId?:    string;
  tenantId?:  string;
  [key: string]: unknown;
}

export interface Logger {
  info  (msg: string, ctx?: Record<string, unknown>): void;
  warn  (msg: string, ctx?: Record<string, unknown>): void;
  error (msg: string, err?: unknown, ctx?: Record<string, unknown>): void;
  debug (msg: string, ctx?: Record<string, unknown>): void;
  child (ctx: Partial<LogContext>): Logger;
}

export function createLogger(ctx: LogContext): Logger

// Hono middleware — generates requestId, injects into context and logger
export function withRequestId(): MiddlewareHandler

// Output format: structured JSON to console
// {
//   "level": "info",
//   "msg": "...",
//   "workerId": "...",
//   "requestId": "...",
//   "ts": "2026-04-23T12:00:00.000Z",
//   ...ctx
// }
```

### Implementation notes
- Use `crypto.randomUUID()` (Web Crypto — available in Workers) for requestId generation
- child() returns a new Logger with parent ctx merged with child ctx
- error() calls captureError from @factory/monitoring when err is provided
- All output goes to console.log as JSON.stringify — never use console.error directly
- debug() is a no-op in production (check environment binding)

### Tests required
- createLogger: returns Logger with all 5 methods
- info/warn/debug: output correct JSON structure to console
- error: outputs JSON + calls captureError when err provided
- child: inherits parent context, can add new keys
- withRequestId: injects requestId into Hono context

### Publish
```bash
git commit -m "feat(logger): implement structured JSON logger with child context"
git tag logger/v0.1.0
git push && git push --tags
```

---

## PACKAGE 4: @factory/auth
**Depends on: @factory/errors, @factory/logger**

```bash
cd packages/auth
npm install @factory/errors@0.1.0 @factory/logger@0.1.0
```

### Specification
JWT auth using Web Crypto API only. No jsonwebtoken. No jose server-side libs 
that require Node.js crypto. Use the Workers-native crypto.subtle.

```typescript
export interface TokenPayload {
  sub:      string;   // user ID
  tenantId: string;
  role:     'owner' | 'admin' | 'member' | 'viewer';
  iat:      number;
  exp:      number;
}

// Issues signed JWT using crypto.subtle (HMAC-SHA256)
export async function issueToken(
  payload:   Omit<TokenPayload, 'iat' | 'exp'>,
  secret:    string,
  expiresIn: number = 3600  // seconds, default 1 hour
): Promise<string>

// Verifies JWT signature and expiry
export async function verifyToken(
  token:  string,
  secret: string
): Promise<TokenPayload>   // throws AuthError on failure

// Issues new token from valid unexpired token
export async function refreshToken(
  token:  string,
  secret: string,
  expiresIn?: number
): Promise<string>

// Hono middleware — extracts Bearer token, verifies, injects user into context
export function jwtMiddleware(secret: string): MiddlewareHandler

// Hono route guard — requires minimum role level
export function requireRole(
  role: TokenPayload['role']
): MiddlewareHandler

// Hono context extension
declare module 'hono' {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}
```

### Role hierarchy (owner > admin > member > viewer)
requireRole('admin') must pass for owner and admin, fail for member and viewer.

### Web Crypto JWT implementation
```typescript
// Helper — encode/decode JWT segments using TextEncoder (no Buffer)
const encoder = new TextEncoder();

async function sign(header: object, payload: object, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const data = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}
```

### Tests required
- issueToken: returns valid JWT string with correct structure
- verifyToken: succeeds on valid token, throws AuthError on expired/invalid/tampered
- refreshToken: returns new token with extended expiry
- jwtMiddleware: passes with valid token, returns 401 with AuthError on missing/invalid
- requireRole: passes correct roles, rejects insufficient roles

### Publish
```bash
git commit -m "feat(auth): implement JWT auth with Web Crypto API for Workers"
git tag auth/v0.1.0
git push && git push --tags
```

---

## PACKAGE 5: @factory/neon
**Depends on: @factory/errors, @factory/logger**

```bash
cd packages/neon
npm install @factory/errors@0.1.0 @factory/logger@0.1.0 \
            drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
```

### Specification
```typescript
import { NeonDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Creates Drizzle client bound to Cloudflare Hyperdrive
// env.DB is the Hyperdrive binding (type: Hyperdrive)
export function createDb(hyperdrive: { connectionString: string }): NeonDatabase

// Sets app.tenant_id session variable for RLS policy evaluation
// Automatically wraps fn in a session — no manual SET required
export async function withTenant<T>(
  db:       NeonDatabase,
  tenantId: string,
  fn:       (db: NeonDatabase) => Promise<T>
): Promise<T>

// Runs pending Drizzle migrations
export async function runMigrations(db: NeonDatabase): Promise<void>

// Type exports for app schemas to extend
export type { NeonDatabase }
```

### Hyperdrive binding pattern
```typescript
// In Worker handler:
// env.DB is type Hyperdrive (from wrangler.jsonc binding)
// Hyperdrive exposes .connectionString property
export function createDb(hyperdrive: { connectionString: string }) {
  const sql = neon(hyperdrive.connectionString);
  return drizzle(sql);
}
```

### withTenant implementation
```typescript
export async function withTenant<T>(
  db: NeonDatabase,
  tenantId: string,
  fn: (db: NeonDatabase) => Promise<T>
): Promise<T> {
  // Neon HTTP driver — set session variable via raw SQL before query
  await db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
  return fn(db);
}
```

### Tests required
- createDb: returns NeonDatabase instance (mock Hyperdrive)
- withTenant: calls set_config with correct tenantId, calls fn with db
- withTenant: propagates fn errors correctly
- runMigrations: calls migrate() without throwing

### Publish
```bash
git commit -m "feat(neon): implement Neon/Hyperdrive client with RLS tenant helper"
git tag neon/v0.1.0
git push && git push --tags
```

---

## PACKAGE 6: @factory/stripe
**Depends on: @factory/errors, @factory/logger, @factory/neon**

```bash
cd packages/stripe
npm install @factory/errors@0.1.0 @factory/logger@0.1.0 \
            @factory/neon@0.1.0 stripe
```

### Specification
```typescript
import Stripe from 'stripe';

export interface SubscriptionStatus {
  customerId:       string;
  status:           'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  tier:             string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export type SubscriptionEvent =
  'created' | 'upgraded' | 'downgraded' | 'canceled' | 'past_due';

// Creates Stripe client with Factory defaults
export function createStripeClient(secretKey: string): Stripe

// Validates webhook signature and returns typed event
export async function validateWebhook(
  request:       Request,
  webhookSecret: string,
  stripeClient:  Stripe
): Promise<Stripe.Event>

// Hono route handler for /webhooks/stripe
export function stripeWebhookHandler(opts: {
  webhookSecret: string;
  stripeClient:  Stripe;
  handlers:      Partial<Record<SubscriptionEvent, (status: SubscriptionStatus) => Promise<void>>>;
}): RouteHandler

// Returns normalized subscription status
export async function getSubscription(
  customerId:   string,
  stripeClient: Stripe
): Promise<SubscriptionStatus>

// Creates Stripe Checkout session
export async function createCheckoutSession(opts: {
  priceId:      string;
  customerId:   string;
  successUrl:   string;
  cancelUrl:    string;
  stripeClient: Stripe;
}): Promise<string>   // returns checkout URL

// Maps Stripe price ID to internal tier slug
export function priceToTier(priceId: string, tierMap: Record<string, string>): string
```

### Tests required
- validateWebhook: passes valid signature, throws on invalid signature
- getSubscription: returns normalized status for active/canceled/none states
- createCheckoutSession: calls Stripe API with correct params, returns URL
- stripeWebhookHandler: routes subscription.created to correct handler
- priceToTier: maps known price IDs, returns 'unknown' for unmapped

### Publish
```bash
git commit -m "feat(stripe): implement webhook handler and subscription management"
git tag stripe/v0.1.0
git push && git push --tags
```

---

## STAGE 1 COMPLETION VERIFICATION

Run this full verification sequence after all 6 packages are published:

```bash
# Verify all packages exist in GitHub Packages
gh api /orgs/thefactory/packages?package_type=npm | \
  jq '.[].name' | grep "@factory"

# Expected output:
# "@factory/errors"
# "@factory/monitoring"  
# "@factory/logger"
# "@factory/auth"
# "@factory/neon"
# "@factory/stripe"

# Verify all at v0.1.0
for pkg in errors monitoring logger auth neon stripe; do
  echo "=== @factory/$pkg ==="
  cat packages/$pkg/package.json | grep '"version"'
done

# Confirm CI is green
gh run list --limit 10
```

### Write STAGE_1_COMPLETE.md
```markdown
# Stage 1 Complete
Date: <today>

## Published Packages
- @factory/errors      v0.1.0 ✅
- @factory/monitoring  v0.1.0 ✅
- @factory/logger      v0.1.0 ✅
- @factory/auth        v0.1.0 ✅
- @factory/neon        v0.1.0 ✅
- @factory/stripe      v0.1.0 ✅

## Coverage Summary
errors:     <lines>% lines / <fns>% fns
monitoring: <lines>% lines / <fns>% fns
logger:     <lines>% lines / <fns>% fns
auth:       <lines>% lines / <fns>% fns
neon:       <lines>% lines / <fns>% fns
stripe:     <lines>% lines / <fns>% fns

## Next Step
Run Stage 2 prompt: /prompts/STAGE_2_VOICE.md
Command: claude --continue --allowedTools Bash,Write,Read
```

```bash
git add -A
git commit -m "docs: Stage 1 complete — 6 foundation packages published"
git push
```

---

## LOOP PROTOCOL
If context fills or session times out mid-stage:
1. Commit whatever is complete: `git add -A && git commit -m "wip: <package> in progress"`
2. Run: `claude --resume <session-id> --allowedTools Bash,Write,Read`
3. First action in resumed session: `cat CLAUDE.md && git log --oneline -5`
4. Continue from the last incomplete package
