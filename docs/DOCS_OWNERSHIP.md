# Documentation Ownership & Update Cadence

**Last Updated:** April 28, 2026

This file defines who owns each major doc, when it gets reviewed, and how to propose changes.

---

## Ownership Model

Each doc has:
- **Owner:** Primary person/role responsible for keeping it accurate
- **Reviewers:** Who peer-reviews changes before merge
- **Update Cadence:** How often it's scheduled for review
- **Change Process:** How to propose updates

---

## Documentation Inventory

### Strategic & Planning Docs

| Document | Owner | Reviewers | Cadence | Change Process |
|----------|-------|-----------|---------|-----------------|
| [WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) | Product Lead | EM, Tech Lead, All Track Leads | Monthly | PR + track lead approval |
| [PHASE_6_CHECKLIST.md](../PHASE_6_CHECKLIST.md) | Platform Lead | Infrastructure Engineer | Quarterly or on provision | PR + platform lead approval |
| [IMPLEMENTATION_MASTER_INDEX.md](IMPLEMENTATION_MASTER_INDEX.md) | Tech Writer / EM | Engineer, Product | Monthly | PR + editor approval |

### Quality & Process Docs

| Document | Owner | Reviewers | Cadence | Change Process |
|----------|-------|-----------|---------|-----------------|
| [Definition of Ready & Done](runbooks/definition-of-ready-done.md) | EM / Tech Lead | All track leads | Quarterly | PR + team consensus |
| [Product Quality Review](runbooks/product-quality-review.md) | Product Lead | Design Lead, EM | Quarterly | PR + product lead approval |
| [DOCS_OWNERSHIP.md](DOCS_OWNERSHIP.md) | Tech Writer | EM | Semi-annually | PR + tech writer approval |

### Operational Runbooks

| Document | Owner | Reviewers | Cadence | Change Process |
|----------|-------|-----------|---------|-----------------|
| [Getting Started](runbooks/getting-started.md) | Platform Lead | All engineers (feedback issues) | Quarterly | PR + platform lead approval |
| [Add New App](runbooks/add-new-app.md) | Platform Lead | Infrastructure team | Quarterly or on new app | PR + platform lead approval |
| [Database](runbooks/database.md) | Database Admin | Platform Lead | Semi-annually | PR + DBA approval |
| [Deployment](runbooks/deployment.md) | EM / Ops Lead | On-call engineer | Quarterly | PR + ops lead approval |
| [Environment Isolation & Verification](runbooks/environment-isolation-and-verification.md) | Platform Lead | Security engineer | Annually or post-incident | PR + platform lead approval |
| [GitHub Secrets & Tokens](runbooks/github-secrets-and-tokens.md) | DevOps / Ops Lead | Security engineer | Quarterly | PR + ops lead approval |
| [Secret Rotation](runbooks/secret-rotation.md) | DevOps / Ops Lead | Security engineer | Annually or on rotation | PR + ops lead approval |
| [SLO & Observability](runbooks/slo.md) | Ops Lead / SRE | Reliability engineer | Quarterly | PR + ops lead approval |
| [App Transfer](runbooks/transfer.md) | Platform Lead | EM | As-needed (on transfer) | PR + platform lead approval |
| [Lessons Learned](runbooks/lessons-learned.md) | All engineers (crowdsourced) | Tech Writer, EM | Monthly | Issue-driven, PR feedback loop |

### Standards & Baselines

| Document | Owner | Reviewers | Cadence | Change Process |
|----------|-------|-----------|---------|-----------------|
| [Design Standards](packages/design-standards.mdx) | Design Lead | Product Lead, Accessibility | Semi-annually | PR + design lead approval |
| [videoking Engineering Baseline](packages/videoking-engineering-baseline.mdx) | Core App Tech Lead | Platform Lead | Quarterly | PR + tech lead approval |
| [User Journeys & Telemetry](packages/journeys.mdx) | Product Lead | Analytics engineer | Quarterly | PR + product lead approval |
| [Service Registry](service-registry.yml) | Platform Lead | All engineers (via runbook) | Per-deployment | Automated via deployment runbook |

### Reference & Templates

| Document | Owner | Reviewers | Cadence | Change Process |
|----------|-------|-----------|---------|-----------------|
| [App README Template](APP_README_TEMPLATE.md) | Tech Writer | EM | Annually | PR + tech writer approval |
| [ENVIRONMENT_VERIFICATION_SETUP.md](ENVIRONMENT_VERIFICATION_SETUP.md) | Platform Lead | DevOps | Annually or per new app | PR + platform lead approval |
| [README.md](README.md) | Tech Writer | EM | Quarterly | PR + tech writer approval |

### Foundation Docs (Not Mutable; see CLAUDE.md)

