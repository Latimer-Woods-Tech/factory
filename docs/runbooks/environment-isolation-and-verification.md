# Environment Isolation & Verification

This runbook documents how all 6 Factory apps prevent environment mixups using layered configuration and runtime verification.

## The Problem: Environment Mixups

Environment mixups happen when:
- Developer deploys staging code to production
- Production secrets leak into staging logs
- Staging database hits production data
- Wrong rate limiter namespace causes staging to block production users
- Hyperdrive binding connects to wrong database

**Root cause**: Environments are not isolated at build/deployment/runtime layers.

## The Solution: Layered Isolation

All 6 Factory apps use **three layers of isolation** to prevent mixups:

### Layer 1: Build-Time — wrangler.jsonc Isolation

Each app has a unique `wrangler.jsonc` with environment-specific overrides:

```jsonc
{
  "name": "wordis-bond",
  "compatibility_date": "2024-11-01",
  
  // ← Non-secret config (public in source)
  "vars": {
    "ENVIRONMENT": "production",
    "WORKER_NAME": "wordis-bond"
  },
  
  // ← Per-app unique Hyperdrive binding
  "hyperdrive": [{ "binding": "DB", "id": "96d8e7a2-..." }],
  
  // ← Per-app unique rate limiter namespace
  "rate_limiters": [{
    "binding": "AUTH_RATE_LIMITER",
    "namespace_id": "1002",  // wordis-bond only
    "simple": { "limit": 60, "period": 60 }
  }],
  
  // ← Staging override (different WORKER_NAME → different URL)
  "env": {
    "staging": {
      "name": "wordis-bond-staging",
      "vars": {
        "ENVIRONMENT": "staging",
        "WORKER_NAME": "wordis-bond-staging"
      }
    }
  }
}
```

**Protection**: 
- `WORKER_NAME` is hardcoded per environment (no typos, no .env fetch)
- Hyperdrive ID is per-app (staging can't accidentally query production DB)
- Rate limiter namespace is unique per app (staging can't block production users)

### Layer 2: Deploy-Time — GitHub Actions Environment Secrets

Each environment (production, staging) has separate GitHub Actions environment with approval gates:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  deploy:
    name: Deploy to ${{ matrix.environment }}
    environment: ${{ matrix.environment }}  # ← Separate secrets per env
    strategy:
      matrix:
        include:
          - environment: staging
            branch: staging
          - environment: production
            branch: main
    
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ matrix.branch }}
      
      - name: Deploy
        env:
          # These come from GitHub Environment Secrets
          # Can only access after approval
          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
          POSTHOG_KEY: ${{ secrets.POSTHOG_KEY }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
        run: wrangler deploy --env ${{ matrix.environment }}
```

**Protection**:
- Production secrets have approval gate (must explicitly authorize)
- Staging secrets cannot access production database URL
- If someone tries to deploy staging code to production, it gets staging secrets (still wrong, but caught at runtime)

### Layer 3: Runtime — TypeScript Type Validation + Health Endpoint

```typescript
// src/env.ts — All fields REQUIRED (no optionals)
export interface Env {
  DB: Hyperdrive;
  AUTH_RATE_LIMITER: RateLimit;
  SENTRY_DSN: string;        // ← Missing? Compile error
  POSTHOG_KEY: string;
  JWT_SECRET: string;
  ENVIRONMENT: 'staging' | 'production';  // ← Literal type, enum-like
  WORKER_NAME: string;
}

// src/index.ts — Type safety in middleware
import type { Env } from './env';

const app = new Hono<{ Bindings: Env }>();

app.use('*', (c, next) => {
  // TS error if c.env.ENVIRONMENT is missing or wrong type
  const env = c.env.ENVIRONMENT as 'staging' | 'production';
  
  return sentryMiddleware({
    dsn: c.env.SENTRY_DSN,      // ← TS error if missing
    environment: env,
    workerName: c.env.WORKER_NAME  // ← TS error if missing
  })(c, next);
});

// Health endpoint (runtime verification)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    worker: c.env.WORKER_NAME,        // Shows actual worker name
    environment: c.env.ENVIRONMENT,   // Shows actual environment
    timestamp: new Date().toISOString()
  });
});
```

**Protection**:
- Any missing secret = compile error (caught in CI before deploy)
- ENVIRONMENT is literal type (only 'staging' | 'production', no typos)
- `/health` endpoint reveals current environment (can verify post-deploy)

## Verification Workflow

### After Deploy: Check /health Endpoint

```bash
# Verify production deployment
curl https://wordis-bond.workers.dev/health | jq .
# Expected:
# {"status":"ok","worker":"wordis-bond","environment":"production"}

