# Phase 6: Quick Start (Infrastructure Setup)

**TL;DR:** Run the orchestrator to provision all Phase 6 infrastructure in one go.

---

## 1. Gather Credentials (15-30 minutes)

**Full detailed guide:** See [docs/runbooks/CREDENTIALS_SETUP.md](./docs/runbooks/CREDENTIALS_SETUP.md)

### Quick Checklist
- [ ] GitHub PAT (`ghp_...`) with `repo`, `workflow`, `admin:org_hook` scopes
- [ ] CloudFlare API Token with `Workers`, `Hyperdrive`, `Rate Limiting` permissions
- [ ] CloudFlare Account ID (from dashboard)
- [ ] Neon API Key (optional but recommended)
- [ ] Sentry Auth Token (optional for error tracking)
- [ ] PostHog API Key (optional for analytics)

### Load Credentials

```bash
# Create credentials file
cat > .env.phase-6 << 'EOF'
export GITHUB_TOKEN="ghp_YOUR_TOKEN"
export CF_API_TOKEN="YOUR_TOKEN"
export CF_ACCOUNT_ID="YOUR_ACCOUNT_ID"
export NEON_API_KEY="YOUR_KEY"  # optional
export SENTRY_AUTH_TOKEN="YOUR_TOKEN"  # optional
export POSTHOG_API_KEY="YOUR_KEY"  # optional
EOF

# Source before running
source .env.phase-6
```

---

## 2. Test Credentials (5 minutes)

```bash
# Run orchestrator in DRY-RUN mode first
cd path/to/Factory

node scripts/phase-6-orchestrator.mjs --dry-run
```

**Expected output:**
```
============================================================
🏗️  FACTORY PHASE 6: INFRASTRUCTURE SETUP
============================================================

🏜️  DRY RUN MODE — No changes will be made

🔐 Validating credentials...

✅ GitHub token valid
✅ CloudFlare credentials valid
✅ All credentials validated
```

If you see errors, fix the credentials and retry.

---

## 3. Execute Phase 6 (1–2 hours)

```bash
# EXECUTE (creates real infrastructure)
node scripts/phase-6-orchestrator.mjs
```

The script will:
1. ✅ Create 7 Neon databases (or skip if manual)
2. ✅ Apply `factory_core` DDL
3. ✅ Create 7 Hyperdrive instances
4. ✅ Create 6 GitHub repositories
5. ✅ Create 6 Sentry + 6 PostHog projects (or prompt for manual creation)
6. ✅ Wire all secrets to GitHub Actions + Wrangler

**Watch the output for:**
- Green checkmarks (✅) = success
- Yellow warnings (⚠️) = needs manual action
- Red errors (❌) = stop and fix

---

## 4. Verify Phase 6 Complete (15 minutes)

```bash
# Verify GitHub repos
gh repo list adrper79-dot

# Verify Neon databases
neonctl databases list --project-id $PROJECT_ID

# Verify Hyperdrive instances
wrangler hyperdrive list

# Verify GitHub secrets on one app
gh secret list --repo adrper79-dot/wordis-bond

# Verify CI is green
gh run list --repo adrper79-dot/wordis-bond --limit 1
```

**All checks pass?** ✅ Phase 6 is complete!

---

## 5. Next: Phase 7 App Scaffolding

Once Phase 6 is done, assign the 6 app agents:

```bash
# Agent A scaffolds wordis-bond
npm run phase-7:scaffold -- wordis-bond \
  --hyperdrive-id $HYPERDRIVE_WORDIS_BOND \
  --rate-limiter-id 1001

# Agent B scaffolds cypher-healing
npm run phase-7:scaffold -- cypher-healing \
  --hyperdrive-id $HYPERDRIVE_CYPHER_HEALING \
  --rate-limiter-id 1002

# ... etc
```

See [PHASE_6_7_TIMELINE.md](./PHASE_6_7_TIMELINE.md) for full parallel workflow.

---

## Troubleshooting

### Credential validation fails

**Check:**
```bash
# GitHub
echo $GITHUB_TOKEN
gh auth status

# CloudFlare
echo $CF_API_TOKEN $CF_ACCOUNT_ID
wrangler whoami

# Neon
echo $NEON_API_KEY
# or
psql $NEON_CONN_STR_FACTORY_CORE -c "SELECT 1"
```

### "wrangler: command not found"

```bash
npm install -g wrangler
```

### "neon not found" (Neon automation)

```bash
npm install -g neonctl
# or use manual Neon dashboard provisioning
```

### Orchestrator exits with error during execution

**Check the error message**, then:
1. Fix the underlying issue
2. Re-run: `node scripts/phase-6-orchestrator.mjs`
3. The script is idempotent where possible (e.g., skips repos that exist)

### If something breaks mid-execution

See [PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md#rollback-plan) for rollback procedures.

---

## What Gets Created

By the end of Phase 6:

```
Factory Core (this repo)
├── 19 packages published (v0.2.0)
└── 6 app repositories created:
    ├── adrper79-dot/wordis-bond
    ├── adrper79-dot/cypher-healing
    ├── adrper79-dot/prime-self
    ├── adrper79-dot/ijustus
    ├── adrper79-dot/the-calling
    └── adrper79-dot/neighbor-aid

Neon Project
├── 7 databases:
│   ├── factory_core (with DDL: factory_events, crm_leads, etc.)
│   ├── wordis_bond
│   ├── cypher_healing
│   ├── prime_self
│   ├── ijustus
│   ├── the_calling
│   └── neighbor_aid
└── 7 connection strings + 7 Hyperdrive IDs

CloudFlare Workers
├── 7 Hyperdrive instances
└── 6 Rate Limiter namespaces (pre-assigned IDs: 1001–1006)

GitHub Actions Secrets (on all 6 app repos)
├── GITHUB_TOKEN (to pull @latimer-woods-tech/*)
├── CF_API_TOKEN
├── CF_ACCOUNT_ID
└── NEON_PREVIEW_URL

Wrangler Secrets (on all 6 Workers)
├── JWT_SECRET
├── SENTRY_DSN (app-specific)
└── POSTHOG_KEY (app-specific)

Monitoring & Analytics
├── 6 Sentry projects (error tracking)
└── 6 PostHog projects (analytics)
```

---

## Ready?

```bash
node scripts/phase-6-orchestrator.mjs --dry-run

# Then, if all looks good:
node scripts/phase-6-orchestrator.mjs
```

**Status after Phase 6:** Infrastructure ready for Phase 7 parallel scaffolding.
