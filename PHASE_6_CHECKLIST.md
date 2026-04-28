# Phase 6: Infrastructure Setup — Execution Checklist

**Last Updated:** April 28, 2026  
**Status:** Ready to execute  
**Blocker:** Yes — blocks Phases 7, 8, 9, 10, 11  
**Owner:** Infrastructure Engineer  
**Duration:** 4–6 hours  
**Date:** [Record execution date here]

---

## Pre-Execution: Credentials & Access

Before starting Phase 6, gather and verify these credentials:

### GitHub
- [ ] GitHub Personal Access Token (repo scope: full)
  - Test: `gh auth status`
  - Location: Export as `GITHUB_TOKEN` or `GH_TOKEN`

### CloudFlare
- [ ] API Token (Workers admin)
  - Test: `wrangler whoami`
  - Export: `CF_API_TOKEN` and `CF_ACCOUNT_ID`
  - Portal: https://dash.cloudflare.com/profile/api-tokens

### Neon
- [ ] Neon project ID
  - Dashboard: https://console.neon.tech
  - Export as: `NEON_PROJECT_ID`
- [ ] (Optional) Neon API Key for automation
  - Export as: `NEON_API_KEY`

### Sentry
- [ ] Sentry organization
  - Export: `SENTRY_AUTH_TOKEN`
  - Dashboard: https://sentry.io/

### PostHog
- [ ] PostHog organization
  - Export: `POSTHOG_API_KEY`
  - Dashboard: https://app.posthog.com/

---

## Phase 6 Execution

### 6.1 Neon Database Provisioning

**Objective:** Create 7 databases (1 factory_core + 6 app databases)

**Method A: Automated (requires NEON_API_KEY)**
```bash
node scripts/phase-6-orchestrator.mjs --dry-run  # Test first
node scripts/phase-6-orchestrator.mjs            # Execute
```

**Method B: Manual (via Neon dashboard)**
1. Navigate to https://console.neon.tech
2. Select project (or create "factory-production")
3. Create databases:
   - [ ] `factory_core`
   - [ ] `wordis_bond`
   - [ ] `cypher_healing`
   - [ ] `prime_self`
   - [ ] `ijustus`
   - [ ] `the_calling`
   - [ ] `neighbor_aid`

**Save connection strings:**
```bash
# Copy from Neon dashboard and export
export NEON_CONN_STR_FACTORY_CORE="postgresql://user:pass@host/factory_core"
export NEON_CONN_STR_WORDIS_BOND="postgresql://user:pass@host/wordis_bond"
export NEON_CONN_STR_CYPHER_HEALING="postgresql://user:pass@host/cypher_healing"
export NEON_CONN_STR_PRIME_SELF="postgresql://user:pass@host/prime_self"
export NEON_CONN_STR_IJUSTUS="postgresql://user:pass@host/ijustus"
export NEON_CONN_STR_THE_CALLING="postgresql://user:pass@host/the_calling"
export NEON_CONN_STR_NEIGHBOR_AID="postgresql://user:pass@host/neighbor_aid"
```

**Apply factory_core DDL** (run immediately after database creation):

```bash
psql "$NEON_CONN_STR_FACTORY_CORE" -f docs/sql/factory_core_schema.sql
```

