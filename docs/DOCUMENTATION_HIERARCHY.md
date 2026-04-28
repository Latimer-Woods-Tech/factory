# Documentation Hierarchy & Source of Truth

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T7.1 — Consolidate Source-of-Truth Docs  
**Reference:** Factory + VideoKing combined documentation

---

## Mission

Create **one canonical structure** for all documentation so every team member knows:
- "Where do I find X?" (configuration, architecture, performance baselines, etc.)
- "Is this doc current?" (last updated date, owner, SLA for updates)
- "What changed?" (git history for changes, not just file date)

Goal: **Single source of truth** = fewer duplicate docs, no conflicting guidance, easier onboarding.

---

## Part 1: Documentation Hierarchy

### Tier 1: Root README (Landing Page)

**Location:** `README.md` (repo root)  
**Purpose:** "I'm new; where do I start?"  
**Content:** Links to Tier 2 docs by audience + quick-start checklist

**Current State:** Out-of-date; links to old docs  
**Action:** Rewrite with new hierarchy links

```markdown
# Factory + VideoKing

Quick links by role:

**New to the team?**
- [Getting Started](./docs/runbooks/getting-started.md) (clone, setup, first deploy)
- [Team Onboarding](./docs/PHASE_A_TEAM_ONBOARDING_PACK.md) (2-hour introduction)

**Frontend Developer?**
- [Frontend Standards](./docs/FACTORY_FRONTEND_STANDARDS.md) (accessibility, performance, testing)
- [Component Library](./apps/admin-studio-ui/docs/COMPONENT_LIBRARY.md) (components + examples)

**Backend/Worker Developer?**
- [Factory Packages](./docs/FACTORY_PACKAGE_MATRIX.md) (which packages, how to use)
- [Database Guide](./docs/runbooks/database.md) (schema, migrations, RLS)

**Operations/DevOps?**
- [Deployment](./docs/runbooks/deployment.md) (staging vs production)
- [SLOs & Monitoring](./docs/videoking/SLO_FRAMEWORK.md) (reliability targets + alerts)

**Product/Design?**
- [Journey Maps](./docs/JOURNEY_MAPS_8_FLOWS.md) (8 critical flows + instrumentation)
- [Design Rubric](./docs/DESIGN_QUALITY_RUBRIC.md) (quality standards + CI gates)

**Want to contribute?**
- [Definition of Ready/Done](./docs/DEFINITION_OF_READY_DONE.md) (quality gates)
- [RFC Process](./docs/RFC_DESIGN_REVIEW_PROCESS.md) (proposal template + approval)

**Full Documentation Index:** [Docs Index](./docs/DOCUMENTATION_INDEX.md)
```

---

### Tier 2: Documentation Index (Organized by Domain)

**Location:** `docs/DOCUMENTATION_INDEX.md`  
**Purpose:** "What docs exist? Where are they? Who maintains each?"  
**Content:** Comprehensive listing of ALL docs (current state)

