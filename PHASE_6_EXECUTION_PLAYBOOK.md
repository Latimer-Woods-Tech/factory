# Phase 6 Execution Playbook

**Time estimate:** 6-8 hours for full execution  
**Audience:** Infrastructure Engineer executing Phase 6  
**Status:** Ready (all scripts verified, all deliverables checked)

---

## Prerequisites Checklist

Before starting, verify you have:

- [ ] GitHub account with organization access
- [ ] Cloudflare account with full API permissions
- [ ] Neon account (sign up free at https://neon.tech)
- [ ] Sentry account (optional, sign up at https://sentry.io)
- [ ] PostHog account (optional, sign up at https://posthog.com)
- [ ] `gh` CLI installed (`gh --version`), authenticated (`gh auth status`)
- [ ] `wrangler` CLI installed (`wrangler --version`)
- [ ] Node.js 18+ (`node --version`)
- [ ] `factory_core` monorepo cloned and on `main` branch

---

## Phase 6 Breakdown

### Stage 1: Credential Gathering (30 minutes)

**See:** [docs/runbooks/CREDENTIALS_SETUP.md](./docs/runbooks/CREDENTIALS_SETUP.md) for detailed steps

**Quick summary:**

```bash
# 1. GitHub PAT (Personal Access Token)
# Go to: https://github.com/settings/tokens
# Scopes: repo, admin:org_hook, write:packages
export GITHUB_TOKEN="ghp_..."

# 2. CloudFlare Account ID
# Go to: https://dash.cloudflare.com/profile
# Near bottom-right of dashboard
export CF_ACCOUNT_ID="a1b2c3d4..."

# 3. CloudFlare API Token
# Go to: https://dash.cloudflare.com/profile/api-tokens
# Create with: Workers, Hyperdrive, Rate Limiting scopes
export CF_API_TOKEN="v1.0..."

# 4. Neon API Key (optional but recommended)
# Go to: https://console.neon.tech/app/settings/api-keys
export NEON_API_KEY="neon_api_key_..."

# 5. Sentry Auth Token (optional)
# Go to: https://sentry.io/settings/account/api/
export SENTRY_AUTH_TOKEN="sntrys_..."

# 6. PostHog API Key (optional)
# Go to: https://app.posthog.com/settings/project-settings
export POSTHOG_API_KEY="phc_..."
```

### Stage 2: Credential Verification (10 minutes)

```bash
# Verify GitHub token
gh auth status
# Expected: Logged in to github.com as <your-username>

# Verify CloudFlare token
curl -H "Authorization: Bearer $CF_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/ | jq '.success'
# Expected: true

# Verify Neon API key
curl -H "Authorization: Bearer $NEON_API_KEY" \
  https://api.neon.tech/v2/projects | jq '.projects | length'
# Expected: 0 to N (number of existing projects)
```

### Stage 3: Dry-Run Execution (15 minutes)

This stage simulates Phase 6 without actually provisioning infrastructure.

```bash
cd /path/to/factory_core
node scripts/phase-6-orchestrator.mjs --dry-run
```

**Expected output:**

```
🔐 Validating credentials...

✅ GitHub token valid
✅ CloudFlare API token valid
✅ Neon API key provided (optional)
✅ Sentry auth token provided (optional)
✅ PostHog API key provided (optional)

📋 Phase 6 Provisioning Plan (DRY RUN)

Database Setup:
  → Create Neon database: factory_core
  → Create Neon database: wordis_bond
  → Create Neon database: cypher_healing
  … (6 more apps)

Hyperdrive Setup:
  → Create Hyperdrive binding: factory_core_hyperdrive
  → Create Hyperdrive binding: wordis_bond_hyperdrive
  … (6 more apps)

Rate Limiting:
  → Configure rate limiter: wordis_bond_1001
  … (5 more apps)

Error Tracking (Sentry):
  → Create Sentry project: factory/wordis-bond
  … (5 more apps)

Analytics (PostHog):
  → Create PostHog project: factory/wordis-bond
  … (5 more apps)

GitHub Secrets:
  → Store 50+ secrets in github.com/Latimer-Woods-Tech/wordis-bond repo
  … (5 more apps)

✅ DRY RUN COMPLETE — Review plan above, then execute with:
   node scripts/phase-6-orchestrator.mjs
```

Review the plan. If anything looks wrong:
1. Delete credentials file: `rm -f .env.phase-6`
2. Re-read [CREDENTIALS_SETUP.md](./docs/runbooks/CREDENTIALS_SETUP.md)
3. Regather credentials
4. Re-run dry-run

### Stage 4: Real Execution (3-4 hours)

Once dry-run is successful:

```bash
node scripts/phase-6-orchestrator.mjs
```

**This will:**
1. ✅ Create 7 Neon databases
2. ✅ Apply `factory_core` DDL schema to all 7 databases
3. ✅ Create 7 Hyperdrive bindings in CloudFlare Workers
4. ✅ Configure 6 rate limiters
5. ✅ Create 6 Sentry projects
6. ✅ Create 6 PostHog projects
7. ✅ Store 50+ secrets in GitHub Actions for each app repo
8. ✅ Trigger `setup-all-apps.mjs` to wire everything together

**Expected output:**

```
🚀 PHASE 6: INFRASTRUCTURE SETUP

🔐 Validating credentials...
✅ GitHub token valid
✅ CloudFlare API token valid
✅ Neon API key valid
✅ Sentry auth token valid
✅ PostHog API key valid

📦 Provisioning Neon Databases...
✅ Created database: factory_core (project_id=proj_xxxxx)
✅ Applied DDL to factory_core
✅ Created database: wordis_bond (project_id=proj_yyyyy)
✅ Applied DDL to wordis_bond
… (database setup continues, takes ~5-10 minutes)

🔗 Provisioning Hyperdrive Bindings...
✅ Created Hyperdrive: factory_core_hyperdrive
   ID: hyperdrive_xxxxx
   Config ID: binding_xxxxx
✅ Created Hyperdrive: wordis_bond_hyperdrive
… (Hyperdrive setup continues, takes ~2-3 minutes)

🛡️ Configuring Rate Limiting...
✅ wordis_bond rate limiter: threshold 1000/min
✅ cypher_healing rate limiter: threshold 1000/min
… (rate limiting, takes ~2 minutes)

🚨 Provisioning Sentry Projects...
✅ Created Sentry project: factory/wordis-bond (dsn_key=xxxxx)
✅ Created Sentry project: factory/cypher-healing
… (Sentry setup, takes ~5-10 minutes, can be skipped if no SENTRY_AUTH_TOKEN)

📊 Provisioning PostHog Projects...
✅ Created PostHog project: factory/wordis-bond (api_key=phc_xxxxx)
✅ Created PostHog project: factory/cypher-healing
… (PostHog setup, takes ~5-10 minutes, can be skipped if no POSTHOG_API_KEY)

🔑 Storing GitHub Actions Secrets...
✅ Stored 52 secrets in github.com/Latimer-Woods-Tech/wordis-bond
   HYPERDRIVE_ID, NEON_CONN_STR, SENTRY_DSN, POSTHOG_API_KEY, JWT_SECRET, …
✅ Stored 52 secrets in github.com/Latimer-Woods-Tech/cypher-healing
… (secret storage for all 6 apps, takes ~5-10 minutes)

⚡ Running setup-all-apps.mjs...
✅ Configured wordis-bond/.env (wrangler.jsonc with bindings)
✅ Configured cypher-healing/.env
… (app config setup, takes ~2-3 minutes)

✅ PHASE 6 PROVISIONING COMPLETE

📋 Summary:
   7 Neon databases created
   7 Hyperdrive bindings created
   6 Sentry projects created (if enabled)
   6 PostHog projects created (if enabled)
   50+ secrets stored per app (6 apps total)
   300+ total secrets in GitHub

🎯 Next steps:
   1. Phase 7: node scripts/phase-7-validate.js --all
   2. Phase 8: Deploy first app via GitHub Actions
   3. Phase 9: Monitor with Sentry + PostHog dashboards
```

### Stage 5: Verification (30 minutes)

Manually verify infrastructure:

#### Verify Neon

```bash
# Check databases were created
curl -H "Authorization: Bearer $NEON_API_KEY" \
  https://api.neon.tech/v2/projects | jq '.projects[] | .name'
# Expected: factory_core, wordis_bond, cypher_healing, prime_self, ijustus, the_calling, neighbor_aid
```

#### Verify CloudFlare Hyperdrive

```bash
# Check Hyperdrive bindings
wrangler hyperdrive list
# Expected: 7 bindings (factory_core_hyperdrive, wordis_bond_hyperdrive, etc.)
```

#### Verify GitHub Secrets

```bash
# Check secrets were stored in one app repo
gh repo view Latimer-Woods-Tech/wordis-bond --json secretsCount
# Expected: "secretsCount": 52
```

#### Verify Sentry Projects (if created)

```bash
# Go to: https://sentry.io/organizations/your-org/
# Expected: 6 projects listed (wordis-bond, cypher-healing, etc.)
```

#### Verify PostHog Projects (if created)

```bash
# Go to: https://app.posthog.com/
# Expected: 6 projects listed (factory/wordis-bond, factory/cypher-healing, etc.)
```

---

## Phase 7: Validation (1 hour)

Once Phase 6 is complete:

```bash
node scripts/phase-7-validate.js --all
```

**Expected output:**

```
🔍 Validating Phase 7 readiness...

✅ wordis-bond repo structure OK
✅ wordis-bond has Drizzle schemas
✅ wordis-bond has CI/CD workflows
✅ wordis-bond has env verification script
✅ wordis-bond wrangler.jsonc has Hyperdrive binding

✅ cypher-healing repo structure OK
…(validation continues for all 6 apps)

✅ PHASE 7 VALIDATION COMPLETE

All 6 apps are ready for development.
Next: git clone + npm ci + npm run dev
```

---

## Troubleshooting

### Orchestrator Hangs

If the orchestrator seems to hang:

1. **Check network:** `ping api.neon.tech`
2. **Check credentials:** Re-verify tokens haven't expired
3. **Check rate limiting:** Neon/CloudFlare APIs may be rate-limiting; wait 60 seconds
4. **Interrupt and resume:** Press `Ctrl+C`, fix any issues, re-run from scratch

### `gh` CLI Fails

```bash
# Fix: Re-authenticate
gh auth logout
gh auth login --web
```

### CloudFlare API Returns 10000 Error

```
Error: 10000 Invalid request (bad JSON in body)
```

**Fix:** Verify `CF_ACCOUNT_ID` is correct:
```bash
# Check your account ID
curl -H "Authorization: Bearer $CF_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts | jq '.result[0].id'
```

### Neon Database Creation Fails

```
Error: 403 Unauthorized
```

**Fix:** Regenerate Neon API key with correct org permissions:
1. Go to https://console.neon.tech/app/settings/api-keys
2. Delete current key
3. Create new key with `read` + `write` permissions
4. Re-export `NEON_API_KEY`
5. Retry orchestrator

### GitHub Secrets Storage Fails

```
Error: gh: Repository not found
```

**Fix:** Verify repository name is correct:
```bash
# Check repo exists
gh repo view Latimer-Woods-Tech/wordis-bond
```

If repo doesn't exist, Phase 6 requires repo creation first. Update CLAUDE.md if needed.

---

## Rollback Procedure

If Phase 6 needs to be rolled back:

### Option 1: Complete Rollback (Dangerous)

```bash
# Delete all Neon databases
for db in factory_core wordis_bond cypher_healing prime_self ijustus the_calling neighbor_aid; do
  curl -X DELETE \
    -H "Authorization: Bearer $NEON_API_KEY" \
    https://api.neon.tech/v2/projects/$PROJECT_ID
done

# Delete all Hyperdrive bindings (via CloudFlare dashboard or wrangler)
wrangler hyperdrive delete factory_core_hyperdrive
# … (repeat for all 7)

# Delete all app repos (via GitHub.com)
gh repo delete Latimer-Woods-Tech/wordis-bond --confirm
# … (repeat for all 6)
```

### Option 2: Selective Rollback (Recommended)

Only delete what needs to be retried:
1. Delete specific Neon database
2. Delete specific Hyperdrive binding
3. Clear GitHub secrets in one app repo
4. Re-run orchestrator (starts from where it left off if possible)

### Option 3: Pause & Resume

If orchestrator fails mid-execution:
1. Fix the issue (credentials, API rate limit, etc.)
2. Re-run: `node scripts/phase-6-orchestrator.mjs`
3. Orchestrator detects already-created resources and skips them
4. Completes remaining steps

---

## Success Criteria

Phase 6 is successful when:

- [ ] 7 Neon databases exist + DDL applied
- [ ] 7 Hyperdrive instances exist in CloudFlare
- [ ] 6 rate limiters configured
- [ ] 50+ secrets stored in each app repo's GitHub Actions
- [ ] Phase 7 validation passes for all 6 apps
- [ ] First app deployment succeeds via GitHub Actions

---

## Next Steps

After Phase 6:

1. **Deploy first app:** Push a commit to `wordis-bond` → triggers CI/CD → deploys to staging
2. **Smoke test:** `curl https://wordis-bond-staging.workers.dev/health` → should return `{ok: true}`
3. **Monitor errors:** Check Sentry dashboard for any startup errors
4. **Monitor analytics:** Check PostHog dashboard for pageviews
5. **Deploy remaining apps:** Repeat for other 5 apps

---

## Support

**Issues?** Open a ticket or ping `#factory-eng` on Slack.

**Questions about specific API?** Refer to the relevant package docs:
- Neon: [Neon Docs](https://neon.tech/docs)
- CloudFlare Hyperdrive: [Workers Docs](https://developers.cloudflare.com/workers/)
- Sentry: [Sentry Docs](https://docs.sentry.io)
- PostHog: [PostHog Docs](https://posthog.com/docs)

---

**Prepared by:** Factory Infrastructure Team  
**Date:** April 25, 2026  
**Estimated execution time:** 6-8 hours  
**Automated by:** `scripts/phase-6-orchestrator.mjs`