(Schema is embedded in [STAGE_6_ONWARDS_PLAN.md](./STAGE_6_ONWARDS_PLAN.md#61-neon-database-provisioning) — save to `docs/sql/factory_core_schema.sql`)

**Verification:**
```bash
psql "$NEON_CONN_STR_FACTORY_CORE" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

Expected tables: `factory_events`, `crm_leads`, `compliance_consents`, etc.

- [ ] All 7 databases created
- [ ] `factory_core` DDL applied
- [ ] All connection strings saved and exported

---

### 6.2 CloudFlare Hyperdrive Setup

**Objective:** Create 7 Hyperdrive instances (1 per database)

**Prerequisites:**
- [ ] All 7 connection strings from Phase 6.1

**Execute:**
```bash
# Ensure credentials are set
export CF_API_TOKEN="..."
export CF_ACCOUNT_ID="..."

# Create all Hyperdrive instances (saves IDs for later)
wrangler hyperdrive create factory-core-db \
  --connection-string "$NEON_CONN_STR_FACTORY_CORE" --json | jq .

wrangler hyperdrive create wordis-bond-db \
  --connection-string "$NEON_CONN_STR_WORDIS_BOND" --json | jq .

wrangler hyperdrive create cypher-healing-db \
  --connection-string "$NEON_CONN_STR_CYPHER_HEALING" --json | jq .

wrangler hyperdrive create prime-self-db \
  --connection-string "$NEON_CONN_STR_PRIME_SELF" --json | jq .

wrangler hyperdrive create ijustus-db \
  --connection-string "$NEON_CONN_STR_IJUSTUS" --json | jq .

wrangler hyperdrive create the-calling-db \
  --connection-string "$NEON_CONN_STR_THE_CALLING" --json | jq .

wrangler hyperdrive create neighbor-aid-db \
  --connection-string "$NEON_CONN_STR_NEIGHBOR_AID" --json | jq .
```

**Save Hyperdrive IDs:**
```bash
# Format: HYPERDRIVE_DATABASE_NAME="id"
export HYPERDRIVE_FACTORY_CORE="..."
export HYPERDRIVE_WORDIS_BOND="..."
export HYPERDRIVE_CYPHER_HEALING="..."
export HYPERDRIVE_PRIME_SELF="..."
export HYPERDRIVE_IJUSTUS="..."
export HYPERDRIVE_THE_CALLING="..."
export HYPERDRIVE_NEIGHBOR_AID="..."
```

**Verification:**
```bash
wrangler hyperdrive list
```

Expected: 7 Hyperdrive instances visible

- [ ] All 7 Hyperdrive instances created
- [ ] All Hyperdrive IDs saved and exported

---

### 6.3 CloudFlare Rate Limiter Setup

**Objective:** Define rate limiter namespace IDs for auth endpoints

**Status:** Pre-assigned (no API call needed)

| App | Namespace ID |
|---|---|
| `wordis-bond` | `1001` |
| `cypher-healing` | `1002` |
| `prime-self` | `1003` |
| `ijustus` | `1004` |
| `the-calling` | `1005` |
| `neighbor-aid` | `1006` |

**Export for later:**
```bash
export RATE_LIMITER_WORDIS_BOND="1001"
export RATE_LIMITER_CYPHER_HEALING="1002"
export RATE_LIMITER_PRIME_SELF="1003"
export RATE_LIMITER_IJUSTUS="1004"
export RATE_LIMITER_THE_CALLING="1005"
export RATE_LIMITER_NEIGHBOR_AID="1006"
```

- [ ] Rate limiter namespace IDs assigned and exported

---

### 6.4 GitHub Repository Creation

**Objective:** Create 6 empty app repositories under `adrper79-dot` organization

**Prerequisites:**
- [ ] GitHub PAT with `repo` scope

**Execute:**
```bash
export GITHUB_TOKEN="ghp_..."

for app in wordis-bond cypher-healing prime-self ijustus the-calling neighbor-aid; do
  gh repo create adrper79-dot/$app \
    --private \
    --description "Factory App: $app"
done
```

**Verification:**
```bash
gh repo list adrper79-dot
```

Expected: 6 repositories visible

- [ ] `adrper79-dot/wordis-bond` created
- [ ] `adrper79-dot/cypher-healing` created
- [ ] `adrper79-dot/prime-self` created
- [ ] `adrper79-dot/ijustus` created
- [ ] `adrper79-dot/the-calling` created
- [ ] `adrper79-dot/neighbor-aid` created

---

### 6.5 Sentry & PostHog Project Creation

**Objective:** Create error tracking (Sentry) and analytics (PostHog) projects for each app

#### Sentry

**Via dashboard:**
1. Navigate to https://sentry.io/organizations/
2. Create new project for each app:
   - `wordis-bond-worker`
   - `cypher-healing-worker`
   - `prime-self-worker`
   - `ijustus-worker`
   - `the-calling-worker`
   - `neighbor-aid-worker`
3. Copy DSN (Data Source Name) for each

**Save DSNs:**
```bash
export SENTRY_DSN_WORDIS_BOND="https://...@sentry.io/..."
export SENTRY_DSN_CYPHER_HEALING="https://...@sentry.io/..."
export SENTRY_DSN_PRIME_SELF="https://...@sentry.io/..."
export SENTRY_DSN_IJUSTUS="https://...@sentry.io/..."
export SENTRY_DSN_THE_CALLING="https://...@sentry.io/..."
export SENTRY_DSN_NEIGHBOR_AID="https://...@sentry.io/..."
```

#### PostHog

**Via dashboard:**
1. Navigate to https://app.posthog.com/
2. Create new project for each app:
   - `Wordis Bond`
   - `Cypher of Healing`
   - `Prime Self Engine`
   - `iJustus`
   - `The Calling`
   - `NeighborAid`
3. Copy API key for each

**Save API keys:**
```bash
export POSTHOG_KEY_WORDIS_BOND="phc_..."
export POSTHOG_KEY_CYPHER_HEALING="phc_..."
export POSTHOG_KEY_PRIME_SELF="phc_..."
export POSTHOG_KEY_IJUSTUS="phc_..."
export POSTHOG_KEY_THE_CALLING="phc_..."
export POSTHOG_KEY_NEIGHBOR_AID="phc_..."
```

- [ ] All 6 Sentry projects created and DSNs saved
- [ ] All 6 PostHog projects created and API keys saved

---

### 6.6 Wire Secrets via setup-all-apps.mjs

**Objective:** Set all GitHub Actions secrets and Wrangler secrets (centralized from Factory Core)

**Prerequisites:**
- [ ] Phase 6.1–6.5 complete
- [ ] All credentials exported as environment variables
- [ ] `setup-all-apps.mjs` script exists at `packages/deploy/scripts/setup-all-apps.mjs`

**Execute:**
```bash
# Verify all credentials are set
echo "GITHUB_TOKEN: $GITHUB_TOKEN"
echo "CF_API_TOKEN: $CF_API_TOKEN"
echo "NEON_CONN_STR_FACTORY_CORE: $NEON_CONN_STR_FACTORY_CORE"
echo "SENTRY_DSN_WORDIS_BOND: $SENTRY_DSN_WORDIS_BOND"
echo "POSTHOG_KEY_WORDIS_BOND: $POSTHOG_KEY_WORDIS_BOND"

# Run the setup script
node packages/deploy/scripts/setup-all-apps.mjs
```

**What this script does:**
1. Sets GitHub Actions secrets on all 6 app repos:
   - `GITHUB_TOKEN` (for `npm ci` to pull Factory Core packages)
   - `CF_API_TOKEN` (for `wrangler deploy`)
   - `CF_ACCOUNT_ID`
   - `NEON_PREVIEW_URL` (for migration CI testing)

2. Sets Wrangler secrets on all 6 Workers:
   - `JWT_SECRET`
   - `SENTRY_DSN` (app-specific)
   - `POSTHOG_KEY` (app-specific)

**Verification:**
```bash
# Check GitHub secrets on one app
gh secret list --repo adrper79-dot/wordis-bond

# Check Wrangler secrets (local test)
wrangler secret list --name wordis-bond
```

- [ ] All GitHub secrets set on all 6 app repos
- [ ] All Wrangler secrets set on all 6 Workers

---

## Phase 6 Completion Checklist

**Phase 6 is complete when ALL of the following are true:**

- [ ] 7 Neon databases exist with connection strings recorded
- [ ] `factory_core` DDL applied (factory_events, crm_leads, compliance_consents, etc. tables exist)
- [ ] 7 Hyperdrive instances created and IDs recorded
- [ ] 6 GitHub repositories created under `adrper79-dot` organization
- [ ] 6 Sentry projects created and DSNs saved
- [ ] 6 PostHog projects created and API keys saved
- [ ] `setup-all-apps.mjs` executed successfully (GitHub secrets set on all 6 repos, Wrangler secrets set)
- [ ] CI/CD workflows triggered successfully on all 6 app repos (verify green checkmarks in GitHub)

**Sign-off:**
- Infrastructure Engineer: _________________ Date: _______
- Tech Lead: _________________ Date: _______

---

## Rollback Plan

If Phase 6 fails and needs to be rolled back:

1. **Delete GitHub repositories:**
   ```bash
   for app in wordis-bond cypher-healing prime-self ijustus the-calling neighbor-aid; do
     gh repo delete adrper79-dot/$app --yes
   done
   ```

2. **Delete Hyperdrive instances:**
   ```bash
   wrangler hyperdrive delete factory-core-db
   wrangler hyperdrive delete wordis-bond-db
   # ... etc
   ```

3. **Delete Neon databases:**
   - Via https://console.neon.tech or:
   ```bash
   neonctl databases delete --project-id $PROJECT_ID --name factory_core
   # ... etc
   ```

4. **Delete Sentry projects:**
   - Via https://sentry.io/organizations/

5. **Delete PostHog projects:**
   - Via https://app.posthog.com/

---

## Next Steps (After Phase 6)

Once Phase 6 is complete:

1. **Phase 7: App Scaffolding** (6 agents in parallel)
   ```bash
   npm run phase-7:scaffold -- {app-name} \
     --hyperdrive-id $HYPERDRIVE_ID \
     --rate-limiter-id $RATE_LIMITER_ID
   ```

2. **Phase 8: Admin Dashboard** (parallel with Phase 7)
   - Scaffold Factory Admin Worker at `admin.thefactory.dev`

3. **Phase 9: Documentation** (parallel with Phases 7–8)
   - Deploy Mintlify docs at `docs.thefactory.dev`

4. **Phase 10: Operations** (after Phases 7–9)
   - Configure Renovate on all 6 app repos
   - Enable Sentry error tracking
   - Enable PostHog analytics

---

## Reference Links

- **Neon Console:** https://console.neon.tech
- **CloudFlare Dashboard:** https://dash.cloudflare.com
- **Sentry Dashboard:** https://sentry.io/organizations/
- **PostHog Dashboard:** https://app.posthog.com/
- **GitHub Organizations:** https://github.com/organizations/adrper79-dot/repositories
- **Factory Core Repo:** https://github.com/adrper79-dot/Factory

---

## Notes

[Record any issues, delays, or notes here]
