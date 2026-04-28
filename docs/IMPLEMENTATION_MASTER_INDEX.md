# Implementation Master Index

**Last Updated:** April 28, 2026  
**Audience:** Factory Core engineers, app developers, ops, product, and design teams

This is the single entry point for all Factory implementation docs. It replaces multiple scattered status files with one clear navigation hierarchy.

---

## Quick Links

**Starting a new project?** → [App README Template](APP_README_TEMPLATE.md)  
**Deploying for the first time?** → [Getting Started](runbooks/getting-started.md)  
**Choosing Factory packages?** → [Capability Matrix](packages/factory-capabilities-matrix.mdx) (decision tree + per-package guides)  
**Building frontend?** → [Frontend Standards](packages/frontend-standards.mdx) ([contribution guide](runbooks/frontend-contribution-guide.md))  
**Looking for status?** → [WORLD_CLASS_IMPLEMENTATION_DASHBOARD](#planning--roadmap) below  
**Need runbooks?** → [Operational Runbooks](#operational-runbooks) below  
**Building a package?** → [Factory Packages](#factory-packages) below

---

## Planning & Roadmap

### Strategic Context
- **[WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md)** — The active implementation plan with 7 tracks, phases, and KPIs. **This is the source of truth for what's being built and why.**
- **[PHASE_6_CHECKLIST.md](../PHASE_6_CHECKLIST.md)** — Infrastructure provisioning runbook (Neon, Hyperdrive, Sentry, PostHog)

### Quality Standards
- **[Design Standards & Rubrics](packages/design-standards.mdx)** — Visual language, accessibility baseline, component patterns
- **[Engineering Quality Rubric](packages/videoking-engineering-baseline.mdx)** — Code review criteria, performance budgets, testing expectations
- **[Frontend Quality Standards](packages/frontend-standards.mdx)** — TypeScript strict mode, component design patterns, testing targets, accessibility (WCAG 2.2 AA), Web Vitals, ESLint config
- **[Frontend Contribution Guide](runbooks/frontend-contribution-guide.md)** — Setup, testing, building, debugging, and deployment for frontend teams
- **[Factory Capabilities Matrix](packages/factory-capabilities-matrix.mdx)** — Decision tree for "build vs. consume", per-package capabilities, Videoking usage patterns
- **[Definition of Ready & Done](runbooks/definition-of-ready-done.md)** — Gates that prevent ambiguous work starts and weak finishes

### User Journeys & Flows
- **[User Journeys & Telemetry](packages/journeys.mdx)** — Critical paths (signup, payment, creator onboarding, etc.) with instrumentation and KPIs

---

## Baseline & Current State

### Application Architecture
- **[videoking Engineering Baseline](packages/videoking-engineering-baseline.mdx)** — Current production app state, component inventory, known issues

### Infrastructure Status
- **[Service Registry](service-registry.yml)** — Cloudflare Workers, Pages projects, URLs, health checks, rename procedures, and Factory Packages inventory (22 packages with status, dependencies, and Videoking usage)
- **[Package Inventory](packages/)** — README and docs for each @adrper79-dot/* package

---

## Process & Governance

### Definition of Work
- **[Definition of Ready & Done](runbooks/definition-of-ready-done.md)** — Checklists that gate work start and completion
- **[Product Quality Review Process](runbooks/product-quality-review.md)** — How design, product, and ops review features before launch

### Releasing & Deploying
- **[Deployment Runbook](runbooks/deployment.md)** — Staging vs. production, smoke tests, health checks, rollback
- **[Environment Isolation & Verification](runbooks/environment-isolation-and-verification.md)** — How config prevents environment mixups

### Managing Secrets & Auth
- **[GitHub Secrets & Tokens Reference](runbooks/github-secrets-and-tokens.md)** — Complete inventory, naming conventions, rotation schedule
- **[Secret Rotation Procedures](runbooks/secret-rotation.md)** — How to rotate JWT, DATABASE_URL, API keys without downtime

### Observability & Incidents
- **[SLO Framework](runbooks/slo-framework.md)** — Core SLO concepts, SLI vs. SLO vs. error budget, quarterly review cadence
- **[Videoking SLO Targets](videoking/slo-targets.md)** — Tier 1 / 2 / 3 SLOs, error budget policy, measurement methods
- **[Error Budget Policy](runbooks/error-budget-policy.md)** — Code freeze triggers, postmortem requirements, seasonal adjustments
- **[SLO Dashboard Template](dashboards/slo-dashboard-template.yaml)** — Grafana/Datadog/CloudWatch panel configs for real-time monitoring
- **[SLO Runbook (Legacy)](runbooks/slo.md)** — Quick reference; see framework above for comprehensive guidance

### RFC & Design Review Process
- **[RFC Process](runbooks/rfc-process.md)** — When to file, review lifecycle, acceptance criteria, status tracking
- **[RFC Template](templates/RFC_TEMPLATE.md)** — Template for filing new RFCs; includes problem, solution, impact, success criteria
- **[Design Review Checklist](runbooks/design-review-checklist.md)** — Accessibility, responsive design, error states, instrumentation requirements
- **[Published RFCs](rfc/)** — Live RFC repository
  - [RFC-001: Payout Batching Fix](rfc/RFC-001-payout-batching-fix.md) — Historical example (implemented March 2026)
  - [RFC-002: Creator Onboarding Journey](rfc/RFC-002-creator-onboarding-redesign.md) — In review; target Q2 2026 ship

### Documentation Ownership
- **[DOCS_OWNERSHIP.md](DOCS_OWNERSHIP.md)** — Who owns each doc, update cadence, how to propose changes

---

## Operational Runbooks

Quick reference for common tasks:

| Task | Runbook |
|------|---------|
| First-time local dev setup | [Getting Started](runbooks/getting-started.md) |
| Add a new standalone app | [Add New App](runbooks/add-new-app.md) |
| Database schema changes | [Database & Migrations](runbooks/database.md) |
| Deploy a Worker or Pages project | [Deployment](runbooks/deployment.md) |
| Rotate a secret (JWT_SECRET, DB_URL, etc.) | [Secret Rotation](runbooks/secret-rotation.md) |
| Transfer an app out of Factory | [App Transfer](runbooks/transfer.md) |
| Common issues & fixes | [Lessons Learned](runbooks/lessons-learned.md) |

---

## Factory Packages

### Foundation Layer

| Package | Purpose | Owner | Status |
|---------|---------|-------|--------|
| [@adrper79-dot/errors](packages/errors/) | Custom error types with context | Factory | Stable |
| [@adrper79-dot/monitoring](packages/monitoring/) | Sentry integration and error reporting | Factory | Stable |
| [@adrper79-dot/logger](packages/logger/) | Structured logging with context | Factory | Stable |

### Platform Layer

| Package | Purpose | Owner | Status |
|---------|---------|-------|--------|
| [@adrper79-dot/auth](packages/auth/) | JWT auth with Web Crypto API | Factory | Stable |
| [@adrper79-dot/neon](packages/neon/) | Neon Postgres via Hyperdrive | Factory | Stable |
| [@adrper79-dot/deploy](packages/deploy/) | Build and deployment automation | Factory | Stable |
| [@adrper79-dot/testing](packages/testing/) | Mock factories and test helpers | Factory | Stable |

### Integration Layer

| Package | Purpose | Owner | Status |
|---------|---------|-------|--------|
| [@adrper79-dot/stripe](packages/stripe/) | Stripe payments and subscriptions | Factory | Phase 3 |
| [@adrper79-dot/llm](packages/llm/) | Anthropic + Grok + Groq chain | Factory | Phase 3 |
| [@adrper79-dot/telephony](packages/telephony/) | Telnyx + Deepgram + ElevenLabs | Factory | Phase 4 |
| [@adrper79-dot/analytics](packages/analytics/) | PostHog + factory_events schema | Factory | Phase 3 |
| [@adrper79-dot/email](packages/email/) | Resend integration | Factory | Phase 3 |
| [@adrper79-dot/video](packages/video/) | Cloudflare Stream + R2 wrappers | Factory | Phase 5 |
| [@adrper79-dot/schedule](packages/schedule/) | Video production calendar + scoring | Factory | Phase 5 |

### Product Layer

| Package | Purpose | Owner | Status |
|---------|---------|-------|--------|
| [@adrper79-dot/compliance](packages/compliance/) | Regulatory standards, consent, audit | Factory | Phase 4 |
| [@adrper79-dot/crm](packages/crm/) | Relationship management surface | Factory | Phase 5 |
| [@adrper79-dot/admin](packages/admin/) | Admin dashboard + analytics | Factory | Phase 4 |
| [@adrper79-dot/content](packages/content/) | Content catalog and distribution | Factory | Phase 5 |
| [@adrper79-dot/copy](packages/copy/) | Copy generation and templates | Factory | Phase 4 |
| [@adrper79-dot/social](packages/social/) | Social sync and publishing | Factory | Phase 5 |
| [@adrper79-dot/seo](packages/seo/) | SEO utilities and metadata | Factory | Phase 4 |

**Status Legend:** Stable = production-ready; Phase N = in development; To Do = not started

---

## The 7 Implementation Tracks

From [WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md):

| Track | Objective | Lead | Key Docs |
|-------|-----------|------|----------|
| T1 | Product + UX Operating System | Product + Design | [Product Quality Review](runbooks/product-quality-review.md), [Journeys](packages/journeys.mdx) |
| T2 | Core App Engineering Excellence | Core App Tech Lead | [Definition of Done](runbooks/definition-of-ready-done.md), [Baseline](packages/videoking-engineering-baseline.mdx) |
| T3 | Monetization + Operator Maturity | Product + Payments | [App README Template](APP_README_TEMPLATE.md) |
| T4 | Factory Platform Enablement | Platform Lead | [Service Registry](service-registry.yml), [Packages](#factory-packages) |
| T5 | Reliability, Security, Observability | Platform + Ops | [SLO](runbooks/slo.md), [Environment Verification](runbooks/environment-isolation-and-verification.md) |
| T6 | Delivery Process & Release Governance | Tech Lead / EM | [Definition of Ready & Done](runbooks/definition-of-ready-done.md), [Deployment](runbooks/deployment.md) |
| T7 | Documentation & Knowledge Mgmt | Tech Writing | [This file](.), [DOCS_OWNERSHIP.md](DOCS_OWNERSHIP.md) |

---

## Finding Docs When You Need Them

### "I'm building a new package for Factory"
1. Check [CLAUDE.md](../CLAUDE.md) Hard Constraints and Standing Orders
2. Review Package Dependency Order in [CLAUDE.md](../CLAUDE.md) to find your position
3. Use [App README Template](APP_README_TEMPLATE.md) as a guide for your package-level README
4. Follow [Definition of Ready & Done](runbooks/definition-of-ready-done.md) for all work
5. Add docs to [packages/{your-package}/README.md](packages/)

### "I'm deploying a Worker or Pages project"
1. Start with [Getting Started](runbooks/getting-started.md) for local setup
2. Use [Deployment](runbooks/deployment.md) to understand staging vs. production
3. Reference [Environment Isolation & Verification](runbooks/environment-isolation-and-verification.md) to ensure right config
4. Add your service to [Service Registry](service-registry.yml) if it's new
5. Follow [Deployment](runbooks/deployment.md) smoke test procedure before prod

### "I'm consuming Factory packages in my app"
1. Start with [Factory Capabilities Matrix](packages/factory-capabilities-matrix.mdx) to find the right packages (decision tree included)
2. Read the per-package consumption guides:
   - **Auth & RBAC:** [auth-consumption-guide.mdx](packages/auth-consumption-guide.mdx)
   - **Database & ORM:** [neon-consumption-guide.mdx](packages/neon-consumption-guide.mdx)
   - **Payments & Subscriptions:** [stripe-consumption-guide.mdx](packages/stripe-consumption-guide.mdx)
   - **Analytics & Events:** [analytics-consumption-guide.mdx](packages/analytics-consumption-guide.mdx)
   - **Error Tracking & Monitoring:** [monitoring-consumption-guide.mdx](packages/monitoring-consumption-guide.mdx)
3. Check [CLAUDE.md](../CLAUDE.md) for Standing Orders and dependency order constraints
4. Follow [Definition of Ready & Done](runbooks/definition-of-ready-done.md) before starting work

### "I need to understand the current product state"
1. Read [WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) for strategic direction
2. Check [videoking Engineering Baseline](packages/videoking-engineering-baseline.mdx) for app-level architecture
3. Review [User Journeys](packages/journeys.mdx) for critical paths and KPIs
4. See [Design Standards](packages/design-standards.mdx) for UI/UX baseline

### "I'm building a frontend application or component"
1. Read [Frontend Quality Standards](packages/frontend-standards.mdx) for design patterns, testing targets, accessibility, and performance gates
2. Follow [Frontend Contribution Guide](runbooks/frontend-contribution-guide.md) for setup, testing, building, and deployment
3. Use [Design Standards](packages/design-standards.mdx) as your design system baseline
4. Run ESLint, type-check, and tests before committing (see contribution guide for commands)
5. Aim for ≥90% test coverage, WCAG 2.2 AA accessibility, and Web Vitals targets (LCP ≤2.5s, CLS <0.1)

### "I'm setting up a new environment or adding secrets"
1. Check [GitHub Secrets & Tokens Reference](runbooks/github-secrets-and-tokens.md) for naming conventions
2. Follow [Secret Rotation](runbooks/secret-rotation.md) if rotating existing secrets
3. Use [Environment Isolation & Verification](runbooks/environment-isolation-and-verification.md) to validate setup

### "Something is broken; what do I do?"
1. Check [Lessons Learned](runbooks/lessons-learned.md) for common errors and solutions
2. Review [SLO & Observability](runbooks/slo.md) for alert classification
3. Find the relevant runbook under [Operational Runbooks](#operational-runbooks)
4. If not listed, file an issue and update this index

---

## Documentation Standards

All docs in this directory follow these standards:

- **Freshness:** Each document has a "Last Updated" date at the top
- **Ownership:** See [DOCS_OWNERSHIP.md](DOCS_OWNERSHIP.md) for who maintains each doc
- **Update Cadence:** See [DOCS_OWNERSHIP.md](DOCS_OWNERSHIP.md) for how frequently each doc is reviewed
- **Link Strategy:** Relative links only; paths are workspace-relative
- **Status Badges:** New docs should indicate Phase (Phase 3, Phase 4, etc.)

---

## Keeping This Index Up to Date

When you:
- **Add a new runbook:** Add it to [Operational Runbooks](#operational-runbooks)
- **Add a new package:** Add it to the [Factory Packages](#factory-packages) table
- **Launch a new app:** Add it to [Service Registry](service-registry.yml)
- **Change a doc location or owner:** Update [DOCS_OWNERSHIP.md](DOCS_OWNERSHIP.md)
- **Update strategic direction:** Update [WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) then back-link here

See [DOCS_OWNERSHIP.md](DOCS_OWNERSHIP.md) for the update cadence and how to propose changes.

---

## Related Standards

- **[CLAUDE.md](../CLAUDE.md)** — Standing Orders, Hard Constraints, Package Dependency Order (the source of truth for Factory design decisions)
- **[START_HERE.md](../START_HERE.md)** — First-time contributor quickstart
