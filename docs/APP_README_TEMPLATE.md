# App Onboarding & README Template

This template should be used for all 6 Factory apps: prime-self, wordis-bond, cypher-healing, the-calling, ijustus, neighbor-aid.

---

# {APP_NAME}

A Cloudflare Workers application built on the Factory Core infrastructure.

**Production**: https://{app}.adrper79.workers.dev  
**Staging**: https://{app}-staging.adrper79.workers.dev

## Quick Start

### 1. Set Up Environment

```bash
# Install dependencies
npm ci

# Copy environment variables
cp .dev.vars.example .dev.vars

# Add your local secrets
# (See .dev.vars for which ones to set)
```

### 2. Run Locally

```bash
npm run dev
```

Then open http://localhost:8787

### 3. Verify Setup

```bash
# Check TypeScript compiles
npm run typecheck

# Run tests
npm test

# Check code style
npm run lint

# Build for deployment
npm run build
```

If all pass, you're ready to deploy!

## Environment Setup

### Local Development (.dev.vars)

Create `.dev.vars` with your local database and secrets:

```bash
# Required for local development
DATABASE_URL=postgres://user:pass@host/dbname
JWT_SECRET=$(openssl rand -base64 32)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/1234
POSTHOG_KEY=phc_xxx...
```

**Why not in source code?**  
Cloudflare Workers don't support `.env` files like Node.js. Secrets must be:
- `.dev.vars` for local development (git-ignored)
- Wrangler secrets for production (`wrangler secret put`)
- GitHub Actions secrets for CI/CD

### Staging Environment

Staging uses GitHub Actions secrets from the `staging` environment:

```bash
# To deploy to staging
wrangler deploy --env staging

# Verify it worked
curl https://{app}-staging.adrper79.workers.dev/health | jq .
```

Expected output:
```json
{
  "status": "ok",
  "worker": "{app}-staging",
  "environment": "staging"
}
```

### Production Environment

Production uses GitHub Actions secrets from the `production` environment (requires approval):

```bash
# To deploy to production
wrangler deploy --env production

# Verify it worked
curl https://{app}.adrper79.workers.dev/health | jq .
```

Expected output:
```json
{
  "status": "ok",
  "worker": "{app}",
  "environment": "production"
}
```

## Configuration

### wrangler.jsonc

The main configuration file for this Worker. Key sections:

- **`name`**: Worker name (must be `{app}` for production, `{app}-staging` for staging)
- **`hyperdrive`**: Database connection binding (unique ID per environment)
- **`rate_limiters`**: Auth rate limiting (namespace ID must be unique per app)
- **`vars`**: Non-secret configuration (ENVIRONMENT, WORKER_NAME)
- **`env.staging`**: Staging-specific overrides

For details, see [Environment Isolation & Verification Runbook](../../docs/runbooks/environment-isolation-and-verification.md).

### src/env.ts

Defines all required environment variables and bindings. All fields are required (non-optional):

```typescript
export interface Env {
  DB: Hyperdrive;                 // Neon database connection
  AUTH_RATE_LIMITER: RateLimit;   // Rate limiting
  SENTRY_DSN: string;             // Error tracking
  POSTHOG_KEY: string;            // Analytics
  JWT_SECRET: string;             // Auth token signing
  ENVIRONMENT: 'staging' | 'production';
  WORKER_NAME: string;
}
```

Missing a field? TypeScript will error at build time.

## API Routes

### Public
- `GET /health` — App status (shows environment and worker name)

### Protected (require JWT in Authorization header)
- `GET /api/me` — Current user info
- `GET /api/{resource}` — List resources

See `src/routes/` for complete route documentation.

## Monitoring & Debugging

### Available Tools

