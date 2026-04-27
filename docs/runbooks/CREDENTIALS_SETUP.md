# Phase 6: Credentials Setup Guide

This guide walks you through gathering all credentials needed to execute the Phase 6 orchestrator.

## Prerequisites

- GitHub account with org access
- Cloudflare account with full API permissions
- Neon account (optional but recommended for automation)
- Sentry account (optional but recommended for error tracking)
- PostHog account (optional but recommended for analytics)

---

## Step 1: GitHub Personal Access Token (PAT)

### Why?
- Create 6 app repositories (`wordis-bond`, `cypher-healing`, `prime-self`, `ijustus`, `the-calling`, `neighbor-aid`)
- Store secrets in GitHub Actions
- Automate repository setup

### How to Generate?

1. Go to **GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token**
3. Give it a name: `Factory Core Phase 6 - Infrastructure Setup`
4. Set expiration: **90 days** (rotate after first successful Phase 6 run)
5. Select scopes:
   - ✅ `repo` (full control of private repositories)
   - ✅ `admin:repo_hook` (write access to hooks)
   - ✅ `admin:org_hook` (org hooks)
   - ✅ `write:packages` (publish packages)
   - ❌ Do NOT select `delete:packages` or `delete:repo`

6. Click **Generate token**
7. Copy the token immediately (you won't see it again)

### Export as Environment Variable

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## Step 2: Cloudflare API Token & Account ID

### Why?
- Create 7 Hyperdrive instances (database bindings)
- Manage Workers environments
- Configure rate limiting
- Deploy to Cloudflare infrastructure

### Get Your Account ID

1. Log in to **Cloudflare Dashboard**
2. Click on any domain or your account
3. Look for **Account ID** in the right sidebar (or go to **Settings → Account**)
4. Copy it (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

### Export as Environment Variable

```bash
export CF_ACCOUNT_ID="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

### Create API Token

1. Go to **Cloudflare Dashboard → Settings → API Tokens**
2. Click **Create token** (or use existing if you have one)
3. Choose **Create custom token**
4. Required permissions:
   - ✅ `Cloudflare Workers Scripts - Edit` (deploy workers)
   - ✅ `Cloudflare Workers KV - Edit` (for KV storage)
   - ✅ `Hyperdrive - Edit` (create/manage Hyperdrive)
   - ✅ `Rate Limiting - Edit` (configure rate limits)
   - ✅ `Account Settings - Read` (verify account)

5. Client IP Restriction (optional but recommended):
   - Add your current IP: Run `curl https://api.ipify.org`
   - Or leave blank for machine learning/CI environments

6. TTL: Set to **90 days** (rotate after)
7. Click **Create token**
8. Copy the token immediately

### Export as Environment Variable

```bash
export CF_API_TOKEN="v1.0xxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Verify Both

```bash
# Test GitHub token
gh auth status

# Test Cloudflare token
curl -H "Authorization: Bearer $CF_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/
```

Should output JSON with `"success": true`.

---

## Step 3: Neon API Key (Optional but Recommended)

### Why?
- Automate database provisioning (7 databases, schema setup, migrations)
- Faster than manual `neon project create`
- Tracks database IDs for Hyperdrive binding

### Create API Key

1. Go to **Neon Dashboard → Account → API Keys**
2. Click **Create API key**
3. Name it: `Factory Core Phase 6`
4. Copy the key immediately (you won't see it again)

### Export as Environment Variable

```bash
export NEON_API_KEY="neon_api_key_xxxxxxxxxxxxxxxxxxxxxxxx"
```

### Verify

```bash
curl -H "Authorization: Bearer $NEON_API_KEY" \
  https://api.neon.tech/v2/projects
```

---

## Step 4: Sentry Auth Token (Optional but Recommended)

### Why?
- Automate error tracking project creation (6 projects)
- Capture unhandled exceptions from Cloudflare Workers
- Real-time alerting on production errors

### Create Auth Token

1. Go to **Sentry → Settings → Auth Tokens**
2. Click **Create New Token**
3. Name it: `Factory Core Phase 6`
4. Select scopes:
   - ✅ `project:admin` (create/manage projects)
   - ✅ `org:admin` (organization settings)

5. Copy the token immediately

### Export as Environment Variable

```bash
export SENTRY_AUTH_TOKEN="sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## Step 5: PostHog API Key (Optional but Recommended)

### Why?
- Automate analytics project creation (6 projects)
- Track user behavior, feature flags, and funnels
- Real-time dashboards

### Create Project API Key

1. Go to **PostHog → Settings → Project Settings**
2. Scroll to **API Keys**
3. Copy the **Project API Key** (starts with `phc_`)
4. Or create a personal API key:
   - **Settings → Personal API Keys → Create**

### Export as Environment Variable

```bash
export POSTHOG_API_KEY="phc_xxxxxxxxxxxxx"
```

---

## Complete Setup Script

Create `.env.phase-6` (or add to your shell rc file):

```bash
# GitHub
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Cloudflare (required)
export CF_API_TOKEN="v1.0xxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxx"
export CF_ACCOUNT_ID="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

# Neon (optional but recommended)
export NEON_API_KEY="neon_api_key_xxxxxxxxxxxxxxxxxxxxxxxx"

# Sentry (optional but recommended)
export SENTRY_AUTH_TOKEN="sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxx"

# PostHog (optional but recommended)
export POSTHOG_API_KEY="phc_xxxxxxxxxxxxx"
```

### Load before running orchestrator

```bash
source .env.phase-6
node scripts/phase-6-orchestrator.mjs --dry-run
```

---

## Rotation Schedule

| Token | Rotation | Reason |
|---|---|---|
| GitHub PAT | Every 90 days | Standard security practice |
| CF_API_TOKEN | Every 180 days | Less frequently needed |
| NEON_API_KEY | Every 180 days | Database access |
| SENTRY_AUTH_TOKEN | Every 90 days | Security audit logs |
| POSTHOG_API_KEY | Every 180 days | Analytics access |

After rotation, update all CI/CD secrets in GitHub Actions.

---

## Troubleshooting

### `gh auth status` fails
- Check `GITHUB_TOKEN` format (should start with `ghp_`)
- Regenerate PAT with correct scopes

### Cloudflare API returns `code: 10000` (Invalid request)
- Verify `CF_ACCOUNT_ID` is correct (check dashboard again)
- Ensure API token scopes include `Account Settings - Read`

### `403 Forbidden` on Neon API
- Check `NEON_API_KEY` format
- Regenerate with correct organization privileges

### Orchestrator hangs during Sentry/PostHog setup
- These are optional; skip if not needed
- Remove `SENTRY_AUTH_TOKEN` and `POSTHOG_API_KEY` from env

---

## Next Steps

Once all credentials are set:

```bash
# Verify setup (safe, no side effects)
node scripts/phase-6-orchestrator.mjs --dry-run

# Execute Phase 6 (provisions real infrastructure)
node scripts/phase-6-orchestrator.mjs
```

See [PHASE_6_QUICK_START.md](../PHASE_6_QUICK_START.md) for execution details.