| Document | Owner | Reviewers | Cadence | Notes |
|----------|-------|-----------|---------|-------|
| [CLAUDE.md](../CLAUDE.md) | Engineer / EM | All track leads | Quarterly | Changes only with team consensus; breaking changes require 2-week notice |
| [START_HERE.md](../START_HERE.md) | Tech Writer | EM | Annually | Updated to match CLAUDE.md and latest tooling |

---

## Update Cadence Definitions

| Cadence | Frequency | Trigger |
|---------|-----------|---------|
| Monthly | 1st working day of month | Review + update |
| Quarterly | 1st day of Q1, Q2, Q3, Q4 | Scheduled review |
| Semi-annually | 1st Jan, 1st July | Major review |
| Annually | 1st Jan | Comprehensive review |
| Per-deployment | On each deploy to prod | Automated validation |
| As-needed | On event (transfer, incident, new app) | Event-triggered |
| Issue-driven | Continuous | Feedback loop in issues |

---

## How to Propose a Change

### For Small Updates (typos, clarifications, link fixes)
1. Create a PR with the change
2. Tag the document owner as reviewer
3. They approve or request changes within **3 business days**
4. Merge and update "Last Updated" date at top of file

### For Content Changes (new sections, procedure updates, new checklists)
1. Open an issue describing the change
2. Discuss with the document owner and affected teams
3. Owner creates a PR with the change
4. Include "Last Updated" date update
5. At least 2 reviewers must approve
6. Merge once consensus is reached

### For Breaking Changes (e.g., new required CI gate, new responsibility assignment)
1. Open an issue and propose the change at least **2 weeks** before implementation
2. Post in team Slack / email for visibility
3. Collect feedback from all affected parties
4. Owner creates PR with change
5. Requires approval from all affected track leads
6. Merge and communicate change date to all engineers

### For Emergency Updates (production incident, security fix, critical bug)
1. Owner creates PR immediately
2. Minimum 1 reviewer (conflict party if possible)
3. Merge first, notify team in Slack
4. Schedule retro within 24 hours if incident-driven

---

## Maintaining Freshness

### Automated Checks (CI)

Each PR to the `docs/` folder triggers:
- Link validation (no 404s)
- Markdown linting (consistent formatting)
- "Last Updated" field check (must be current)

### Manual Checks

**Monthly:** Tech Writer runs [doc-freshness-audit.js](#doc-freshness-audit-script) (see below) and files issues for stale docs.

**On Any Merge:** GitHub Action updates the doc's "Last Updated" date timestamp.

### Staleness Rules

- **Yellow Flag:** Doc not updated in 3 months beyond cadence
- **Red Flag:** Doc not updated in 6 months beyond cadence
- **Action:** File issue with owner, escalate to EM if unresponded within 1 week

---

## Doc Freshness Audit Script

**Location:** `scripts/doc-freshness-audit.js`

Checks all docs in `docs/` for staleness and outputs a report.

### Usage

```bash
# Check all docs in docs/ directory
node scripts/doc-freshness-audit.js

# Output: Markdown report of stale docs (>30 days past their cadence)
# Example output:
# ## Stale Documentation Report (April 28, 2026)
# 
# ### ⚠️ Yellow Flags (31-90 days overdue)
# - docs/runbooks/deployment.md (last updated 2026-01-15, cadence: quarterly)
#
# ### 🚨 Red Flags (>90 days overdue)
# - docs/runbooks/database.md (last updated 2025-10-01, cadence: semi-annual)
```

### Integration

Run weekly via GitHub Actions:
- Schedule: Mondays at 09:00 UTC
- Output: Comment on the weekly status issue
- Escalation: Auto-assign stale docs to owners with @mention

---

## Change Log

### April 28, 2026
- Initial documentation ownership framework
- Added ownership assignments for all major docs
- Established update cadences and change processes
- Created doc freshness audit tooling

---

## FAQ

### "Do I need approval to fix a typo?"
No. For typos and broken links, create a PR, tag the owner, and merge once they approve (or after 3 business days if no response).

### "Who approves docs I own?"
At least one person not on your team (for cross-check) plus the EM or Tech Lead. This prevents docs from becoming too specialized or losing clarity.

### "What if the owner is on vacation?"
Designate a backup in the PR description. If no backup, the EM approves.

### "How do I know what the current cadence is?"
Check the table above. If a doc isn't listed, treat it as "as-needed" and propose an update via issue.

### "Can we skip the monthly review?"
No, but if nothing changed, the review is just "mark current; no changes." Updates the "Last Updated" date. This prevents docs from becoming silently stale.

---

## Related Docs

- [IMPLEMENTATION_MASTER_INDEX.md](IMPLEMENTATION_MASTER_INDEX.md) — Navigation hub
- [Definition of Ready & Done](runbooks/definition-of-ready-done.md) — Quality gates for all work
- [CLAUDE.md](../CLAUDE.md) — Standing Orders (not mutable without consensus)