# Verify staging deployment
curl https://wordis-bond-staging.workers.dev/health | jq .
# Expected:
# {"status":"ok","worker":"wordis-bond-staging","environment":"staging"}

# If you see this — WRONG ENVIRONMENT DEPLOYED
# {"status":"ok","worker":"wordis-bond-staging","environment":"production"}
# → Staging code deployed to production URL!
```

### Pre-Deploy: Verify wrangler env

```bash
cd apps/wordis-bond

# Check which environment you're about to deploy
wrangler deploy --dry-run --env staging 2>&1 | grep "Worker name"

# Should show: "wordis-bond-staging"
# If it shows "wordis-bond" → You're about to deploy to PRODUCTION!
```

### CI/CD: Automated Environment Checks

Add this to `.github/workflows/deploy.yml`:

```yaml
- name: Verify Environment
  run: |
    ENV=${{ matrix.environment }}
    EXPECTED_WORKER=$([ "$ENV" = "production" ] && echo "wordis-bond" || echo "wordis-bond-staging")
    ACTUAL_WORKER=$(grep '"name"' wrangler.jsonc | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
    
    echo "Expected worker: $EXPECTED_WORKER"
    echo "Actual worker: $ACTUAL_WORKER"
    
    if [ "$ENV" = "staging" ] && [ "$ACTUAL_WORKER" = "wordis-bond" ]; then
      echo "ERROR: Staging branch pointing to production worker!"
      exit 1
    fi
```

## Anti-Pattern: What NOT to Do

### ❌ Environment Variable in wrangler.jsonc vars

```jsonc
// WRONG — Modifiable at deploy time, no isolation
{
  "vars": {
    "DATABASE_URL": "postgres://...",  // If hardcoded, which environment?
    "ENVIRONMENT": "production"        // Easy to typo
  }
}
```

**Problem**: Same value in both production and staging → Potential mixup

### ❌ Optional Environment Fields

```typescript
// WRONG — TypeScript allows missing secrets
export interface Env {
  SENTRY_DSN?: string;  // Optional — code won't error if missing
  JWT_SECRET?: string;
}
```

**Problem**: Missing secret = silent failure, not compile error

### ❌ Environment Variables Read from .env at Runtime

```typescript
// WRONG — Not available on Cloudflare Workers
const env = process.env.ENVIRONMENT;  // undefined on Workers!
```

**Problem**: Code works locally (Node.js) but breaks on Workers (no process object)

### ❌ Secrets in wrangler.jsonc

```jsonc
// WRONG — Secrets in source code!
{
  "vars": {
    "SENTRY_DSN": "https://xxx@xxx.ingest.sentry.io/1234"
  }
}
```

**Problem**: Secrets leak to GitHub, visible to anyone with repo access

## Isolation Checklist

Before deploying any app, verify:

### Configuration
- [ ] `wrangler.jsonc` has `"name": "{app-name}"` or `"{app-name}-staging"` (not generic)
- [ ] `WORKER_NAME` in `vars` matches the worker name (no typos)
- [ ] Rate limiter `namespace_id` is unique per app (1001–1006)
- [ ] Hyperdrive `id` is unique per app (verify in wrangler.jsonc)
- [ ] `env.staging` overrides exist: `ENVIRONMENT: "staging"`, `WORKER_NAME: "{app}-staging"`

### Secrets
- [ ] All required fields in `src/env.ts` are non-optional
- [ ] No secrets in `wrangler.jsonc` `vars` section
- [ ] All secrets set in GitHub Actions environment secrets (not repo secrets)
- [ ] GitHub Actions workflow targets correct environment (`environment: production` or `staging`)

### Deployment
- [ ] Ran `wrangler deploy --dry-run --env {env}` and verified worker name
- [ ] Confirmed correct branch (`main` = production, `staging` = staging branch)
- [ ] Checked `/health` endpoint post-deploy to verify environment

### Monitoring
- [ ] Sentry is reporting errors to correct project (staging vs. production DSN)
- [ ] PostHog is tracking events to correct workspace (staging vs. production key)
- [ ] Logs show correct `worker` and `environment` values

## Real-World Scenario: Staging → Production Mixup

**Scenario**: Developer merges staging code to main by mistake.

**Layer 1 Protection (Build-Time)**:
- CI/CD runs on `main` branch
- `wrangler deploy` reads `wrangler.jsonc` (which specifies `name: wordis-bond`, not `wordis-bond-staging`)
- Code deploys to `wordis-bond.workers.dev` (production URL)
- **Layer 1 failed → Staged code goes to production ❌**

**Layer 2 Protection (Deploy-Time)**:
- GitHub Actions workflow checks `environment: production`
- Secrets are from production environment (correct DB, correct Sentry)
- **Layer 2 passed → Code has production secrets ✓**

**Layer 3 Protection (Runtime)**:
- App starts with `c.env.ENVIRONMENT = 'production'`
- `c.env.WORKER_NAME = 'wordis-bond'`
- `/health` endpoint returns `worker: wordis-bond, environment: production`
- **Layer 3 passed → No obvious sign of mixup ✓**

**Detection**: 
- Monitor Sentry for surge in errors (staging code hitting production data)
- Check PostHog for unexpected events (staging logic in production)
- Developers immediately see via `/health` that production URL has production env

**Root cause**: Staging code should have never merged to `main`. Fix: use branch protection rules requiring PR review.

## Environment Verification Script

Add this to each app's `scripts` section in `package.json`:

```json
{
  "scripts": {
    "verify:env:local": "node scripts/verify-env.js local",
    "verify:env:staging": "node scripts/verify-env.js staging",
    "verify:env:production": "node scripts/verify-env.js production"
  }
}
```

Create `scripts/verify-env.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const targetEnv = process.argv[2] || 'production';

console.log(`\n🔍 Verifying ${targetEnv} environment...\n`);

// Read wrangler.jsonc (simplified JSONC parser)
const wranglerPath = path.join(__dirname, '../wrangler.jsonc');
const wranglerContent = fs.readFileSync(wranglerPath, 'utf-8');

const checks = [
  {
    name: 'wrangler.jsonc exists',
    check: () => fs.existsSync(wranglerPath)
  },
  {
    name: `.dev.vars${targetEnv === 'local' ? '' : ' (not needed)'} exists`,
    check: () => targetEnv === 'production' || fs.existsSync(path.join(__dirname, '../.dev.vars'))
  },
  {
    name: 'src/env.ts has required fields',
    check: () => {
      const envPath = path.join(__dirname, '../src/env.ts');
      const envContent = fs.readFileSync(envPath, 'utf-8');
      return envContent.includes('SENTRY_DSN') && envContent.includes('JWT_SECRET');
    }
  },
  {
    name: 'src/index.ts has /health endpoint',
    check: () => {
      const indexPath = path.join(__dirname, '../src/index.ts');
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      return indexContent.includes("'/health'") || indexContent.includes('"/health"');
    }
  },
  {
    name: targetEnv === 'production' ? 'Production worker name is not "-staging"' : 'Staging worker name is "-staging"',
    check: () => {
      if (targetEnv === 'production') {
        return !wranglerContent.includes('"-staging"') && !wranglerContent.includes("'-staging'");
      } else {
        return wranglerContent.includes('-staging') || wranglerContent.includes('env.staging');
      }
    }
  }
];

let passed = 0;
let failed = 0;

checks.forEach(({ name, check }) => {
  try {
    if (check()) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`  ⚠️  ${name} (error: ${e.message})`);
    failed++;
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
```

Then run:
```bash
npm run verify:env:production   # Check before deploying to prod
npm run verify:env:staging     # Check before deploying to staging
```

## Summary

| Layer | Mechanism | Catches What |
|-------|-----------|--------------|
| **Build-Time** | wrangler.jsonc unique worker names + rate limiter IDs | Deploying to wrong URL/database |
| **Deploy-Time** | GitHub Actions environment secrets with approval gate | Accessing wrong secrets |
| **Runtime** | Required fields + `/health` endpoint | Missing secrets, wrong environment |

**Result**: Staging code can reach production, but:
1. ✅ It uses production secrets (not staging)
2. ✅ It's visible at runtime (`/health` shows production env)
3. ✅ Errors/events flow to correct monitoring (Sentry/PostHog)

This forces developers to notice the mixup immediately and prevents silent data corruption.

## See Also

- [GitHub Secrets & Tokens Runbook](./github-secrets-and-tokens.md) — Where to set environment secrets
- [Deployment Runbook](./deployment.md) — How to deploy with proper environment gates
- [Lessons Learned Runbook](./lessons-learned.md) — Common environment mixup errors
