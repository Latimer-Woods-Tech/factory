# Getting Started Runbook

This runbook covers local development setup for a Factory app Worker.

## Prerequisites

- Node.js 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Access to the GitHub Packages registry (`@latimer-woods-tech/*`)
- Neon Postgres connection string (or access to factory-admin to retrieve it)

## 1. Clone the repo

```bash
git clone https://github.com/Latimer-Woods-Tech/{app}.git
cd {app}
```

## 2. Authenticate with GitHub Packages

Create (or reuse) a GitHub Personal Access Token with `read:packages` scope.

```bash
# ~/.npmrc or .npmrc in project root
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
@adrper79-dot:registry=https://npm.pkg.github.com
```

## 3. Install dependencies

```bash
npm install
```

## 4. Create `.dev.vars`

Wrangler loads `.dev.vars` as secrets during `wrangler dev`. **Never commit this file.**

```ini
# .dev.vars
JWT_SECRET=dev-secret-change-in-production
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENTRY_DSN=https://...@sentry.io/...
POSTHOG_KEY=phc_...
```

> For app-specific bindings (Hyperdrive, KV, R2), add them to `wrangler.jsonc` under `[dev]` bindings or use remote dev mode (`wrangler dev --remote`).

## 5. Verify local environment configuration

Before starting the Worker, run the app's environment verification if it exists. This catches missing bindings, wrong secret names, and environment mixups before `wrangler dev` starts.

```bash
node scripts/phase-6-setup.js --verify-local
```

If the app uses a different verifier, follow its README and [Environment Verification Setup](../ENVIRONMENT_VERIFICATION_SETUP.md).

## 6. Start the local dev server

```bash
npm run dev
# or
wrangler dev
```

The Worker is available at `http://localhost:8787`.

## 7. Verify the health endpoint

```bash
curl http://localhost:8787/health
# {"status":"ok","service":"{app}","version":"x.y.z"}
```

## 8. Running tests

```bash
npm test
# with coverage
npm run test:coverage
```

## 9. TypeScript typecheck

```bash
npm run typecheck
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `401 Unauthorized` on npm install | Re-check GitHub PAT scope and `.npmrc` |
| `ETARGET No matching version` | Run `npm install @latimer-woods-tech/{pkg}@latest` |
| Wrangler `InvalidSymbol` in wrangler.jsonc | Ensure all JSON keys are quoted |
| `process.env` not available | Use `c.env.VAR` / `env.VAR` (Cloudflare bindings only) |
| `Buffer is not defined` | Replace with `TextEncoder` / `Uint8Array` |
| Environment mismatch or missing binding | Run the local verifier and compare with [Environment Verification Setup](../ENVIRONMENT_VERIFICATION_SETUP.md) |
