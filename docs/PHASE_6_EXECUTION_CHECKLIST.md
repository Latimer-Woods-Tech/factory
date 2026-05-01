# Phase 6: Infrastructure Setup — Execution Checklist

**Status:** Ready to execute  
**Duration:** 4–6 hours  
**Prerequisite:** All 19 packages published at v0.2.0 ✅  
**Gate:** Must complete before Phase 7 (App Scaffolding)

---

## Pre-Flight Checklist

Before starting, verify you have:

- [ ] **GitHub Personal Access Token** with `repo` scope (or fine-grained: `secrets:write`, `actions:write` on app repos)
  - Test: `gh auth status` shows authenticated user
  
- [ ] **Cloudflare API Token** with "Edit Cloudflare Workers" permission
  - Test: `wrangler whoami` shows account info
  
- [ ] **Cloudflare Account ID** (find in Cloudflare Dashboard → Overview → Account ID)
  - Test: `wrangler hyperdrive list` shows existing instances
  
- [ ] **Neon account** (https://console.neon.tech) with project ready
  - Test: Can create databases via Neon console or `neonctl`

- [ ] **Sentry account** (https://sentry.io) with organization ready

- [ ] **PostHog account** (https://posthog.com) with organization ready

- [ ] **Environment variables set** in your shell:
  ```bash
  export GITHUB_TOKEN="ghp_..."
  export NODE_AUTH_TOKEN="$GITHUB_TOKEN"
  export CF_API_TOKEN="..."
  export CF_ACCOUNT_ID="..."
  ```

---

## Step 1: Neon Database Provisioning (30 min)

### 1.1 Create 7 Databases

Via Neon Console (https://console.neon.tech):

| Database | Purpose | Multi-Tenant |
|----------|---------|--------------|
| `factory_core` | CRM leads, compliance, factory_events | No |
| `prime_self` | Practitioners, readings, subscriptions | Yes |
| `ijustus` | Organizations, simulators, scores | Yes |
| `cypher_healing` | Clients, bookings, courses, store | Yes |
| `the_calling` | Games, players, questions, leaderboards | No |
| `wordis_bond` | Accounts, contacts, campaigns, consents | Yes |
| `neighbor_aid` | Users, requests, offers, geospatial | Yes |

**Option A: Via Neon Console (Easiest)**
1. Go to https://console.neon.tech/projects
2. Select your project
3. Click "Databases" → "New database"
4. Create each database one by one
5. Copy connection string for each

**Option B: Via neonctl CLI (Fastest)**
```bash
# Install: npm install -g neonctl
neonctl auth

NEON_PROJECT_ID=$(neonctl projects list --json | jq -r '.[0].id')

for db in factory_core prime_self ijustus cypher_healing the_calling wordis_bond neighbor_aid; do
  neonctl databases create --project-id $NEON_PROJECT_ID --name $db
done

# Collect connection strings
neonctl projects list --json | jq '.[] | .connection_uri'
```

### 1.2 Record All Connection Strings

Create a file `PHASE_6_SECRETS.env` (⚠️ ADD TO .gitignore, NEVER COMMIT):

```bash
# Phase 6 Infrastructure Setup — KEEP PRIVATE
# DO NOT COMMIT TO GIT

NEON_PROJECT_ID=abc123...

FACTORY_CORE_CONN_STR=postgresql://user:pass@host/factory_core?sslmode=require
PRIME_SELF_CONN_STR=postgresql://user:pass@host/prime_self?sslmode=require
IJUSTUS_CONN_STR=postgresql://user:pass@host/ijustus?sslmode=require
CYPHER_HEALING_CONN_STR=postgresql://user:pass@host/cypher_healing?sslmode=require
THE_CALLING_CONN_STR=postgresql://user:pass@host/the_calling?sslmode=require
WORDIS_BOND_CONN_STR=postgresql://user:pass@host/wordis_bond?sslmode=require
NEIGHBOR_AID_CONN_STR=postgresql://user:pass@host/neighbor_aid?sslmode=require
```

### 1.3 Load Into Environment

```bash
source PHASE_6_SECRETS.env
```

### 1.4 Create factory_core Schema

```bash
psql "$FACTORY_CORE_CONN_STR" << 'EOF'
-- factory_events: first-party analytics
CREATE TABLE factory_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      TEXT NOT NULL,
  user_id     TEXT,
  event       TEXT NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_factory_events_app_id      ON factory_events (app_id);
CREATE INDEX idx_factory_events_user_id     ON factory_events (user_id);
CREATE INDEX idx_factory_events_created_at  ON factory_events (created_at DESC);

-- CRM leads (@factory/crm)
CREATE TABLE crm_leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  app_id       TEXT NOT NULL,
  source       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'lead',
  mrr          INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  UNIQUE (user_id, app_id)
);
CREATE INDEX idx_crm_leads_app_id  ON crm_leads (app_id);
CREATE INDEX idx_crm_leads_status  ON crm_leads (status);

-- Compliance consents (@factory/compliance)
CREATE TABLE compliance_consents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  ip_address   TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_compliance_consents_user_id ON compliance_consents (user_id);

CREATE TABLE compliance_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   TEXT NOT NULL,
  call_type    TEXT NOT NULL,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_compliance_contacts_recent
  ON compliance_contacts (contact_id, contacted_at DESC);

CREATE TABLE tcpa_suppression (
  phone      TEXT PRIMARY KEY,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
EOF

echo "✅ factory_core schema created"
```

---

## Step 2: Cloudflare Hyperdrive Setup (20 min)

### 2.1 Create 7 Hyperdrive Instances

```bash
#!/bin/bash
set -e

declare -A HYPERDRIVES

for name in factory-core prime-self ijustus cypher-healing the-calling wordis-bond neighbor-aid; do
  # Get connection string from env var (e.g., FACTORY_CORE_CONN_STR)
  key="${name^^}_CONN_STR"
  conn_str="${!key}"
  
  if [ -z "$conn_str" ]; then
    echo "❌ Missing $key"
    exit 1
  fi
  
  # Create Hyperdrive instance
  echo "Creating Hyperdrive: $name..."
  hd_id=$(wrangler hyperdrive create "${name}-db" \
    --connection-string "$conn_str" \
    --json | jq -r '.id')
  
  HYPERDRIVES[$name]=$hd_id
  echo "✅ $name: $hd_id"
  sleep 2  # Rate limit
done

# Export for next steps
cat > PHASE_6_HYPERDRIVES.env << 'ENVEOF'
HYPERDRIVE_FACTORY_CORE=${HYPERDRIVES[factory-core]}
HYPERDRIVE_PRIME_SELF=${HYPERDRIVES[prime-self]}
HYPERDRIVE_IJUSTUS=${HYPERDRIVES[ijustus]}
HYPERDRIVE_CYPHER_HEALING=${HYPERDRIVES[cypher-healing]}
HYPERDRIVE_THE_CALLING=${HYPERDRIVES[the-calling]}
HYPERDRIVE_WORDIS_BOND=${HYPERDRIVES[wordis-bond]}
HYPERDRIVE_NEIGHBOR_AID=${HYPERDRIVES[neighbor-aid]}
ENVEOF

echo "✅ All Hyperdrive instances created"
echo "📝 Saved to PHASE_6_HYPERDRIVES.env"
```

### 2.2 Verify Hyperdrive Access

```bash
# Check all instances exist
wrangler hyperdrive list

# Output should show 7 instances with IDs
```

---

## Step 3: Rate Limiter Namespace IDs (5 min)

These are user-defined integers for the `wrangler.jsonc` rate_limiters section.

Create `PHASE_6_RATE_LIMITERS.env`:

```bash
# Rate limiter namespace IDs (user-assigned, CF doesn't need creation)
RATE_LIMITER_WORDIS_BOND=1001
RATE_LIMITER_CYPHER_HEALING=1002
RATE_LIMITER_PRIME_SELF=1003
RATE_LIMITER_IJUSTUS=1004
RATE_LIMITER_THE_CALLING=1005
RATE_LIMITER_NEIGHBOR_AID=1006
```

---

## Step 4: Create GitHub Repositories (5 min)

```bash
#!/bin/bash
set -e

for app in wordis-bond cypher-healing prime-self ijustus the-calling neighbor-aid; do
  echo "Creating repo: Latimer-Woods-Tech/$app..."
  gh repo create Latimer-Woods-Tech/$app \
    --private \
    --description "Factory App: $app" \
    --add-readme \
    --source=. 2>/dev/null || echo "  (already exists)"
  sleep 1
done

echo "✅ All app repos created"
```

---

## Step 5: Create Sentry Projects (15 min)

### 5.1 Via Sentry Dashboard

1. Go to https://sentry.io/organizations/{your-org}/projects/
2. Click "Create Project"
3. Select platform: **"Node.js"** (closest to Cloudflare Workers)
4. Name: `{app-name}-worker` (e.g., `wordis-bond-worker`)
5. Copy the **DSN** (format: `https://key@host/project_id`)
6. Repeat 6 times (one per app)

### 5.2 Record All DSNs

```bash
cat > PHASE_6_SENTRY.env << 'EOF'
SENTRY_DSN_WORDIS_BOND=https://key@host/12345
SENTRY_DSN_CYPHER_HEALING=https://key@host/12346
SENTRY_DSN_PRIME_SELF=https://key@host/12347
SENTRY_DSN_IJUSTUS=https://key@host/12348
SENTRY_DSN_THE_CALLING=https://key@host/12349
SENTRY_DSN_NEIGHBOR_AID=https://key@host/12350
EOF
```

---

## Step 6: Create PostHog Projects (15 min)

### 6.1 Via PostHog Dashboard

1. Go to https://app.posthog.com/
2. Click "New project"
3. Name: `{app-name}` (e.g., `Wordis Bond`)
4. Copy the **API Key** (format: `phc_xxx...`)
5. Repeat 6 times

### 6.2 Record All Keys

```bash
cat > PHASE_6_POSTHOG.env << 'EOF'
POSTHOG_KEY_WORDIS_BOND=phc_abc123...
POSTHOG_KEY_CYPHER_HEALING=phc_def456...
POSTHOG_KEY_PRIME_SELF=phc_ghi789...
POSTHOG_KEY_IJUSTUS=phc_jkl012...
POSTHOG_KEY_THE_CALLING=phc_mno345...
POSTHOG_KEY_NEIGHBOR_AID=phc_pqr678...
EOF
```

---

## Step 7: Run Centralized Setup Script (10 min)

### 7.1 Consolidate All Secrets

```bash
# Combine all Phase 6 env files
cat PHASE_6_SECRETS.env PHASE_6_HYPERDRIVES.env PHASE_6_RATE_LIMITERS.env \
    PHASE_6_SENTRY.env PHASE_6_POSTHOG.env > PHASE_6_ALL.env

source PHASE_6_ALL.env
```

### 7.2 Run setup-all-apps.mjs

```bash
cd /path/to/Factory

node packages/deploy/scripts/setup-all-apps.mjs \
  --wordis-bond-hyperdrive "$HYPERDRIVE_WORDIS_BOND" \
  --cypher-healing-hyperdrive "$HYPERDRIVE_CYPHER_HEALING" \
  --prime-self-hyperdrive "$HYPERDRIVE_PRIME_SELF" \
  --ijustus-hyperdrive "$HYPERDRIVE_IJUSTUS" \
  --the-calling-hyperdrive "$HYPERDRIVE_THE_CALLING" \
  --neighbor-aid-hyperdrive "$HYPERDRIVE_NEIGHBOR_AID"
```

This script:
- ✅ Sets all GitHub Secrets on each app repo
- ✅ Sets all Wrangler Secrets on each Worker
- ✅ Enables GitHub Actions workflows

---

## Phase 6 Verification Checklist

After completing all steps, verify:

- [ ] **Neon**: 7 databases exist + factory_core DDL applied
  - Test: `psql "$FACTORY_CORE_CONN_STR" -c "SELECT COUNT(*) FROM factory_events;"`
  
- [ ] **Hyperdrive**: 7 instances created + wrangler sees them
  - Test: `wrangler hyperdrive list` shows 7 entries
  
- [ ] **GitHub Repos**: 6 app repos exist in Latimer-Woods-Tech org
  - Test: `gh repo list Latimer-Woods-Tech` shows 6 apps
  
- [ ] **GitHub Secrets**: All app repos have secrets set
  - Test: `gh secret list --repo Latimer-Woods-Tech/wordis-bond` shows SENTRY_DSN, POSTHOG_KEY, etc.
  
- [ ] **Sentry**: 6 projects exist with DSNs recorded
  
- [ ] **PostHog**: 6 projects exist with API keys recorded

---

## Next Steps After Phase 6

Once Phase 6 is complete:

✅ Environment is ready for 6 parallel agents (Phase 7)  
✅ Each agent scaffolds their app repo and writes their schema  
✅ Phase 8: Factory Admin Dashboard (standalone from Phase 7)  
✅ Phase 9: Mintlify docs + runbooks (parallel with Phases 7–8)  

---

## Cleanup & Safety

### Never Commit These Files

```bash
echo "PHASE_6_SECRETS.env" >> .gitignore
echo "PHASE_6_HYPERDRIVES.env" >> .gitignore
echo "PHASE_6_RATE_LIMITERS.env" >> .gitignore
echo "PHASE_6_SENTRY.env" >> .gitignore
echo "PHASE_6_POSTHOG.env" >> .gitignore
echo "PHASE_6_ALL.env" >> .gitignore
git add .gitignore
git commit -m "chore: protect Phase 6 secret files"
```

### Backup Your Secrets

```bash
# On day 1
cp PHASE_6_ALL.env ~/Factory-Phase-6-Secrets-BACKUP-$(date +%Y%m%d).env
chmod 600 ~/Factory-Phase-6-Secrets-BACKUP-*.env

# Store safely (1Password, LastPass, etc.)
```

---

## Troubleshooting

### "401 Unauthorized" on GitHub

```bash
gh auth logout
gh auth login --web
export GITHUB_TOKEN=$(gh auth token)
export NODE_AUTH_TOKEN=$GITHUB_TOKEN
```

### "Permission denied" on Cloudflare

```bash
wrangler logout
wrangler login
export CF_API_TOKEN=$(wrangler config show | jq -r '.api_token')
```

### "Connection refused" from Hyperdrive

- Verify connection string format: `postgresql://user:pass@host/dbname?sslmode=require`
- Verify database exists in Neon
- Check Hyperdrive was created: `wrangler hyperdrive list`

### "Repository already exists"

Skip the `gh repo create` for that app; it's already set up. Proceed to next app.

---

## Duration

| Step | Time | Total |
|---|---|---|
| 1. Neon databases | 30 min | 30 min |
| 2. Hyperdrive | 20 min | 50 min |
| 3. Rate limiters | 5 min | 55 min |
| 4. GitHub repos | 5 min | 1 hour |
| 5. Sentry projects | 15 min | 1 hour 15 min |
| 6. PostHog projects | 15 min | 1 hour 30 min |
| 7. setup-all-apps.mjs | 10 min | 1 hour 40 min |

**Total: ~1.5–2 hours (actual execution)**  
**With manual dashboard clicks: 3–4 hours**

✅ Phase 6 is now ready to execute!
