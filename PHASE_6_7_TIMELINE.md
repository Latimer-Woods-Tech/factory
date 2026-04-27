# Factory Core: Phase 6-7 Execution Timeline

**Current Status:** All 19 packages published (v0.2.0), documentation complete, automation scripts ready  
**Blocker:** Phase 6 infrastructure provisioning (hard gate before Phase 7)  
**Team:** Infrastructure Engineer (Phase 6) + 6 App Agents (Phase 7, parallel)  
**Total Duration:** 3–4 days (Phase 6: 4–6 hours, Phase 7: 2–3 days parallel)

---

## Phase 6: Infrastructure Setup (4–6 hours)

**Owner:** Infrastructure Engineer  
**Blocker:** YES — blocks Phases 7, 8, 9, 10, 11  
**Prerequisites:** GitHub PAT, CloudFlare credentials, Neon account, Sentry account, PostHog account

### Timeline

| Step | Task | Duration | Command/Link |
|---|---|---|---|
| 1 | Validate credentials | 15 min | `node scripts/phase-6-orchestrator.mjs --dry-run` |
| 2 | Provision 7 Neon databases | 30 min | Via Neon console or `neonctl` |
| 3 | Apply factory_core DDL | 15 min | `psql $NEON_CONN_STR_FACTORY_CORE < docs/sql/factory_core_schema.sql` |
| 4 | Create 7 Hyperdrive instances | 30 min | `wrangler hyperdrive create ...` (7x) |
| 5 | Create 6 GitHub repositories | 10 min | `gh repo create adrper79-dot/{app} ...` (6x) |
| 6 | Create 6 Sentry projects | 20 min | Via Sentry dashboard |
| 7 | Create 6 PostHog projects | 20 min | Via PostHog dashboard |
| 8 | Wire all secrets | 15 min | `node packages/deploy/scripts/setup-all-apps.mjs` |
| **TOTAL** | | **3–4 hours** | |

### Execution Checklist

See [PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md) for complete checklist, credential validation, and rollback procedures.

**Key commands to have ready:**
```bash
# Validate all credentials are set
export GITHUB_TOKEN="ghp_..."
export CF_API_TOKEN="..."
export CF_ACCOUNT_ID="..."
export NEON_CONN_STR_FACTORY_CORE="postgresql://..."
# ... etc for all 7 databases, all Sentry DSNs, all PostHog keys

# Watch the orchestrator in dry-run
node scripts/phase-6-orchestrator.mjs --dry-run

# Execute (CAUTION: creates real infrastructure)
node scripts/phase-6-orchestrator.mjs
```

### Phase 6 Completion Gate

✅ **Phase 6 is complete when:**
- [ ] 7 Neon databases exist with `factory_core` DDL applied
- [ ] 7 Hyperdrive instances created
- [ ] 6 GitHub repositories created
- [ ] 6 Sentry + 6 PostHog projects created
- [ ] All GitHub Actions secrets set on all 6 app repos
- [ ] All Wrangler secrets set via `setup-all-apps.mjs`
- [ ] CI workflows passing on all 6 app repos

---

## Phase 7: App Scaffolding (2–3 days, parallel)

**Owners:** 6 App Agents (one agent per app, assigned by priority)  
**Prerequisite:** Phase 6 complete ✅  
**Parallelization:** All 6 apps scaffold simultaneously (2–3 day wall-clock time)

### Agent Assignments

| Agent | App | Priority | Packages | Notes |
|---|---|---|---|---|
| App-Agent-A | `wordis-bond` | 1 — validates pipeline | compliance, crm | First to complete; validates full flow |
| App-Agent-B | `cypher-healing` | 2 | telephony, llm, copy | Higher complexity; AI-powered |
| App-Agent-C | `prime-self` | 3 | telephony, llm, copy | Subscription management |
| App-Agent-D | `ijustus` | 4 | telephony, llm, compliance, crm | Most complex; multi-package |
| App-Agent-E | `the-calling` | 5 — simplest | none (only standard) | Low risk; good template |
| App-Agent-F | `neighbor-aid` | 6 | geo-enabled | Geospatial queries |

### Per-Agent Workflow

Each agent follows this workflow in parallel (approx 8–12 hours per app):

#### Step 1: Clone Factory Core & Set Up Credentials

```bash
# All agents start from Factory Core monorepo
git clone https://github.com/adrper79-dot/Factory.git factory-core
cd factory-core

# Export credentials (same for all agents)
export GITHUB_TOKEN="ghp_..."
export CF_API_TOKEN="..."
export NEON_CONN_STR_WORDIS_BOND="postgresql://..."  # app-specific
export HYPERDRIVE_ID_WORDIS_BOND="..."               # from Phase 6
export RATE_LIMITER_ID_WORDIS_BOND="1001"           # from Phase 6
```

#### Step 2: Run App Scaffolding

```bash
npm run phase-7:scaffold -- {app-name} \
  --hyperdrive-id $HYPERDRIVE_ID_{APP} \
  --rate-limiter-id $RATE_LIMITER_ID_{APP}
```

**What this script does:**
- Calls `scaffold.mjs` to generate complete app structure
- Installs all standard + app-specific packages
- Writes canonical Drizzle schema
- Generates and applies migrations
- Applies RLS policies (if multi-tenant)
- Commits scaffolding to app repo

#### Step 3: Local Testing

