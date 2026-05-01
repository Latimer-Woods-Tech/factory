# Lessons Learned & Common Errors

This document captures recurring errors, patterns, and best practices discovered during Factory Core development. Reviewed quarterly; updated whenever new errors emerge.

## Hard Constraints (Never Violate)

These constraints are enforced by quality gates and prevent silent runtime failures. Violating any of them breaks the CI/CD pipeline or produces mysterious production errors.

| Constraint | Why | Impact |
|-----------|-----|--------|
| No `process.env` anywhere | Cloudflare Workers don't have `process` object | TypeError at runtime |
| No Node.js built-ins (`fs`, `path`, `crypto`) | Not available on Workers platform | NameError at runtime |
| No CommonJS `require()`; use ESM only | Workers runtime requires ESM | Parse error at build time |
| No `Buffer`; use `Uint8Array` / `TextEncoder` | Buffer not available on platform | NameError at runtime |
| No raw `fetch` without error handling | Network failures crash app without explicit handlers | Unhandled promise rejection |
| No secrets in source code or `wrangler.jsonc` vars | Secrets in repos leak to GitHub | Security breach |
| No `any` in public API types | Defeats TypeScript's type safety | Type errors in consumer code |
| No `@ts-ignore` or `eslint-disable` without comment | Suppresses real issues instead of fixing them | Tech debt spiral |

**Action**: Before committing, run:
```bash
npm run typecheck  # zero errors required
npm run lint       # --max-warnings 0
```

## Common Errors & Resolutions

### Error: "Cannot find module '@latimer-woods-tech/auth' is not in the npm registry"

**Root Cause**: Packages published out of dependency order. Package A tries to import Package B, but B wasn't published yet.

**Example**:
- `@latimer-woods-tech/neon` (which depends on `@latimer-woods-tech/logger`) is tagged and pushed
- CI publishes Neon before Logger is published → 404 on npm registry

**Prevention**:
1. Follow strict dependency order (see CLAUDE.md)
2. Tag multiple packages in sequence, but wait for each publish to complete before tagging the next
3. Check GitHub Packages UI before tagging next package: https://github.com/Latimer-Woods-Tech?tab=packages

**Fix**:
```bash
# Delete the failed tag locally and remotely
git tag -d @latimer-woods-tech/neon/v0.2.0
git push origin :refs/tags/@latimer-woods-tech/neon/v0.2.0

# Wait for Logger to publish
# Then re-tag and re-push
git tag @latimer-woods-tech/neon/v0.2.0
git push origin @latimer-woods-tech/neon/v0.2.0
```

### Error: "TypeScript strict mode: 'user' implicitly has type 'any'"

**Root Cause**: Hono context variable not declared with proper type augmentation.

**Example**:
```typescript
// ❌ Fails strict mode
const user = c.get('user');  // c.user is unknown; implicitly any
```

**Prevention**: Add module augmentation to every app that uses auth:

```typescript
declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
    analytics: Analytics;
    db: DB;
  }
}
```

**Fix**: Run `npm run typecheck` locally, fix the type error, then commit.

### Error: "403 Forbidden: PUT https://npm.pkg.github.com/@latimer-woods-tech%2fXXX"

**Root Cause**: Wrong npm registry or scope mismatch in `package.json`.

**Example**:
```json
{
  "name": "@adrper/errors",  // scope is @adrper, not @latimer-woods-tech
  "publishConfig": {
    "registry": "https://registry.npmjs.org"  // wrong registry (public npm)
  }
}
```

**Prevention**:
1. All packages must use scope `@latimer-woods-tech`
2. All packages must point to GitHub Packages registry

**Fix**:
```json
{
  "name": "@latimer-woods-tech/errors",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

### Error: "ESLint: no-unsafe-assignment"

**Root Cause**: Vitest v1 (used by this project) does **not** support generic type parameters on `vi.fn()`. Adding a generic causes a TypeScript parse error. Without one, ESLint sees the return type as `any`.

**Example**:
```typescript
// ❌ Causes TS error — Vitest v1 does not support fn<Type>() generics
const mockFetch = vi.fn<[RequestInfo, RequestInit], Promise<Response>>();

