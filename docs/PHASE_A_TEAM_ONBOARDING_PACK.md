# Phase A Team Onboarding Pack

**Last Updated:** April 28, 2026  
**For:** All Factory Teams (Engineering, Product, Design, Ops, Platform)  
**Phase Duration:** Weeks 1–2 (May 1–14, 2026)  
**Goal:** Establish one quality bar, one roadmap, and one delivery operating model

---

## Quick Start: First 2 Hours Post-Approval

### 1. Read the Plan (30 min)
Start here: **[WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md)**
- Executive Verdict (what's strong, what's missing)
- North Star (the target)
- Responsibility Model (who owns what)
- Phase Roadmap (4-phase sequence)

**Take-home:** Understand why Factory is shifting from infrastructure-only to product+infrastructure+operations.

### 2. Find Your Role (15 min)
**[IMPLEMENTATION_SCORECARD.md](IMPLEMENTATION_SCORECARD.md)** → Find your track and initiatives
- T1: Product + UX → Product Lead, Design Lead
- T2: Engineering Excellence → Tech Lead
- T3: Monetization + Ops → Product + Payments Lead
- T4: Factory Platform → Platform Lead
- T5: Reliability → Platform + App Ops
- T6: Delivery Process → Engineering Manager
- T7: Documentation → Tech Writing + Team

**Take-home:** Know your track owner and the 3–5 initiatives you're responsible for in Phase A.

### 3. Review Your Initiative Details (30 min)
Open the master index: **[IMPLEMENTATION_MASTER_INDEX.md](IMPLEMENTATION_MASTER_INDEX.md)**

For each of your Phase A initiatives:
- Read the "Why It Matters" section
- Understand the "Exit Criteria"
- Review the linked documentation
- Note the timeline (Phase A = Weeks 1–2)

**Take-home:** Each initiative should have measurable, checkable exit criteria. You own making sure you hit them.

### 4. Confirm You're Ready (15 min)
Checklist before Day 1:
- [ ] Read the dashboard (30 min)
- [ ] Found your track in the scorecard
- [ ] Reviewed your Phase A initiatives + exit criteria
- [ ] Identified any blockers or questions
- [ ] Added initiatives to your team's sprint backlog
- [ ] Scheduled a 15-min sync with your track lead

**Take-home:** You can start work immediately; all docs, templates, and resources are ready.

---

## Phase A Structure: 5 Initiatives to Complete

### Track T1: Product + UX Operating System (Product + Design Lead)

**T1.1 — Design Principles & Product Quality Rubric** ✅ COMPLETE
- **What is this?** 7 shared design principles + 6-dimension quality rubric for feature/app reviews
- **Your deliverables:** Design rubric doc, PR review checklist, review workflow
- **Links:** [docs/packages/design-standards.mdx](packages/design-standards.mdx)
- **Success:** Rubric is used in at least 2 code reviews this sprint
- **Owner assigned?** → Product Lead

**T1.2 — Journey Map for Top 8 Flows** ✅ COMPLETE
- **What is this?** User + operator journeys (signup, checkout, creator onboarding, payout ops, etc.) with KPIs and instrumentation needs
- **Your deliverables:** Journey pack document, data mapping, ownership assignments
- **Links:** [docs/packages/journeys.mdx](packages/journeys.mdx)
- **Success:** Every journey has a corresponding test/instrumentation requirement in your backlog
- **Owner assigned?** → Product Lead + Design Lead

**T1.3 — Accessibility Baseline (Phase D, not A)**
- **Note:** T1.3 is a Phase D initiative; T1.1 and T1.2 are Phase A only

---

### Track T2: Engineering Excellence (Tech Lead)

**T2.1 — Refresh App Engineering Baseline** ✅ COMPLETE
- **What is this?** Current state of videoking after Phase 4 (DLQ, payout batching, etc.) + risk register + test coverage baseline
- **Your deliverables:** Baseline doc, risk register, test coverage snapshot
- **Links:** [docs/packages/videoking-engineering-baseline.mdx](packages/videoking-engineering-baseline.mdx)
- **Success:** Risk register is accurate; teams understand Phase 4 capabilities and gaps
- **Owner assigned?** → Tech Lead

---

### Track T6: Delivery Process (Engineering Manager / Tech Lead)

**T6.1 — Definition of Ready / Done** ✅ COMPLETE
- **What is this?** Quality gates for work start and completion (8-point DoR, 12-point DoD)
- **Your deliverables:** DoR/DoD checklist, PR template, CI gates
- **Links:** [docs/runbooks/definition-of-ready-done.md](runbooks/definition-of-ready-done.md)
- **Success:** Every PR uses the checklist; ≥85% backlog items meet DoR before work starts
- **Owner assigned?** → Engineering Manager

---

### Track T7: Documentation (Tech Writing + Team)

