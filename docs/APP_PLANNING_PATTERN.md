# Factory App World-Class Planning Pattern

> Template for replicating the xico-city v2 plan to xpelevator, the 6 Factory core apps, and future Factory apps.

## Overview

The **xico-city world-class v2 rewrite** established a proven pattern:

1. **Canonical build plan** (BUILD_PLAN_v2.md) — 13 parts, 12 slices
2. **LLM agent context** (build_context.md) — Full product schema + API standards
3. **Feature registry** (YAML) + schema (JSON Schema) + validator (Ajv)
4. **Orchestrator v2** (orchestrator-v2.mjs) — LLM fallback chain, signed reviews, budget guard
5. **Operational runbooks** — Observability, DR/cost, compliance, orchestrator-contract
6. **CI/CD integration** — Registry validation in `.github/workflows/`
7. **Execution documentation** — Readiness report + synthetic walkthrough

This document describes how to replicate this pattern for:
- **xpelevator** (experiences + elevator pitch)
- **wordis-bond** (word of mouth + bonding)
- **cypher-healing** (encrypted secrets + healing)
- **prime-self** (self-improvement + first-person narratives)
- **ijustus** (legal advocates + justice)
- **the-calling** (vocation matching + purpose)
- **neighbor-aid** (community mutual aid)

---

## Step 1: Understand the App (Product Discovery)

Before writing the plan, gather:

### Product Domain
- **What problem does it solve?** (user pain point)
- **Who are the personas?** (6 minimum: see xico-city template)
- **Key flows?** (signup → publish/buy → review → repeat)
- **Revenue model?** (subscriptions, marketplace, freemium, grant-funded)
- **Compliance surface?** (GDPR, DMCA, TCPA, children's data, PII)

### Technical Constraints
- **Factory stack required?** (Cloudflare Workers, Hono, Neon, Drizzle, Stripe)
- **Existing packages needed?** (from @adrper79-dot/*)
- **Third-party integrations?** (Stripe, Twilio, Anthropic, etc.)
- **Scheduled/async work?** (queues, crons, webhooks)

### Timeline & Scale
- **MVP target?** (launch date)
- **Initial load?** (users, transactions, storage)
- **Growth curve?** (month 1 vs. month 6)

---

## Step 2: Clone & Scaffold the App Repository

```bash
# Clone the repo
git clone https://github.com/Latimer-Woods-Tech/{app-name}
cd {app-name}

# Verify Factory scaffold (should already be present)
ls -la
# Check for: .github/workflows/, package.json, wrangler.jsonc, tsconfig.json

# Create feature branch for the plan
git checkout -b plan/v1-world-class

# Verify branch
git status
```

---

## Step 3: Create the Canonical Build Plan

Create **BUILD_PLAN_v1.md** with 13 parts (adapt xico-city's structure):

```markdown
# BUILD_PLAN_v1 — {app-name}

**Product:** {one-line description}  
**Target launch:** {date}  
**Effort:** {weeks}  
**LLM cost estimate:** ${budget}

## Part 0: TL;DR
- {5 personas}
- {3 key flows}
- {12 slices, S-00 through S-11}
- {timeline}

## Part 1: Product
- Personas (6)
- Key user journeys
- Success metrics

## Part 2: Stack
- Canonical: Workers, Hono v4, Neon, Drizzle, Stripe, Factory packages
- Forbidden: process.env, require(), Buffer, jsonwebtoken, node:fs/path/crypto

## Part 3: Architecture
- Domain tables (8-15 tables grouped by entity)
- State machines
- API standards
- Queues

## Part 4: Observability
- /health, /ready, /metrics
- Sentry alert thresholds
- PostHog funnels
- factory_events ledger

## Part 5: Security & Compliance
- JWT auth (Web Crypto)
- Rate limits (Cloudflare DDoS Protection)
- {Domain-specific compliance: GDPR, DMCA, TCPA, etc.}
- Secret rotation
- PII handling

## Part 6: DR & Cost & Reliability
- RTO: {1 hour}
- RPO: {24 hours}
- Neon PITR: {7 days staging, 30 days prod}
- LLM budget: ${monthly_cap}
- Failure-mode matrix

## Part 7: Build Order
- 12 slices (S-00 through S-11)
- Dependencies between slices
- Parallelization opportunities

## Part 8: Feature Registry Pointer
- Points to registry/features.yaml
- Explains slice numbering

## Part 9: Orchestrator Hardening
- 10 improvements (LLM chain, signed reviews, budget guard, etc.)

## Part 10: Quality Gates
- TypeScript strict
- 90/90/85 coverage
- ESLint --max-warnings 0
- SentryInit gate

## Part 11: Commit & PR & Branch
- Branch naming: plan/v1-world-class
- One commit: "plan(s00): world-class v1 launch"
- PR to main

## Part 12: Open Decisions
- D-001: {decision title}
- D-002: ...
- (5-7 open questions to resolve as you build)

## Part 13: Links
- [build_context.md](#) — LLM agent context
- [registry/features.yaml](#) — Feature registry
- [docs/runbooks/](#) — Operational runbooks
```

**File:** `BUILD_PLAN_v1.md` (~800 lines)

---

## Step 4: Create the LLM Agent Context

Create **build_context.md** with:

1. **Stack summary table** (packages, versions, known limitations)
2. **Canonical schema** (all tables with types, constraints, indexes)
3. **State machines** (entity lifecycle diagrams)
4. **API standards** (request/response envelope, error codes, rate-limit headers)
5. **Queue schema** (queue names, message types, DLQ strategy)
6. **Security summary** (JWT scopes, webhook signing, PII handling)
7. **Observability summary** (events to log, alerts, dashboards)
8. **Environment variables** (required, optional, defaults)

**File:** `build_context.md` (~300 lines)

---

## Step 5: Create the Feature Registry

### 5a. Feature Registry (YAML)

Create **registry/features.yaml**:

```yaml
version: 2
generated_by: {app-team}
last_updated: {date}

slices:
  - id: S-00
    name: Foundations
    goal: "/health 200, Sentry firing, JWT login, Drizzle schema, CI deploys"
    gate: "curl /health → 200"
  - id: S-01
    name: {slice 1 name}
    goal: "..."
    gate: "..."
  # ... S-02 through S-11

features:
  - id: F-001
    slice: S-00
    name: Health and ready endpoints
    status: PLANNED
    dependencies: []
    acceptance_criteria:
      - "GET /health returns 200"
      - "GET /ready returns 200 when all probes pass"
    # ... etc
```

**File:** `registry/features.yaml` (~300 lines for 9-12 seed features)

### 5b. Registry Schema

Create **registry/schema.json** (copy from xico-city, no changes needed):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["version", "generated_by", "last_updated", "slices", "features"],
  "properties": {
    "version": {"type": "number"},
    "features": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "slice", "name", "status"],
        "properties": {
          "id": {"type": "string", "pattern": "^F-\\d{3,4}$"},
          "slice": {"type": "string", "pattern": "^S-\\d{2}$"},
          "status": {"enum": ["PLANNED", "BRIEFED", "IN_PROGRESS", "IN_REVIEW", "COMPLETE", "BLOCKED"]}
        }
      }
    }
  }
}
```

**File:** `registry/schema.json` (identical to xico-city)

### 5c. Registry Validator

Create **scripts/registry-validate.mjs** (copy from xico-city, no changes needed — it's app-agnostic):

**File:** `scripts/registry-validate.mjs` (identical to xico-city)

---

## Step 6: Create the Orchestrator v2

Create **scripts/orchestrator-v2.mjs** (copy from xico-city, no changes needed):

**File:** `scripts/orchestrator-v2.mjs` (identical to xico-city)

---

## Step 7: Create the Forbidden APIs Checker

Create **scripts/check-forbidden-apis.mjs** (copy from xico-city, no changes needed):

**File:** `scripts/check-forbidden-apis.mjs` (identical to xico-city)

---

## Step 8: Create the Operational Runbooks

Create **docs/runbooks/{observability,dr-and-cost,compliance,orchestrator-contract}.md**:

- **observability.md** — /health, /ready, /metrics; Sentry/PostHog/factory_events
- **dr-and-cost.md** — RTO/RPO, Neon PITR, R2 lifecycle, LLM budget guard
- **compliance.md** — Domain-specific GDPR/DMCA/TCPA + data classification
- **orchestrator-contract.md** — Full machine interface (identical to xico-city)

**Files:** `docs/runbooks/*.md` (400-500 lines total)

---

## Step 9: Wire CI/CD

Create **.github/workflows/registry.yml**:

```yaml
name: Registry & Forbidden APIs

on:
  push:
    branches: [main, 'feature/**', 'plan/**']
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@adrper79-dot'
      - run: npm ci
        env:
          NODE_AUTH_TOKEN: ${{ secrets.PACKAGES_READ_TOKEN }}
      - run: npm run registry:validate
      - run: npm run check:forbidden
```

**File:** `.github/workflows/registry.yml` (copy from xico-city)

---

## Step 10: Update package.json

Add to **package.json**:

```json
{
  "scripts": {
    "registry:validate": "node scripts/registry-validate.mjs",
    "check:forbidden": "node scripts/check-forbidden-apis.mjs"
  },
  "devDependencies": {
    "yaml": "^2.6.0",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1"
  }
}
```

**File:** `package.json` (modified, add 3 devDeps + 2 scripts)

---

## Step 11: Create Execution Documentation

Create **EXECUTION_READINESS.md** and **SYNTHETIC_ORCHESTRATOR_WALKTHROUGH.js** (adapt from xico-city, update app name + product domain):

**Files:**
- `EXECUTION_READINESS.md` (~400 lines, app-specific)
- `SYNTHETIC_ORCHESTRATOR_WALKTHROUGH.js` (~300 lines, app-specific F-001)

---

## Step 12: Create Briefs Directory

Create **briefs/README.md** (copy from xico-city, describes artifact lifecycle):

**File:** `briefs/README.md` (identical to xico-city)

---

## Step 13: Commit & Push

```bash
git add -A
git commit -m "plan(s00): world-class v1 launch

{Detailed commit message listing all deliverables}
"

git push -u origin plan/v1-world-class
```

---

## Step 14: Open PR

```bash
gh pr create --base main --head plan/v1-world-class \
  --title "Plan v1 - world-class launch" \
  --body "{Comprehensive delivery summary}"
```

---

## Files to Reuse (No Changes)

These files are **app-agnostic** and can be copied directly from xico-city:

1. `registry/schema.json` — Generic registry schema
2. `scripts/registry-validate.mjs` — Generic validator (uses schema)
3. `scripts/orchestrator-v2.mjs` — Generic LLM orchestrator
4. `scripts/check-forbidden-apis.mjs` — Generic forbidden-APIs checker
5. `.github/workflows/registry.yml` — Generic CI workflow
6. `docs/runbooks/orchestrator-contract.md` — Generic orchestrator contract
7. `briefs/README.md` — Generic briefs lifecycle

---

## Files to Create / Customize

These files require **app-specific context**:

1. **BUILD_PLAN_v1.md** — Product, personas, domain tables, slices unique to app
2. **build_context.md** — Canonical schema, state machines, API standards unique to app
3. **registry/features.yaml** — 9-12 seed features unique to app
4. **docs/runbooks/observability.md** — App-specific SLI/SLO, alert thresholds
5. **docs/runbooks/dr-and-cost.md** — App-specific RTO/RPO, cost model
6. **docs/runbooks/compliance.md** — App-specific GDPR/DMCA/TCPA/etc.
7. **EXECUTION_READINESS.md** — App-specific execution validation
8. **SYNTHETIC_ORCHESTRATOR_WALKTHROUGH.js** — App-specific F-001 walkthrough
9. **package.json** — Add yaml, ajv, ajv-formats + scripts

---

## Replication Timeline

Per app (independent work, can be parallelized):

| Step | Time | Tool/Effort |
|------|------|-------------|
| Product discovery | 1h | Conversation with product lead |
| BUILD_PLAN_v1.md | 2h | Write 13 parts × ~60 lines each |
| build_context.md | 1.5h | Schema + state machines + API specs |
| registry/features.yaml | 1h | 9-12 features × ~30 lines each |
| Runbooks (4 files) | 1.5h | Copy/adapt from xico-city |
| Orchestrator suite (copy) | 0.5h | cp registry/*, scripts/* from xico-city |
| EXECUTION_READINESS.md | 1h | Validation proof + next-steps |
| CI/CD + package.json | 0.5h | Add npm scripts + devDeps |
| Commit + PR | 0.5h | git add, commit, push, gh pr create |
| **Total per app** | **9 hours** | Mostly writing + templating |

---

## Parallelization Strategy

Since each app's plan is independent:

```
App 1 (xpelevator)     ──────────────────►
App 2 (wordis-bond)            ──────────────────►
App 3 (cypher-healing)                 ──────────────────►
App 4 (prime-self)                              ──────────────────►
...
```

**Parallel capacity:** 4-6 agents simultaneously, one app per agent.

**Sequencing:** Can begin on any app once product context is defined.

---

## Quality Checklist

Before marking a plan READY TO EXECUTE:

- [ ] BUILD_PLAN_v1.md: 13 parts complete
- [ ] build_context.md: 250+ lines, full schema defined
- [ ] registry/features.yaml: 9-12 seed features, S-00–S-11 slices
- [ ] registry/schema.json: Present + valid (copy from xico-city)
- [ ] scripts/*: All 3 orchestrator files present (copy from xico-city)
- [ ] docs/runbooks/: 4 runbooks complete (observability, DR, compliance, contract)
- [ ] .github/workflows/registry.yml: Present + tests registry + forbidden APIs
- [ ] package.json: yaml, ajv, ajv-formats added + scripts added
- [ ] EXECUTION_READINESS.md: Comprehensive validation proof
- [ ] SYNTHETIC_ORCHESTRATOR_WALKTHROUGH.js: F-001 walkthrough with artifacts
- [ ] briefs/README.md: Copy from xico-city
- [ ] 1 git commit: "plan(sXX): world-class v1 launch" with full message
- [ ] 1 GitHub PR: Open, ready to merge

---

## Next Steps

For **xpelevator**:
1. Determine product domain (experiences + elevator pitch framework?)
2. Define 6 personas
3. Create BUILD_PLAN_v1.md (13 parts)
4. Copy/adapt remaining files
5. Commit + open PR
6. Repeat for wordis-bond, cypher-healing, prime-self, ijustus, the-calling, neighbor-aid

For **wordis-bond** (parallel):
1. Determine product domain (word-of-mouth verification + bonding platform?)
2. Define 6 personas
3. Create BUILD_PLAN_v1.md (13 parts)
4. ... (same as xpelevator)

---

## Success Criteria

All 7+ Factory apps have:
- ✅ World-class v1 build plan (BUILD_PLAN_v1.md)
- ✅ LLM agent context (build_context.md)
- ✅ Feature registry + validator (registry/)
- ✅ Orchestrator v2 (scripts/)
- ✅ Operational runbooks (docs/runbooks/)
- ✅ CI/CD validation (.github/workflows/registry.yml)
- ✅ Execution documentation (EXECUTION_READINESS.md)
- ✅ PR ready to merge

Then:
- Merge all PRs
- Wire GitHub secrets (PACKAGES_READ_TOKEN, ANTHROPIC_API_KEY)
- Run orchestrator on S-00 for each app in parallel
- Build 60+ features across 7+ apps concurrently