1. **Sentry** (error tracking) — Automatically captures errors
   - View in: [Sentry Dashboard](https://sentry.io)
   - Issues are tagged with worker name and environment

2. **PostHog** (analytics) — Tracks page views and custom events
   - View in: [PostHog Dashboard](https://posthog.com)
   - Events tagged with `appId: {app}` and `environment`

3. **Cloudflare Logs** — Raw Worker logs
   - View in: [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Tail in real-time: `wrangler tail`

### Common Issues

**"Cannot connect to database"**
- Check `DATABASE_URL` in `.dev.vars` (local) or Wrangler secrets (production)
- Verify Hyperdrive binding in `wrangler.jsonc` matches database ID
- See [Lessons Learned Runbook](../../docs/runbooks/lessons-learned.md)

**"Sentry not capturing errors"**
- Verify `SENTRY_DSN` is set in `.dev.vars` and GitHub Secrets
- Check Sentry project exists in [Sentry Dashboard](https://sentry.io)
- See [GitHub Secrets Runbook](../../docs/runbooks/github-secrets-and-tokens.md)

**"TS errors in middleware"**
- Ensure `src/env.ts` defines all required fields
- Run `npm run typecheck` to see full error
- See [Lessons Learned Runbook](../../docs/runbooks/lessons-learned.md)

## Deployment

### Automated Deployment (via GitHub Actions)

Pushes to `main` branch automatically deploy to production.  
Pushes to `staging` branch automatically deploy to staging.

### Manual Deployment

```bash
# Deploy to staging (requires staging secrets to be set)
wrangler deploy --env staging

# Deploy to production (requires production secrets to be set)
wrangler deploy --env production
```

For detailed deployment runbook, see [Deployment Runbook](../../docs/runbooks/deployment.md).

## Testing

### Run All Tests

```bash
npm test
```

Tests use Vitest with `@cloudflare/vitest-pool-workers` to simulate the Cloudflare Workers environment.

### Test Coverage

Current coverage: Run `npm test -- --coverage` to see report.

Requirements:
- ✅ 90%+ line coverage
- ✅ 90%+ function coverage
- ✅ 85%+ branch coverage

### Writing Tests

Tests should use the Factory testing utilities from `@latimer-woods-tech/testing`:

```typescript
import { createMockDb, createMockAnalytics } from '@latimer-woods-tech/testing';
import { describe, it, expect, vi } from 'vitest';

describe('POST /api/users', () => {
  it('should create a user', async () => {
    const mockDb = createMockDb();
    const mockAnalytics = createMockAnalytics();
    
    // Test code here
  });
});
```

## Dependencies

### Core Infrastructure (from @latimer-woods-tech/*)

| Package | Purpose |
|---------|---------|
| `@latimer-woods-tech/errors` | Error types with context |
| `@latimer-woods-tech/monitoring` | Sentry integration |
| `@latimer-woods-tech/auth` | JWT & middleware |
| `@latimer-woods-tech/neon` | Database queries |
| `@latimer-woods-tech/analytics` | PostHog integration |
| `@latimer-woods-tech/logger` | Structured logging |

All core packages are pinned to exact versions (no `^` or `~`) to ensure consistency across all apps.

To upgrade a core package:
```bash
npm install @latimer-woods-tech/{package}@0.X.Y
```

Then commit both `package.json` and `package-lock.json`.

## Code Style & Quality

### Format & Lint

```bash
npm run lint --fix    # Fix style issues
npm run typecheck     # TypeScript strict mode
```

All commits must pass these checks.

### Commit Message Format

Use conventional commits:

```
<type>(<scope>): <description>

feat(auth): add OAuth support
fix(db): handle connection timeout
docs(readme): update setup instructions
test(api): add e2e test for user creation
refactor(middleware): simplify error handling
chore: update dependencies
```

Valid types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`

## Troubleshooting

### "TypeScript errors after npm install"

```bash
npm run typecheck  # See full errors
```

Common causes:
- Missing required field in `src/env.ts`
- Wrong import path for Factory package
- Using `any` type (not allowed in strict mode)

See [Lessons Learned Runbook](../../docs/runbooks/lessons-learned.md) for solutions.

### "Wrangler deploy fails with 403"

```bash
# Check CF_API_TOKEN is set in shell
echo $CF_API_TOKEN

# If empty, set it
export CF_API_TOKEN=$(gh secret get CF_API_TOKEN --repo Latimer-Woods-Tech/{app})

# Try again
wrangler deploy --env staging
```

See [GitHub Secrets Runbook](../../docs/runbooks/github-secrets-and-tokens.md).

### "Rate limit hitting users during testing"

Each app has a unique rate limiter namespace (1001–1006 in `wrangler.jsonc`). If testing locally:

```bash
# Disable rate limiting temporarily by modifying .dev.vars
# (Remove RATE_LIMITER binding or delete .dev.vars to use defaults)
```

Never disable in production. See [Environment Isolation Runbook](../../docs/runbooks/environment-isolation-and-verification.md).

## Related Documentation

- **Factory Core Guide**: [CLAUDE.md](../../CLAUDE.md) — Standing orders & hard constraints
- **Environment Setup**: [Environment Isolation Runbook](../../docs/runbooks/environment-isolation-and-verification.md)
- **Secrets Management**: [GitHub Secrets Runbook](../../docs/runbooks/github-secrets-and-tokens.md)
- **Deployment**: [Deployment Runbook](../../docs/runbooks/deployment.md)
- **Common Errors**: [Lessons Learned Runbook](../../docs/runbooks/lessons-learned.md)

## Support

- **Questions about Factory**: See [Factory Core Docs](https://factory-core.mintlify.dev)
- **Cloudflare Workers**: See [Cloudflare Docs](https://developers.cloudflare.com/workers)
- **Neon Database**: See [Neon Docs](https://neon.tech/docs)
- **Sentry Errors**: See [Sentry Docs](https://docs.sentry.io)

---

_Last updated: April 2026_ — See [Lessons Learned](../../docs/runbooks/lessons-learned.md) for update schedule.