**T7.1 — Consolidate Source-of-Truth Docs** ✅ COMPLETE
- **What is this?** Single master index replacing 20+ scattered status files; doc ownership model
- **Your deliverables:** Master index, README, docs ownership matrix, freshness audit script
- **Links:** [docs/IMPLEMENTATION_MASTER_INDEX.md](IMPLEMENTATION_MASTER_INDEX.md), [docs/DOCS_OWNERSHIP.md](DOCS_OWNERSHIP.md)
- **Success:** New team member can find any doc in <2 clicks from master index
- **Owner assigned?** → Tech Writer + Team Lead

---

## What SUCCESS Looks Like at End of Phase A

### Product + Design ← (T1)
- ✅ Design rubric is used in QA gate for at least 3 features
- ✅ All 8 journeys have corresponding instrumentation "to-do" items in backlog
- ✅ Design team understands Factory vs app responsibility boundaries

### Engineering ← (T2)
- ✅ Baseline reflects current state with zero gaps
- ✅ Risk register is reviewed in team sync; high-priority items have owners
- ✅ Test coverage baseline is captured; team knows what Phase C will require

### Operations ← (T6 lead)
- ✅ DoR/DoD is used on ≥80% of PRs filed this sprint
- ✅ CI gates enforce minimum coverage, no ESLint errors, no TypeScript issues
- ✅ PR template auto-applies with embedded checklist

### Documentation ← (T7)
- ✅ Master index is the single entry point (no more "where is that doc?")
- ✅ Doc ownership roles are assigned; freshness audits run weekly automated
- ✅ No doc is >7 days stale without a "last updated" date

**End of Phase A Readiness Check:** All 5 initiatives have their exit criteria verified. Team is ready for Phase B.

---

## Common Questions

**Q: How long will Phase A take?**  
A: ~2 weeks (May 1–14). Most initiatives are documentation + process setup, not large code changes.

**Q: Do I have to do my Phase A work before I can start Phase B?**  
A: For most teams, yes. Phase B depends on Phase A baselines (e.g., T5.1 SLOs need T2.1 baseline). Some teams can overlap; your track lead will clarify the exact dependencies.

**Q: What if I find a blocker?**  
A: Raise it immediately in your track lead's sync. Blockers are escalated to the implementation lead within 24 hours.

**Q: I'm not in Engineering/Product/Design/Ops. What do I do?**  
A: Check [IMPLEMENTATION_SCORECARD.md](IMPLEMENTATION_SCORECARD.md) for your track. If you're supporting multiple tracks (e.g., platform team), attend the syncs for each track you're supporting.

**Q: Can I preview what Phase B looks like?**  
A: Yes. Phase B has 4 more initiatives that start after Phase A closes. See the [WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) for the full roadmap.

---

## Resources Linked By Role

**Product Lead:**
- Quality Rubric: [design-standards.mdx](packages/design-standards.mdx)
- KP tracking: [MASTER_SUCCESS_METRICS_BASELINE.md](MASTER_SUCCESS_METRICS_BASELINE.md)
- Journey instrumentation: [packages/journeys.mdx](packages/journeys.mdx)

**Design Lead:**
- Design principles: [design-standards.mdx](packages/design-standards.mdx)
- Design system baseline: [design-system-scope.md](packages/design-system-scope.md)
- Accessibility overview: [accessibility-testing-guide.md](accessibility-testing-guide.md)

**Tech Lead:**
- Baseline review: [videoking-engineering-baseline.mdx](packages/videoking-engineering-baseline.mdx)
- Factory capabilities: [factory-capabilities-matrix.mdx](packages/factory-capabilities-matrix.mdx)
- Quality standards: [Definition of Ready/Done](runbooks/definition-of-ready-done.md)

**Engineering Manager:**
- DoR/DoD gates: [definition-of-ready-done.md](runbooks/definition-of-ready-done.md)
- KPI targets: [MASTER_SUCCESS_METRICS_BASELINE.md](MASTER_SUCCESS_METRICS_BASELINE.md)
- Retrospective template: [templates/RETROSPECTIVE_TEMPLATE.md](templates/RETROSPECTIVE_TEMPLATE.md)

**Ops + On-Call:**
- SLO framework: [runbooks/slo-framework.md](runbooks/slo-framework.md)
- SLO targets: [videoking/slo-targets.md](videoking/slo-targets.md)
- Incident response: [runbooks/incident-response-playbook.md](runbooks/incident-response-playbook.md)

**Tech Writer + Documentation:**
- Master index: [IMPLEMENTATION_MASTER_INDEX.md](IMPLEMENTATION_MASTER_INDEX.md)
- Docs ownership: [DOCS_OWNERSHIP.md](DOCS_OWNERSHIP.md)
- Freshness audit: [scripts/doc-freshness-audit.js](../scripts/doc-freshness-audit.js)

---

**Next Step:** Confirm your Phase A assignments and add them to your sprint backlog by May 1, 2026.