// ✅ Correct pattern for Vitest v1 — cast the mock to the concrete type
const mockFetch = vi.fn() as unknown as typeof fetch;
```

**Prevention**: Cast `vi.fn()` to a concrete type using `as unknown as typeof X` — never use the generic syntax in Vitest v1.

**Related**: See [packages/content/src/index.test.ts](../../packages/content/src/index.test.ts) for complete pattern.

### Error: "Hyperdrive connection failed: ECONNREFUSED"

**Root Cause**: Database connection string is wrong, or Hyperdrive binding name doesn't match Drizzle config.

**Example**:
```json
// wrangler.jsonc
{
  "hyperdrive": {
    "DB": "postgres://..."  // binding name is "DB"
  }
}
```

```typescript
// drizzle.config.ts
export default defineConfig({
  schema: './src/schema.ts',
  out: './src/db',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL  // ❌ Wrong! Should use Hyperdrive binding
  }
});
```

**Prevention**:
1. In `wrangler.jsonc`, define Hyperdrive binding (e.g., `"DB"`)
2. In app's `env.ts`, expose binding: `export type Bindings = { DB: Hyperdrive }`
3. In Hono context: Use `c.env.DB` to query database
4. In Drizzle migrations: Use `c.env.DB.query()` directly

**Fix**:
```typescript
// ✅ Correct pattern
const db = drizzle(c.env.DB, {
  schema: dbSchema,
  logger: true
});
```

### Error: "Rate limit exceeded: too many requests in 60s"

**Root Cause**: No rate limiting middleware, or middleware is misconfigured.

**Prevention**:
1. All apps must have rate limiting on auth routes
2. All 6 apps must wire `initAnalytics` to track rate limit hits

```typescript
// src/index.ts
app.use('/auth/*', rateLimitMiddleware({
  windowMs: 60 * 1000,    // 60 seconds
  maxRequests: 10,        // 10 requests
  keyGenerator: (c) => c.req.header('cf-connecting-ip') || 'unknown'
}));
```

### Error: "'token' is not defined"

**Root Cause**: Using `jsonwebtoken` package instead of Web Crypto API (constraint violation).

**Example**:
```typescript
// ❌ Fails on Cloudflare Workers
import jwt from 'jsonwebtoken';
const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
```

**Prevention**: All JWT operations use Web Crypto API only.

```typescript
// ✅ Correct
import { SignJWT } from 'jose';
const token = await new SignJWT({ id: user.id })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('24h')
  .sign(new TextEncoder().encode(JWT_SECRET));