```markdown
# Documentation Index

**Last Updated:** [auto-date]  
**Owner:** [Engineering Manager]  
**SLA:** Updated within 3 days of doc creation/move

---

## Section 1: Getting Started

| Document | Purpose | Owner | Last Updated |
|----------|---------|-------|---|
| [Getting Started](./runbooks/getting-started.md) | Clone repo, setup .dev.vars, first local run | Tech Lead | 2026-04-28 |
| [Environment Verification](./ENVIRONMENT_VERIFICATION_SETUP.md) | Pre-flight checks before `npm run dev` | DevOps | 2026-04-01 |

## Section 2: Core Architecture

| Document | Purpose | Owner | Last Updated |
|----------|---------|-------|---|
| [VideoKing Engineering Baseline](./videoking/videoking-engineering-baseline.mdx) | Phase 4 state: schema, DLQ, payouts, tech stack | Core App Lead | 2026-04-28 |
| [Factory Package Matrix](./FACTORY_PACKAGE_MATRIX.md) | Which pkg for what; consumption guide; new app onboarding | Platform Lead | 2026-04-28 |
| [Factory Core Architecture](../factory_core_architecture.md) | Standing orders + package boundaries + hard constraints | Platform Lead | 2026-01-15 |

## Section 3: Quality Standards

| Document | Purpose | Owner | Last Updated |
|----------|---------|-------|---|
| [Design Quality Rubric](./DESIGN_QUALITY_RUBRIC.md) | 6 principles + 15-point component checklist | Design Lead | 2026-04-28 |
| [Frontend Standards](./FACTORY_FRONTEND_STANDARDS.md) | Accessibility (WCAG 2.2), performance (Lighthouse 85), responsive | Design Lead | 2026-04-28 |
| [Definition of Ready/Done](./DEFINITION_OF_READY_DONE.md) | PR gates; DoR checklist; DoD checklist; CI enforcement | Engineering Manager | 2026-04-28 |

## Section 4: Planning & Design

| Document | Purpose | Owner | Last Updated |
|----------|---------|-------|---|
| [Journey Maps (8 Flows)](./JOURNEY_MAPS_8_FLOWS.md) | Viewer, signup, subscribe, unlock, upload, connect, payouts, moderation | Product Lead | 2026-04-28 |
| [RFC & Design Review](./RFC_DESIGN_REVIEW_PROCESS.md) | RFC template; design review workflow; approval gates | Engineering Manager | 2026-04-28 |
| [World-Class Roadmap](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) | 28 initiatives across 7 tracks; phase sequencing | Product Lead | 2026-04-28 |

## Section 5: Operations & Reliability

| Document | Purpose | Owner | Last Updated |
|----------|---------|-------|---|
| [SLO Framework](./videoking/SLO_FRAMEWORK.md) | Tier 1/2/3 targets; error budgets; alert thresholds; weekly cadence | Ops Lead | 2026-04-28 |
| [On-Call Runbook](./videoking/ON_CALL_RUNBOOK.md) | 5-phase incident response; triage; post-mortem | Ops Lead | 2026-04-28 |
| [Deployment](./runbooks/deployment.md) | Staging vs production; smoke tests; rollback | DevOps | 2026-03-15 |
| [Secrets & Tokens](./runbooks/github-secrets-and-tokens.md) | GitHub Secrets inventory; rotation schedule | DevOps | 2026-02-20 |
| [Secret Rotation](./runbooks/secret-rotation.md) | How to rotate JWT, DATABASE_URL, API keys without downtime | DevOps | 2026-02-20 |

## Section 6: Implementation Phases

| Document | Purpose | Owner | Last Updated |
|----------|---------|-------|---|
| [Phase B Launch Check](./IMPLEMENTATION_LAUNCH_CHECKLIST.md) | Pre-kickoff checklist; 5 complete items | Implementation Lead | 2026-04-28 |
| [Phase A Onboarding Pack](./PHASE_A_TEAM_ONBOARDING_PACK.md) | 2-hour quick-start; role-specific resources | Implementation Lead | 2026-04-28 |
| [Phase 6 Checkpoint](../PHASE_6_7_READY_STATE.md) | Infrastructure provisioning status (Neon, Hyperdrive, Sentry) | Platform Lead | 2026-01-20 |

---

## Update Schedule

| Document Tier | Review Cadence | Owner |
|---|---|---|
| Getting Started | Weekly (on-demand if issues) | Tech Lead |
| Architecture | Monthly (after major changes) | Tech Lead |
| Process/Standards | Monthly (after policy changes) | Engineering Manager |

---
```

---

### Tier 3: Domain-Specific Docs

**Locations:**
- `docs/runbooks/` — Step-by-step procedures (deployment, secrets, debugging)
- `docs/videoking/` — VideoKing-specific architecture + operations
- `docs/packages/` — Individual package documentation
- `packages/{pkg}/README.md` — Package-level API docs
- `packages/*/docs/` — Package-specific guides

**Example Structure:**

