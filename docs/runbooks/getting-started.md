# Getting Started Runbook

This runbook covers local development setup for a Factory app Worker.

## Prerequisites

- Node.js 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- Access to the GitHub Packages registry (`@adrper79-dot/*`)
- Neon Postgres connection string (or access to factory-admin to retrieve it)

## 1. Clone the repo

```bash
git clone https://github.com/adrper79-dot/{app}.git
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

## 5. Start the local dev server

```bash
npm run dev
# or
wrangler dev
```

The Worker is available at `http://localhost:8787`.

## 6. Verify the health endpoint

```bash
curl http://localhost:8787/health
# {"status":"ok","service":"{app}","version":"x.y.z"}
```

## 7. Running tests

```bash
npm test
# with coverage
npm run test:coverage
```

## 8. TypeScript typecheck

```bash
npm run typecheck
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `401 Unauthorized` on npm install | Re-check GitHub PAT scope and `.npmrc` |
| `ETARGET No matching version` | Run `npm install @adrper79-dot/{pkg}@latest` |
| Wrangler `InvalidSymbol` in wrangler.jsonc | Ensure all JSON keys are quoted |
| `process.env` not available | Use `c.env.VAR` / `env.VAR` (Cloudflare bindings only) |
| `Buffer is not defined` | Replace with `TextEncoder` / `Uint8Array` |