```

### Error: "git push hangs forever on Windows (GCM credential prompt)"

**Root Cause**: Windows Git Credential Manager (GCM) opens an invisible auth dialog that blocks the terminal — `git push origin main` appears to hang indefinitely.

**Diagnosis**: `git push` produces no output and never returns.

**Fix** — bypass GCM entirely using `gh auth token`:
```powershell
$token = gh auth token
$encoded = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$token"))
git -c credential.helper="" -c "http.extraheader=Authorization: Basic $encoded" push origin main
```

**Why it works**: `credential.helper=""` disables GCM for this invocation; the `http.extraheader` provides the PAT directly as a Basic-auth header.

**Prevention**: Keep `gh` CLI authenticated (`gh auth status`). When pushing from scripts, use this pattern or set `GIT_TERMINAL_PROMPT=0` to fail fast instead of hanging.

### Error: "create-hyperdrive workflow: Store step fails with 403"

**Root Cause**: The `GITHUB_TOKEN` auto-provided by GitHub Actions does **not** have permission to write repository secrets. The "Store Hyperdrive IDs as GitHub secrets" step always fails with a 403.

**The Create Hyperdrive step always succeeds** — the UUID is printed in the logs even when the Store step fails.

**Workaround** (standard Factory pattern):
1. After running `create-hyperdrive.yml`, view the workflow logs and copy the UUID:
   ```bash
   gh run view <RUN_ID> --repo Latimer-Woods-Tech/factory --log | grep "{app}-db ->"
   # Output: [created] xico-city-db -> 0c15bc97978841f88a78da8253ea3d32
   ```
2. Hard-code the UUID in the scaffold workflow (`--hyperdrive-id "0c15..."`):
   ```yaml
   printf '\n\n\n\n\n\n\n\n' | node packages/deploy/scripts/scaffold.mjs {app} \
     --hyperdrive-id "0c15bc97978841f88a78da8253ea3d32" \
   ```
3. Store it manually as a GitHub secret:
   ```bash
   echo "0c15bc97978841f88a78da8253ea3d32" | gh secret set HYPERDRIVE_{APP} --repo Latimer-Woods-Tech/factory
   ```

**Why not fix the workflow?** Setting repo secrets requires a PAT with `secrets:write` scope, which should not be stored as a workflow secret (circular risk). The manual step is deliberate.

### Error: "Can't read from console.log in Wrangler logs"

**Root Cause**: Workers console output goes to `stderr`, not `stdout`, due to the streaming model.

**Prevention**: Use the `@latimer-woods-tech/logger` package instead of `console.log` for structured logging.

```typescript
// ✅ Correct
import { createLogger } from '@latimer-woods-tech/logger';
const logger = createLogger('myapp');
logger.info('User logged in', { userId: user.id });
```

### Error: "Cannot read property 'x' of undefined"

**Root Cause**: Database query returned no rows, code assumes a row exists.

**Prevention**: Always check for undefined or use optional chaining.

```typescript
// ❌ Unsafe
const user = await db.query.users.findFirst({ where: eq(users.id, id) });
return user.name;  // crashes if user is undefined

// ✅ Safe
const user = await db.query.users.findFirst({ where: eq(users.id, id) });
if (!user) throw new NotFoundError(`User ${id} not found`);
return user.name;
```

## Patterns That Work

### 1. Middleware Chain Pattern

All 6 apps follow this identical pattern in `src/index.ts`:

```typescript
import Hono from 'hono';
import { sentryMiddleware } from '@latimer-woods-tech/monitoring';
import { initAnalytics } from '@latimer-woods-tech/analytics';

declare module 'hono' {
  interface ContextVariableMap {
    analytics: Awaited<ReturnType<typeof initAnalytics>>;
  }
}

const app = new Hono();

// 1. Error boundary (global)
app.use('*', (c, next) =>
  sentryMiddleware({
    dsn: c.env.SENTRY_DSN,
    environment: c.env.ENVIRONMENT,
    workerName: 'app-name'
  })(c, next)
);

// 2. Analytics initialization (all routes)
app.use('*', async (c, next) => {
  const analytics = initAnalytics({
    postHogKey: c.env.POSTHOG_KEY,
    db: c.env.DB,
    appId: 'app-name'
  });
  c.set('analytics', analytics);
  await analytics.page(c.req.path, { method: c.req.method });
  return next();
});

// 3. Routes (then add specific route handlers)
app.post('/auth/login', async (c) => {
  // ...auth logic...
  const analytics = c.get('analytics');
  await analytics.identify(user.sub, { tenantId, role });
  return c.json({ success: true });
});

export default app;
```

**Why this works**:
- Error boundary catches all errors (Sentry)
- Analytics is available on every route
- User identification happens after auth succeeds
- Rate limiting tracked per endpoint

### 2. Environment & Bindings Pattern

All apps expose a consistent `env.ts`:

```typescript
// src/env.ts
import type { Hyperdrive } from '@cloudflare/hyperdrive';

export type Bindings = {
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  SENTRY_DSN: string;
  POSTHOG_KEY: string;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  DB: Hyperdrive;
};

declare global {
  type AppEnv = {
    Bindings: Bindings;
  };
}
```

Then in `wrangler.jsonc`:

```jsonc
{
  "env": {
    "production": {
      "vars": {
        "SENTRY_DSN": "https://xxx@xxx.ingest.sentry.io/xxx",
        "POSTHOG_KEY": "phc_xxx...",
        "ENVIRONMENT": "production"
      }
    }
  },
  "hyperdrive": {
    "DB": "postgres://user@host/dbname"
  }
}
```

### 3. Error Handling Pattern

All errors inherit from `@latimer-woods-tech/errors`:

```typescript
import { ValidationError, NotFoundError, AuthenticationError } from '@latimer-woods-tech/errors';