```bash
cd {app-name}

# Copy .dev.vars.example → .dev.vars and populate with credentials
cp .dev.vars.example .dev.vars
# Edit: set NEON_URL, JWT_SECRET, SENTRY_DSN, POSTHOG_KEY

# Install dependencies
npm ci

# Run type checking + linting
npm run typecheck
npm run lint

# Run tests
npm run test

# Start local dev server
npm run dev

# Test /health endpoint
curl http://localhost:8787/health
```

#### Step 4: Push & Let CI Deploy to Staging

```bash
# All scaffolding files already committed by script
# Just push to trigger CI
git push origin main

# Watch GitHub Actions
gh run watch
```

**CI does automatically:**
- npm ci (pulls all @adrper79-dot/* packages)
- npm run typecheck
- npm run lint
- npm run test
- Dry-run migrations on Neon preview branch
- wrangler deploy → staging environment
- Post deployment health check

#### Step 5: Smoke Test in Staging

```bash
# Test staging Worker URL
curl https://{app-name}-staging.workers.dev/health

# Verify Sentry integration
# Verify PostHog tracking
# Check database connection via /health endpoint
```

#### Step 6: Documentation & handoff

- [ ] README.md updated with app description
- [ ] Schema documentation (Drizzle schema comments)
- [ ] Migration guide documented
- [ ] Known issues/TODOs recorded
- [ ] Handoff notes for Phase 8 agents (if any special setup needed)

### Phase 7 Completion Gate

✅ **Each app is complete when:**
- [ ] Scaffolding complete (all packages installed, schema migrated)
- [ ] Typecheck & lint passing
- [ ] Tests passing (>80% coverage)
- [ ] Local dev runs successfully
- [ ] Staging deployment successful
- [ ] /health endpoint responding correctly
- [ ] Sentry & PostHog logging events
- [ ] All 3–5 day timeline met

---

## Parallel Phases: 8 & 9

While Phase 7 agents scaffold apps, other teams work on:

### Phase 8: Admin Dashboard (~2 days, parallel with Phase 7)

**Owner:** Admin Dashboard Agent  
**Deliverable:** `admin.thefactory.dev` Worker with CRM, analytics, compliance dashboards

- Schema for admin features: CRM leads, analytics reporting, compliance logs
- API routes for dashboard queries
- Web UI (or GraphQL API consumed by separate frontend)

### Phase 9: Documentation (~3 days, parallel with Phases 7–8)

**Owner:** Documentation Agent  
**Deliverable:** Mintlify docs at `docs.thefactory.dev`

- API reference docs (auto-generated from JSDoc)
- Architecture guides
- Runbook templates
- Deployment procedures
- Troubleshooting guides

---

## Post-Scaffolding: Phase 10 (Operations)

After all apps are deployed to staging (end of Phase 7):

| Task | Duration | Owner |
|---|---|---|
| Configure Renovate on all 6 app repos | 30 min | DevOps Engineer |
| Enable Sentry error alerting | 30 min | DevOps Engineer |
| Enable PostHog data retention policies | 30 min | Analytics Engineer |
| Set up monitoring dashboards | 1 day | DevOps Engineer |
| Production deployment checklist | 4 hours | Tech Lead + DevOps |

---

## Success Criteria

**After all phases complete:**

- 6 Factory apps deployed to staging (Workers)
- All apps connected to shared `factory_core` Postgres database
- All apps sending analytics to PostHog via `factory_events` table
- All apps error tracking via Sentry
- All apps using Factory Core packages (pinned exactly)
- Factory Admin Dashboard operational
- Mintlify docs deployed and searchable
- Renovate automatically opening PRs on package updates

---

## Contingency Plan

If Phase 6 infrastructure provisioning fails:

1. **Check PHASE_6_CHECKLIST.md for rollback procedures**
2. **Clean up partially created resources**
3. **Re-run from step that failed** (idempotent where possible)
4. **Escalate if blocked by external service (Neon, CloudFlare, etc.)**

If Phase 7 scaffolding fails on a single app:

1. **Fix the app-specific issue** (usually schema, RLS, or package conflict)
2. **Re-run app scaffolding script**
3. **Continue in parallel** (other app agents not blocked)

---

## Ready to Start?

### For Infrastructure Engineer (Phase 6):

1. Read [PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md)
2. Gather all credentials (GitHub, CloudFlare, Neon, Sentry, PostHog)
3. Run orchestrator in dry-run: `node scripts/phase-6-orchestrator.mjs --dry-run`
4. Execute: `node scripts/phase-6-orchestrator.mjs`
5. Verify all checks in [PHASE_6_CHECKLIST.md](./PHASE_6_CHECKLIST.md)

### For App Agents (Phase 7):

1. Clone Factory Core: `git clone https://github.com/adrper79-dot/Factory.git`
2. Wait for Phase 6 to complete (all infrastructure provisioning done)
3. Read this timeline
4. Start app scaffolding: `npm run phase-7:scaffold -- {app-name} --hyperdrive-id {id} --rate-limiter-id {id}`
5. Follow per-agent workflow above

---

## Estimated Wall-Clock Time

```
Phase 6 (Infrastructure)      ▓▓▓░░░░░   4–6 hours      Day 1
  Phase 7–9 (parallel)        ▓▓▓▓▓▓░   2–3 days       Days 2–3
Phase 10 (Operations)         ▓░░░░░░░   1 day         Day 4

Total: 3–4 days of work (compressed wall-clock due to parallelization)
```

---

**Status:** Ready to execute  
**Last Updated:** [Record date when execution begins]  
**Next Signal:** Phase 6 infrastructure provisioning starts
