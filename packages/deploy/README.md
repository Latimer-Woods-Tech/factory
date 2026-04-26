# @factory/deploy

Deployment scripts and configuration templates for Factory Cloudflare Workers applications.

> **No TypeScript source.** This package ships shell scripts and template files only.

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