```
docs/
├── README.md (Tier 1: landing page)
├── DOCUMENTATION_INDEX.md (Tier 2: comprehensive listing)
│
├── runbooks/
│   ├── getting-started.md
│   ├── deployment.md
│   ├── database.md
│   ├── github-secrets-and-tokens.md
│   ├── secret-rotation.md
│   ├── lessons-learned.md
│   └── environment-isolation-and-verification.md
│
├── videoking/
│   ├── videoking-engineering-baseline.mdx
│   ├── SLO_FRAMEWORK.md
│   ├── ON_CALL_RUNBOOK.md
│   ├── IMPLEMENTATION_KICKOFF_APRIL_28.md
│   └── ...
│
├── packages/
│   ├── auth.mdx
│   ├── neon.mdx
│   ├── stripe.mdx
│   └── ...
│
└── QUALITY_STANDARDS/
    ├── DESIGN_QUALITY_RUBRIC.md
    ├── FACTORY_FRONTEND_STANDARDS.md
    ├── DEFINITION_OF_READY_DONE.md
    └── ...
```

---

### Tier 4: Application-Level Docs

**Location:** App README at root of app folder (e.g., `apps/admin-studio-ui/README.md`)

**Content:**
- What is this app?
- Local setup (how to run it)
- Key directories
- Common tasks
- Troubleshooting

**Example:**

```markdown
# Admin Studio UI

Frontend for creator dashboard (earnings, videos, subscribers).

## Quick Start

# Clone + dependencies
npm install

# Local dev (connects to staging API)
npm run dev    # http://localhost:3000

# Build for production
npm run build

## Key Directories

- `src/pages/` — Page components (route-based)
- `src/components/` — Reusable UI components
- `src/hooks/` — Custom React hooks
- `src/styles/` — Tailwind CSS + custom styles
- `tests/` — Vitest tests

## Common Tasks

**Add a new page:**
1. Create `src/pages/YourPage.tsx`
2. Add route in routing config
3. Add tests in `tests/pages/YourPage.test.tsx`

**Use a component:**
```typescript
import { Button } from '@/components/Button';
<Button variant="primary">Submit</Button>
```

**Debug styling:**
- Tailwind classes are case-sensitive
- Use `className` (not inline styles)
- Check `tailwind.config.js` for available tokens

## Troubleshooting

**Q: Styles not applying?**
A: Check that file is in `src/` directory (Tailwind scans `src/`). If new custom class, add to `tailwind.config.js` or inline with `@apply`.

## See Also

- [Frontend Standards](../../docs/FACTORY_FRONTEND_STANDARDS.md)
- [Components Library](./docs/COMPONENT_LIBRARY.md)
```

---

## Part 2: Documentation Standards

### Metadata Header (Every Doc)

Every doc 2+ pages should start with:

```markdown
---
title: Document Title
description: One-sentence summary
last_updated: 2026-04-28
owner: [Name + Slack handle]
sla: [How often updated? e.g., "Weekly" or "On-demand"]
---

# Document Title

**Status:** ✅ Current (/ ⚠️ Needs Review / ❌ Stale)
**Last Updated:** April 28, 2026 by [Name]
**SLA:** Updated within [X days] of [event]

---
```

**Example:**

```markdown
---
title: SLO Framework
description: Service-level objectives, error budgets, alert rules for VideoKing
last_updated: 2026-04-28
owner: Ops Lead (ops-lead@slack)
sla: Updated quarterly or within 1 week of SLO miss
---

# Service-Level Objectives Framework

**Status:** ✅ Current  
**Last Updated:** April 28, 2026 by Ops Lead  
**SLA:** Updated quarterly (next review: July 28) or within 1 week if SLO missed

---
```

### Content Checklist

Every doc should have:

- [ ] **Title & Purpose:** "What is this doc for?"
- [ ] **Audience:** "Who should read this?" (engineers, ops, designers, etc.)
- [ ] **Quick Summary:** 1–2 paragraphs (TLDR for skimmers)
- [ ] **Table of Contents:** If > 2,000 words
- [ ] **Examples:** Code snippets, real-world scenarios (not just theory)
- [ ] **Troubleshooting Section:** "What could go wrong + fix"
- [ ] **Related Docs:** Links to related information
- [ ] **Version History:** Last updated date + change log
- [ ] **Metadata:** Owner, SLA, status

### Code Samples in Docs

