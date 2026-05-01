# @latimer-woods-tech/deploy

Deployment scripts and configuration templates for Factory Cloudflare Workers applications.

> **No TypeScript source.** This package ships shell scripts and a Node.js scaffold CLI.

---

## Scaffold CLI

The fastest way to start a new Factory app. Scaffolds a fully wired Cloudflare Worker,
creates the Hyperdrive binding, and optionally creates the GitHub repo.

### Prerequisites

- Node.js 20+, git, wrangler, (optionally) gh CLI
- `NODE_AUTH_TOKEN` — GitHub PAT with `read:packages` scope so `npm install` can
  pull `@latimer-woods-tech/*` from GitHub Packages

```bash
# Run from the directory where you want the new app created:
node node_modules/@latimer-woods-tech/deploy/scripts/scaffold.mjs <app-name>

# With GitHub repo creation:
node node_modules/@latimer-woods-tech/deploy/scripts/scaffold.mjs <app-name> --github

# Skip the first-deploy prompt:
node node_modules/@latimer-woods-tech/deploy/scripts/scaffold.mjs <app-name> --no-deploy
```

The script will:
1. Prompt for your Neon connection string and create a Hyperdrive binding
2. Generate all boilerplate files (see below)
3. `git init` and commit
4. Optionally create a private GitHub repo and push (`--github`)
5. Run `npm install`
6. Optionally configure Wrangler secrets interactively
7. Optionally run the first `wrangler deploy`

### What gets generated

| File | Purpose |
|------|---------|
| `package.json` | All core `@latimer-woods-tech/*` deps pre-wired |
| `wrangler.jsonc` | Hyperdrive + vars + staging env |
| `.npmrc` | GitHub Packages auth for `@latimer-woods-tech` scope |
| `tsconfig.json` | Strict TS for Cloudflare Workers |
| `src/env.ts` | `Env` interface for all Worker bindings |
| `src/index.ts` | Hono app with error boundary + JWT middleware |
| `src/index.test.ts` | Vitest starter test |
| `vitest.config.ts` | Vitest config with coverage thresholds |
| `.dev.vars.example` | Local dev secrets template |
| `.github/workflows/ci.yml` | CI (typecheck + test) |
| `.github/workflows/deploy.yml` | Deploy on push to main |

### GitHub repo secrets required by the generated workflows

| Secret | What it is |
|--------|-----------|
| `PACKAGES_READ_TOKEN` | GitHub PAT with `read:packages` (to install `@latimer-woods-tech/*`) |
| `CF_API_TOKEN` | Cloudflare API token — "Edit Cloudflare Workers" template |
| `CF_ACCOUNT_ID` | Your Cloudflare account ID (from Workers dashboard URL) |

---

## Scripts

Make scripts executable before use: `chmod +x scripts/*.sh`

### `scripts/validate-env.sh`

Checks that all required Factory environment variables are set.

```bash
./scripts/validate-env.sh            # checks current shell env
./scripts/validate-env.sh .env.local # sources a specific env file first
```

### `scripts/setup-secrets.sh`

Interactive Wrangler secret configuration for a new Factory Worker.

```bash
./scripts/setup-secrets.sh my-worker-name
```

Prompts for each secret in turn and calls `wrangler secret put` for each non-empty value.

### `scripts/deploy.sh`

Full deploy pipeline: env validation → `wrangler deploy` → optional Sentry release tagging.

```bash
./scripts/deploy.sh my-worker-name              # deploy to production
./scripts/deploy.sh my-worker-name staging      # deploy to staging
```

Set `SENTRY_AUTH_TOKEN` and `SENTRY_ORG` environment variables to enable Sentry release tagging.

---

## Templates

Copy templates into your app repository and customise.

| File | Purpose |
|------|---------|
| `templates/wrangler.jsonc` | Wrangler config with Hyperdrive, vars, and environments |
| `templates/.env.factory.example` | All required Factory env var names with example values |
| `templates/ci.yml` | GitHub Actions CI workflow (lint + typecheck + test) |
| `templates/deploy.yml` | GitHub Actions deploy workflow (wrangler-action) |

### Quick Start

```bash
# 1. Copy the wrangler config template
cp node_modules/@factory/deploy/templates/wrangler.jsonc wrangler.jsonc
# Edit: set your worker name and Hyperdrive ID

# 2. Copy the env example
cp node_modules/@factory/deploy/templates/.env.factory.example .env
# Edit: fill in your actual values (never commit .env)

# 3. Set secrets in Wrangler
./node_modules/@factory/deploy/scripts/setup-secrets.sh my-worker

# 4. Deploy
./node_modules/@factory/deploy/scripts/deploy.sh my-worker production
```

Deployment scripts and CI support for Factory services.
