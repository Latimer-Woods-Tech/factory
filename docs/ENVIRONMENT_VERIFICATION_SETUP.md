# Environment Verification Script Setup

This guide shows how to add the environment verification script to each Factory app.

## Quick Setup

### 1. Copy the script to your app

```bash
cd apps/{app-name}
mkdir -p scripts
cp ../../docs/scripts/verify-env.js scripts/verify-env.js
```

### 2. Add npm scripts to package.json

```json
{
  "scripts": {
    "verify:env": "node scripts/verify-env.js local",
    "verify:env:staging": "node scripts/verify-env.js staging",
    "verify:env:production": "node scripts/verify-env.js production",
    "dev": "npm run verify:env && wrangler dev"
  }
}
```

### 3. Add .dev.vars.example to your app

```bash
cp ../../docs/.dev.vars.example .dev.vars.example
```

Then create `.dev.vars` by copying and filling in the template:

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your actual values
```

### 4. Test the verification

```bash
npm run verify:env

# Output should be:
# 🔍 Verifying local environment configuration...
#
#   ✅ wrangler.jsonc exists
#   ✅ src/env.ts exists
#   ✅ src/index.ts exists
#   ✅ .dev.vars exists (required for local)
#   ✅ Worker name is environment-appropriate
#   ✅ Hyperdrive binding exists (DB)
#   ✅ Rate limiter binding exists (AUTH_RATE_LIMITER)
#   ✅ src/index.ts defines /health endpoint
#   ✅ src/env.ts declares DB
#   ... (more fields)
#
# 15 passed, 0 failed
#
# ✨ Everything looks good!
```

## What the Script Does

### Checks for Local Development (`npm run verify:env`)

1. ✅ wrangler.jsonc exists
2. ✅ src/env.ts exists
3. ✅ src/index.ts exists
4. ✅ .dev.vars exists and has values (not empty)
5. ✅ Worker name doesn't contain "-staging" (local naming)
6. ✅ Hyperdrive binding configured (DB)
7. ✅ Rate limiter binding configured (AUTH_RATE_LIMITER)
8. ✅ /health endpoint defined in src/index.ts
9. ✅ All required environment fields declared in src/env.ts
10. ✅ All required values set in .dev.vars

### Checks for Staging (`npm run verify:env:staging`)

Same as local, plus:
- ✅ Worker name contains "-staging"

### Checks for Production (`npm run verify:env:production`)

Same as local, but:
- ✅ Worker name does NOT contain "-staging"

## Usage Examples

### Before Starting Local Dev

```bash
npm run verify:env

# If it fails, shows helpful hints:
# 💡 How to fix:
#    1. src/env.ts should declare JWT_SECRET in Env interface
#    2. Add JWT_SECRET=<value> to .dev.vars (see .dev.vars.example for format)
#
# Exit code: 1 (prevents `npm run dev` from starting)
```

### Before Deploying to Staging

```bash
npm run verify:env:staging

# Checks that wrangler.jsonc is configured for staging environment
```

### Before Deploying to Production

```bash
npm run verify:env:production

# Checks that wrangler.jsonc is configured for production (no "-staging" in name)
```

### Integrated into Dev Startup

Edit package.json:

```json
{
  "scripts": {
    "dev": "npm run verify:env && wrangler dev"
  }
}
```

Now running `npm run dev` always verifies environment first:

```bash
npm run dev

# First runs: npm run verify:env
# If verification fails → stops and shows helpful hints
# If verification passes → starts wrangler dev
```

## Script Output Examples

### Success

```bash
$ npm run verify:env

🔍 Verifying local environment configuration...

  ✅ wrangler.jsonc exists
  ✅ src/env.ts exists
  ✅ src/index.ts exists
  ✅ .dev.vars exists (required for local)
  ✅ Worker name is environment-appropriate
  ✅ Hyperdrive binding exists (DB)
  ✅ Rate limiter binding exists (AUTH_RATE_LIMITER)
  ✅ src/index.ts defines /health endpoint
  ✅ src/env.ts declares DB
  ✅ src/env.ts declares SENTRY_DSN
  ✅ src/env.ts declares POSTHOG_KEY
  ✅ src/env.ts declares JWT_SECRET
  ✅ src/env.ts declares ENVIRONMENT
  ✅ src/env.ts declares WORKER_NAME
  ✅ .dev.vars has NEON_URL (not empty)
  ✅ .dev.vars has JWT_SECRET (not empty)
  ✅ .dev.vars has SENTRY_DSN (not empty)
  ✅ .dev.vars has POSTHOG_KEY (not empty)

18 passed, 0 failed

✨ Everything looks good!

Run: npm run dev
```

### Failure

```bash
$ npm run verify:env

🔍 Verifying local environment configuration...

  ✅ wrangler.jsonc exists
  ✅ src/env.ts exists
  ✅ src/index.ts exists
  ❌ .dev.vars exists (required for local)
  ✅ Worker name is environment-appropriate
  ✅ Hyperdrive binding exists (DB)
  ✅ Rate limiter binding exists (AUTH_RATE_LIMITER)
  ✅ src/index.ts defines /health endpoint
  ✅ src/env.ts declares DB
  ✅ src/env.ts declares SENTRY_DSN
  ✅ src/env.ts declares POSTHOG_KEY
  ✅ src/env.ts declares JWT_SECRET
  ✅ src/env.ts declares ENVIRONMENT
  ✅ src/env.ts declares WORKER_NAME

15 passed, 1 failed

💡 How to fix:

   1. Copy .dev.vars.example to .dev.vars and fill in your values

Error code: 1
```

## Customizing the Script

The script is highly customizable. Edit `scripts/verify-env.js`:

### Add a New Check

```javascript
// Add to the checks array
checks.push({
  name: 'Custom check description',
  pass: () => {
    // Return true if check passes, false if fails
    return true;
  },
  help: 'How to fix if check fails'
});
```

### Skip a Check for Your App

```javascript
// Conditionally add check
if (appName !== 'special-app') {
  checks.push({...});
}
```

### Change Environment Names

```javascript
// Customize which environments are checked
const validEnvs = ['local', 'dev', 'staging', 'production'];
if (!validEnvs.includes(targetEnv)) {
  console.error(`Invalid environment: ${targetEnv}`);
  process.exit(1);
}
```

## See Also

- [Environment Isolation & Verification Runbook](../runbooks/environment-isolation-and-verification.md)
- [.dev.vars Example Template](../.dev.vars.example)
- [GitHub Secrets & Tokens Runbook](../runbooks/github-secrets-and-tokens.md)