All code samples must:
- [ ] Be copy-paste ready (not pseudocode)
- [ ] Include error handling
- [ ] Have comments explaining "why", not just "what"
- [ ] Link to full examples (don't hide important logic)

**Example (Good):**

```typescript
// Deploy SLO metrics to PostHog
try {
  const metrics = await collectSLOMetrics(env);
  
  // Track each metric as a PostHog event
  // (PostHog auto-batches events; no retry needed)
  await posthog.capture({
    event: 'slo_metrics_collected',
    properties: metrics,
  });
} catch (err) {
  // If PostHog fails, don't break the rest of the job
  // Log error for debugging; continue
  logger.error('posthog_collection_failed', { error: err.message });
}
```

---

## Part 3: Documentation Lifecycle

### Creation Phase

**When a doc is created:**
1. Place in correct location (Tier 2 index, domain, or app)
2. Add metadata header (title, owner, SLA, status)
3. Add to `DOCUMENTATION_INDEX.md`
4. Create a GitHub issue: "Document created: [name]" (for tracking)
5. Announce in `#engineering` Slack channel (link + 1-sentence summary)

### Maintenance Phase

**Every 3 months:** Doc owner reviews for **staleness**

| SLA | Action | Example |
|-----|--------|---------|
| Weekly | Check on-demand; update if referenced in issue | On-call runbook |
| Monthly | Manual review + update if policy changed | Architecture docs |
| Quarterly | Review for technical debt | Getting started guide |
| Annually | Heavy lift review (might need rewrite) | Standing orders |

**When doc needs update:**
1. Owner updates doc + git commit: "docs(runbooks): update secret rotation SLA [reason]"
2. Update `last_updated` date
3. Announce in Slack if breaking change

### Archive Phase

**When a doc becomes obsolete:**
1. Mark as `❌ Stale` in header (don't delete; historical value)
2. Add note at top: "This doc is deprecated as of [date]. See [new doc] instead."
3. Move to `docs/ARCHIVE/` directory
4. Remove from `DOCUMENTATION_INDEX.md` (but mention in archive section)

**Example:**

```markdown
---
title: Phase 6 Setup (DEPRECATED)
status: ❌ Stale (replaced by automated orchestrator)
---

# ⚠️ DEPRECATED: Phase 6 Setup

**This guide was for manual Phase 6 provisioning. As of April 28, 2026, use:**
- `npm run phase-6:provision` (automated orchestrator)
- See: [Phase 6 Orchestrator](../scripts/phase-6-orchestrator.mjs)

---

## Original Content (for reference)

[... original doc content ...]
```

---

## Part 4: Cross-Reference Guide

### "I need to find..."

| Need | Doc | Location |
|------|-----|----------|
| How to set up local dev | Getting Started | `docs/runbooks/getting-started.md` |
| How to deploy to production | Deployment | `docs/runbooks/deployment.md` |
| How to understand the codebase | Engineering Baseline | `docs/videoking/videoking-engineering-baseline.mdx` |
| Package I should use for X | Factory Package Matrix | `docs/FACTORY_PACKAGE_MATRIX.md` |
| How to design a feature | Design Rubric + RFC | `docs/DESIGN_QUALITY_RUBRIC.md` + `docs/RFC_DESIGN_REVIEW_PROCESS.md` |
| How to write code that passes tests | DoD + Frontend Std | `docs/DEFINITION_OF_READY_DONE.md` + `docs/FACTORY_FRONTEND_STANDARDS.md` |
| What's the current SLO target? | SLO Framework | `docs/videoking/SLO_FRAMEWORK.md` |
| How do I handle a production incident? | On-Call Runbook | `docs/videoking/ON_CALL_RUNBOOK.md` |
| What's the roadmap? | Implementation Dashboard | `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md` |
| How to structure a new user journey | Journey Maps | `docs/JOURNEY_MAPS_8_FLOWS.md` |

---

## Part 5: Documentation by Audience

### For New Team Members

**Read in order (2–3 hours):**
1. `README.md` (5 min intro)
2. [Getting Started](./runbooks/getting-started.md) (30 min setup)
3. [Team Onboarding Pack](./PHASE_A_TEAM_ONBOARDING_PACK.md) (1 hour intro by role)
4. [Engineering Baseline](./videoking/videoking-engineering-baseline.mdx) (45 min overview)
5. **Your role's guide:**
   - Frontend dev → [Frontend Standards](./FACTORY_FRONTEND_STANDARDS.md)
   - Backend dev → [Factory Package Matrix](./FACTORY_PACKAGE_MATRIX.md) + [Database](./runbooks/database.md)
   - DevOps → [Deployment](./runbooks/deployment.md) + [Secrets](./runbooks/github-secrets-and-tokens.md)
   - Designer → [Design Rubric](./DESIGN_QUALITY_RUBRIC.md) + [Journey Maps](./JOURNEY_MAPS_8_FLOWS.md)

### For Frontend Developers

**Daily Reference:**
- [Frontend Standards](./FACTORY_FRONTEND_STANDARDS.md) (accessibility, performance, component patterns)
- App-specific README (e.g., `apps/admin-studio-ui/README.md`)
- Component library docs (e.g., `apps/admin-studio-ui/docs/COMPONENT_LIBRARY.md`)

**Design Changes:**
- [Design Quality Rubric](./DESIGN_QUALITY_RUBRIC.md) (quality checklist)
- [RFC & Design Review](./RFC_DESIGN_REVIEW_PROCESS.md) (process before coding)
- [Journey Maps](./JOURNEY_MAPS_8_FLOWS.md) (user goal + instrumentation)

### For Backend Developers

**Daily Reference:**
- [Factory Package Matrix](./FACTORY_PACKAGE_MATRIX.md) (which pkg for what)
- Package-level README (e.g., `packages/stripe/README.md`)
- [Database Guide](./runbooks/database.md) (schema, migrations, queries)

**System Changes:**
- [RFC & Design Review](./RFC_DESIGN_REVIEW_PROCESS.md) (proposal template)
- [Engineering Baseline](./videoking/videoking-engineering-baseline.mdx) (current architecture)

### For Operations / DevOps

**Runbooks:**
- [Deployment](./runbooks/deployment.md) (how to release)
- [Secret Rotation](./runbooks/secret-rotation.md) (managing secrets)
- [SLO Framework](./videoking/SLO_FRAMEWORK.md) (targets + monitoring)
- [On-Call Runbook](./videoking/ON_CALL_RUNBOOK.md) (incident response)

**Status Dashboards:**
- [Implementation Dashboard](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) (roadmap + phases)
- [Phase 6 Checkpoint](../PHASE_6_7_READY_STATE.md) (infrastructure status)

### For Product / Design

**Planning:**
- [Journey Maps](./JOURNEY_MAPS_8_FLOWS.md) (8 critical flows)
- [Design Quality Rubric](./DESIGN_QUALITY_RUBRIC.md) (quality standards)
- [RFC & Design Review](./RFC_DESIGN_REVIEW_PROCESS.md) (process)
- [Implementation Dashboard](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) (roadmap)

**Constraints:**
- [Definition of Ready/Done](./DEFINITION_OF_READY_DONE.md) (quality gates)
- [Factory Package Matrix](./FACTORY_PACKAGE_MATRIX.md) (what's available)

---

## T7.1 Exit Criteria (by May 29, 2026)

- [x] Documentation hierarchy defined (Tier 1–4)
- [x] Root README rewritten with hierarchy links
- [x] Documentation Index created (comprehensive listing)
- [x] Metadata header template created (title, owner, SLA, status)
- [x] Documentation standards documented (content checklist, code samples)
- [x] Lifecycle process documented (creation, maintenance, archive)
- [x] Cross-reference guide created ("I need to find...")
- [x] Audience-specific guides created (new hire, frontend, backend, ops, product)
- [ ] All existing docs migrated to new structure (May 5–12)
- [ ] All docs updated with metadata headers (May 5–12)
- [ ] Stale docs archived (May 8)
- [ ] Team trained on doc navigation (May 12)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Technical Writer | Initial documentation hierarchy; standards; lifecycle; guides |

---

**Status:** ✅ T7.1 READY FOR IMPLEMENTATION  
**Next Action:** Migrate existing docs to new structure (May 5–12); team training May 12