// ✅ Custom errors with context
throw new ValidationError('Email is required', {
  field: 'email',
  value: input.email,
  context: { form: 'signup' }
});

throw new NotFoundError(`User ${id} not found`, {
  context: { userId: id, endpoint: '/api/users/:id' }
});

// Sentry automatically catches these and includes context
```

### 4. Database Query Pattern

All queries use Drizzle ORM with explicit error handling:

```typescript
import { db } from '@latimer-woods-tech/neon';
import { eq } from 'drizzle-orm';
import { users } from '@latimer-woods-tech/content';

// ✅ Always check for undefined
const user = await db.query.users.findFirst({
  where: eq(users.id, userId)
});

if (!user) {
  throw new NotFoundError(`User ${userId} not found`);
}

return user;
```

## Version & Publishing Strategy

### Current Canonical Version

All 19 packages are at **v0.2.0** as of Stage 6.

### How to Bump Versions

1. **Edit one package's `package.json`**:
   ```json
   {
     "name": "@latimer-woods-tech/errors",
     "version": "0.2.1"
   }
   ```

2. **Run `npm install` to update lock file**:
   ```bash
   cd packages/errors
   npm install
   ```

3. **Commit and tag**:
   ```bash
   git add packages/errors/package.json packages/errors/package-lock.json
   git commit -m "chore(errors): bump to v0.2.1"
   git tag errors/v0.2.1
   git push origin main
   git push origin errors/v0.2.1
   ```

4. **Wait for GitHub Actions publish to complete**:
   - Go to: https://github.com/Latimer-Woods-Tech/factory/actions
   - Check: Publish workflow succeeded

5. **Update dependent packages**:
   - If another package depends on `@latimer-woods-tech/errors`, update its `package.json`
   - Follow dependency order (see CLAUDE.md)

**Common Mistake**: Publishing packages out of order → peer dependency hell. Check GitHub Packages before tagging the next one.

## Quality Gate Checklist

Before merging **any** package:

- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run lint` → 0 warnings (checked with `--max-warnings 0`)
- [ ] `npm test` → all passing, 90%+ line coverage, 85%+ branch coverage
- [ ] `npm run build` → no errors, `dist/` exists
- [ ] JSDoc on 90%+ exported symbols (check with `npm run docs:check`)
- [ ] No `any`, `@ts-ignore`, or `eslint-disable` in public APIs
- [ ] Commit follows `<type>(<scope>): <description>` format
- [ ] Version bumped in `package.json` (matches git tag)

**Enforcement**: All checks run in `.github/workflows/publish.yml` and block publish if any fail.

## Monitoring & Observability

### What We Track

1. **Sentry** (errors):
   - Uncaught exceptions
   - API 5XX responses
   - Validation errors with field context
   - Auth failures (rate limits, invalid tokens)

2. **PostHog** (user behavior + business events):
   - Page views (every route accessed)
   - Rate limit hits (tracked per endpoint)
   - User identification (sub, tenantId, role)
   - Custom business events (signup, purchase, export, etc.)

### Why Both Are Needed

| Tool | Coverage | Alerts? |
|------|----------|---------|
| Sentry | Technical errors + exceptions | Yes (>100/day = alert) |
| PostHog | All page views + custom events | No (for analysis only) |
| Combined | Complete picture of app health + user behavior | Essential for debug |

**Real Example**: User reports "can't log in". Check:
- PostHog: Did user hit rate limit? (check `auth.rate_limit_exceeded` events)
- Sentry: Did auth endpoint throw 5XX? (check error logs)
- Together: "Rate limit hit at 3:15pm, 127.0.0.1 had 11 attempts in 60s"

## Quarterly Review Checklist

Update this doc if any of the following occur:

- [ ] New common error discovered → add to "Common Errors" section
- [ ] New pattern worked well → add to "Patterns" section
- [ ] Hard constraint was violated (was there a reason?) → decide if constraint needs update
- [ ] Package update broke something → document in version section
- [ ] Deployment failed for new reason → add to troubleshooting
- [ ] Security issue discovered → update runbooks

## Incident Post-Mortems

### 2026-04-27 — selfprime.net Outage + Login Broken (prime-self rename)

**What Happened (root causes, in order):**

1. **Pages secrets wiped** — `prime-self-ui` had `CF_API_TOKEN` and `CF_ACCOUNT_ID` removed. Every deploy since April 27 silently failed. `selfprime.net/` became stale and eventually returned 404 when a route expired.

2. **No index.html** — `prime-self-ui/public/` had `landing.html` but no `index.html`. Once the Pages cache expired, `selfprime.net/` returned 404 because Pages needs `index.html` as the root document.

3. **Worker rename broke hardcoded URL** — `prime-self/wrangler.jsonc` was changed from `name: "prime-self"` to `name: "prime-self-api"`. The frontend (`landing.html` line ~537) hardcoded `https://prime-self.workers.dev/auth/login`. After the rename, that URL stopped resolving → ERR_NAME_NOT_RESOLVED.

4. **Wrong URL format** — The hardcoded URL `prime-self.workers.dev` was never the correct format. Cloudflare Workers URLs are always `{name}.{account-subdomain}.workers.dev` → `prime-self.adrper79.workers.dev`. The short form only resolves when you have a custom workers.dev route explicitly enabling it.

5. **Stale migration block** — After reverting the rename, the `wrangler.jsonc` still had a migrations block `{ "tag": "v1", "deleted_classes": ["LiveSession"] }`. Cloudflare returned `[code: 10074]` because that migration was already applied to the `prime-self` worker in a previous session; it can't be applied again.

6. **False "done" declarations** — Twice declared a fix "working" based only on CI green (✓), without running `curl`. CI green means code compiled. It does NOT mean the endpoint returns 200.

**Fixes Applied:**

- Created `prime-self-ui/public/index.html` (copy of landing.html) — fixes root 404
- Restored secrets to `prime-self-ui` GitHub repo (`CF_API_TOKEN`, `CF_ACCOUNT_ID`)
- Reverted `prime-self/wrangler.jsonc` name from `prime-self-api` back to `prime-self`
- Removed stale `migrations` block from `wrangler.jsonc`
- Updated `landing.html` and `index.html` URL: `prime-self.workers.dev` → `prime-self.adrper79.workers.dev`
- Added smoke test jobs to both deploy workflows
- Created `docs/service-registry.yml` — authoritative map of worker names → URLs → consumers
- Added Worker Rename Protocol and Verification Requirement to `CLAUDE.md`

**Rules Added as a Result:**

> **Before renaming any worker**: Check `docs/service-registry.yml`, find all consumers, update them first, deploy consumers, THEN rename the worker.

> **Before declaring a fix done**: `curl` the endpoint and observe the HTTP status with your own eyes. CI green is not sufficient.

> **Cloudflare workers.dev URLs**: Always use the account-scoped form `{name}.adrper79.workers.dev`. The short form `{name}.workers.dev` does not resolve without an explicit workers.dev route.

> **Pages root document**: `public/index.html` must exist. `landing.html` will NOT serve as the root.

> **Secrets are per-repo**: Each app repo needs its own `CF_API_TOKEN` and `CF_ACCOUNT_ID`. They are NOT inherited from Factory Core.

---

## See Also

- [CLAUDE.md](../../CLAUDE.md) — Standing orders & hard constraints
- [Service Registry](../service-registry.yml) — Worker name → URL → consumer map
- [GitHub Secrets & Tokens Runbook](./github-secrets-and-tokens.md) — Secrets management
- [Secret Rotation Runbook](./secret-rotation.md) — How to rotate specific secrets
- [Deployment Runbook](./deployment.md) — How to deploy apps
- [Getting Started Runbook](./getting-started.md) — First-time setup
