# Definition of Ready & Definition of Done

**Last Updated:** April 28, 2026

This document establishes explicit gates that prevent ambiguous work starts (Definition of Ready) and enforce high-quality finishes (Definition of Done). These gates apply to all Factory Core packages, shared infrastructure, and app-level feature work.

---

## Why This Matters

**Definition of Ready (DoR)** prevents wasted work: beginning with an unclear success criteria, undefined dependencies, or unmeasured impact wastes both the author's time and the reviewer's time. Ready work has an explicit outcome owner, success metrics, and known implementation surface.

**Definition of Done (DoD)** prevents weak finishes: CI green alone does not equal working production. Done work has been reviewed, tested, documented, verified on staging, and validated against its acceptance criteria.

---

## Definition of Ready

A work item is **Ready** when it satisfies ALL of the following criteria:

### 1. **Outcome Is Explicit** _(not aspirational)_
- [ ] User or operator outcome is stated as a measurable result.
- [ ] NOT ✗: "Improve authentication performance"
- [ ] YES ✓: "Reduce login P99 latency from 850ms to <500ms for the Factory auth package"
- [ ] NOT ✗: "Add better error handling"
- [ ] YES ✓: "Add structured error reporting to Sentry with field-level context for Stripe webhook failures"

### 2. **Owner is Assigned**
- [ ] Clear owner: Factory (package / component) OR app (team + person)
- [ ] Example: "Factory @product-lead" or "videoking @engineering-lead"
- [ ] If cross-team: primary owner assigned; dependencies on secondary owners are named below

### 3. **Dependencies Are Named**
- [ ] List any work that must land first (in `WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md` or backlog)
- [ ] Include external dependencies (e.g., Neon schema migration, Cloudflare config change, GitHub secret)
- [ ] Include inter-package dependencies (e.g., must wait for `@latimer-woods-tech/neon` release)
- [ ] NOTE: See `CLAUDE.md` "Package Dependency Order" for canonical sequencing

### 4. **Success Metrics Are Defined**
- [ ] Metrics are measurable, not qualitative
- [ ] Include acceptance criteria (what makes this "done")
- [ ] Include performance target or SLO if applicable (e.g., "P99 <500ms", ">95% pass rate")
- [ ] Include KPI if product-facing (e.g., "CTR >2%", "error rate <0.1%")
- [ ] Data: specify what gets logged to factory_events or observability tool

### 5. **Design Implications Are Understood**
- [ ] If customer-facing: UI changes documented (wireframe, screenshot, or link to design doc)
- [ ] If package: public API surface defined (JSDoc stubs or interface doc)
- [ ] If shared: interaction with other packages named (e.g., "calls @latimer-woods-tech/logger in hot path")
- [ ] Accessibility impact assessed (required if any UI; form if none)

### 6. **Data Implications Are Understood**
- [ ] Schema changes named (new tables, columns, indexes)
- [ ] Analytics events named (what gets logged to factory_events)
- [ ] PII implications understood (what user data is captured, how it is encrypted/retained)
- [ ] Operator audit trail defined (who needs to be able to review what)

### 7. **Operational Implications Are Understood**
- [ ] Who operates this in production (on-call, support team, product ops, etc.)
- [ ] How is this monitored (alert thresholds, dashboards)?
- [ ] What are the failure modes and recovery steps (runbook stub created)?
- [ ] What are the manual intervention scenarios?
- [ ] If database or async work: drift/deadlock/retry behavior documented

### 8. **Acceptance Tests Are Written or Outlined**
- [ ] Unit test scope defined (% coverage target per package)
- [ ] Integration test scope defined (if affects other packages)
- [ ] Staging test case defined (the curl or UI flow that proves it works)
- [ ] Regression test defined (what should NOT break)

---

## Definition of Done

A work item is **Done** when it satisfies ALL of the following criteria:

### 1. **Code Review Complete**
- [ ] At least 2 approvals (1 domain expert, 1 cross-functional reviewer)
- [ ] OR 1 approval if repo policy permits (check `BRANCH_PROTECTION.md` if it exists)
- [ ] All review suggestions addressed or explicitly deferred with issue link

### 2. **Language & Build Quality**
- [ ] TypeScript strict mode passes (zero errors)
- [ ] No `any` types in public APIs (internal-only `any` must be justified with comment)
- [ ] ESLint passes with `--max-warnings 0` 
- [ ] Build runs clean: `tsup` produces `dist/` with zero errors
- [ ] No suppressions (`@ts-ignore`, `// eslint-disable`) without prior team approval

### 3. **Test Coverage Meets Baseline**
- [ ] Unit test coverage:
  - `@latimer-woods-tech/errors`: 100% lines and functions
  - `@latimer-woods-tech/monitoring`: 100% lines and functions
  - `@latimer-woods-tech/logger`: 95% lines, 90% functions
  - `@latimer-woods-tech/auth`: 95% lines, 90% functions, 85% branches
  - Worker apps: 85% lines, 80% functions, 75% branches
  - UI/dashboard: 70% lines, 70% functions, 60% branches
- [ ] Branch coverage ≥ configured threshold (see package `package.json` `coverage` field)
- [ ] All hot-path code has integration tests (auth, payments, data writes)

### 4. **Integration Tests Added if Multi-Package**
- [ ] If this work touches >1 package: at least one test exercising the boundary
- [ ] Cross-package contract is asserted (e.g., "@latimer-woods-tech/auth calls @latimer-woods-tech/logger correctly")
- [ ] Async workflows tested end-to-end in isolation (e.g., queue → handler → observer)

### 5. **Deployment Verified on Staging**
- [ ] Staging deployment is green (no errors, 0 regressions)
- [ ] Manual curl verification performed: `curl https://{worker-name}.adrper79.workers.dev/health` returns `200`
- [ ] For UI: `curl https://staging.{app-domain}/` returns `200` and loads assets
- [ ] Smoke test performed (happy path + one error case tested manually)
- [ ] If database migration: migration rolled back and re-applied successfully on staging

### 6. **Documentation Updated**
- [ ] README updated (setup, usage, API, breaking changes)
- [ ] JSDoc comments added/updated for all public symbols
- [ ] If new service: entry added to [docs/service-registry.yml](../../service-registry.yml)
- [ ] If new runbook: runbook added to [docs/runbooks/](../)
- [ ] If feature config: link added to relevant guide (product, design, or ops)
- [ ] Changelog entry added to `CHANGELOG.md` (or noted in PR description if one-liners)

### 7. **Changelog Entry Added**
- [ ] Entry added to root `CHANGELOG.md` or package `CHANGELOG.md`
- [ ] Format: `feat(package): description` matching commit format
- [ ] Include breaking changes with migration guidance
- [ ] Include performance impact if significant

### 8. **Design/Product Review Completed** _(if customer-facing)_
- [ ] Design review passed (if any UI changes)
- [ ] Product KPI acceptance: feature meets stated KPI targets from Ready checklist
- [ ] Copy review: all text is on-brand, <8th grade reading level where possible
- [ ] If launch: feature flag / release plan documented

### 9. **Performance Impact Assessed**
- [ ] Performance budget checked:
  - Cold Worker start: <50ms overhead
  - API latency: P99 impact <100ms
  - Bundle size: <50kb added to worker payload
  - Database queries: indexes added if queries ≥ 100k ops/month
  - Memory: no unbounded caches (LRU or TTL-based only)
- [ ] If performance regression: trade-off rationale documented in PR
- [ ] Profiling data captured (time series, not just one-offs)

### 10. **Accessibility Audit Completed** _(if UI changes)_
- [ ] WCAG 2.1 AA checklist passed (keyboard, screen reader, contrast, motion)
- [ ] OR explicit exception with business rationale and remediation date
- [ ] Automated a11y scan passed (`axe` or Lighthouse)
- [ ] Real screen reader test performed on primary flow

### 11. **Security Review Completed** _(if auth/payment/PII affected)_
- [ ] Code reviewed by at least one security-aware engineer if:
  - Touching auth, encryption, key management
  - Handling credit card numbers, SSN, or PII
  - Adding API endpoints or webhook handlers
  - Changing database access patterns
- [ ] OWASP top 10 checklist passed (injection, XSS, CSRF, etc.)
- [ ] Secrets stored in env, not source code
- [ ] Zero known CVEs in dependencies (check `npm audit`)

### 12. **Error & Fallback Cases Tested**
- [ ] Network timeout: request fails gracefully
- [ ] Invalid input: returns 400 (not 500)
- [ ] Database unavailable: returns 503 with retry directive
- [ ] Third-party API down: fallback or error queue used
- [ ] Rate limit: returns 429 with Retry-After header
- [ ] User error: returns 4xx with actionable error message
- [ ] Observability: all errors logged to Sentry with context

---

## CI Gate Enforcement

The following gates are **automated** and block merge if failing:

```yaml
# In .github/workflows/quality-gates.yml (example GitHub Actions)
quality_gates:
  - typecheck: "npm run typecheck"          # TypeScript strict
  - lint: "npm run lint -- --max-warnings 0" # ESLint
  - coverage: "npm run test -- --coverage" # Coverage thresholds
  - build: "npm run build"                  # tsup succeeds
  - deps: "npm audit --audit-level=moderate" # No high/critical CVEs
```

**Merge Rule:** PR cannot merge without ALL gates passing.

**Manual Reminders** in PR template:
- Staging deployment verified with curl
- Documentation updated
- Design review completed (if applicable)
- Security review completed (if applicable)

---

## Deployment Gate Enforcement

Before deploying to production:

```bash
# Pre-deployment checklist (runbook)
1. Staging deployment health check:
   curl https://{worker-name}.adrper79.workers.dev/health

2. Smoke test (manual or scripted):
   - Happy path: at least one full user journey
   - Error case: one failure scenario

3. Database state check (if migrations):
   - Rollback to previous version on staging
   - Verify data is not corrupted
   - Re-apply migration
   - Verify rollback works both directions

4. Alert & monitoring check:
   - Sentry alerting rules active
   - PostHog dashboards loading
   - On-call engineer acknowledged

5. Rollback plan documented:
   - Previous working version ID
   - Known mitigation steps
   - Estimated MTTR
```

**Production Deployment**: Requires the above to be manually verified and signed off (not automated).

---

## PR Template Checklist

Use this markdown snippet in **all** repositories using this framework. It appears in every PR automatically.

```markdown
## Definition of Ready ✓

- [ ] Outcome is explicit (not "improve X", but "reduce to <Y" or "add feature Z with metric M")
- [ ] Owner assigned (Factory lead or app lead + person)
- [ ] Dependencies named (other work, external APIs, secret changes)
- [ ] Success metrics defined (measurable: latency, coverage, KPI, not "looks good")
- [ ] Design implications checked (API surface, UI changes, or "no UI changes")
- [ ] Data implications checked (schema, analytics, PII, or "no data changes")
- [ ] Operational implications checked (monitoring, runbook stub, or "no ops needed")
- [ ] Acceptance tests are designed (unit/integration/staging curl)

## Definition of Done ✓

- [ ] Code review approved (≥2 approvals)
- [ ] TypeScript strict + no `any` in public APIs
- [ ] ESLint passes with `--max-warnings 0`
- [ ] Coverage meets baseline (see package CLAUDE.md)
- [ ] Integration test added (if multi-package)
- [ ] Staging deployment verified: `curl {staging-url}/health` returns 200
- [ ] Docs updated (README, JSDoc, changelog, or runbook)
- [ ] Changelog entry added
- [ ] Design/product review done (if UI changes)
- [ ] Performance budget checked (cold start, latency, bundle size)
- [ ] Accessibility audit done (if UI changes: WCAG 2.1 AA or exception)
- [ ] Security review done (if auth/payment/PII: OWASP checklist)
- [ ] Error cases tested (timeout, invalid input, 3p down, rate limit, user error)

## Notes

_Reviewer: if any box is unchecked but should be checked for this PR, request changes. Do not approve as "best effort" — Definition of Done is binary, not aspirational._
```

---

## Measuring Success

Each Factory Core package and feature team tracks:

1. **DoR Adoption**: % of backlog items meeting all 8 Ready criteria before work starts
2. **DoD Adoption**: % of PRs closed with all 12 Done criteria met
3. **Review Cycle Time**: hours from PR open to first approval
4. **Deployment Frequency**: days from PR merge to staging verification
5. **Rollback Rate**: % of production deployments that required rollback within 24h

**Target State (6 months):**
- DoR Adoption: >85%
- DoD Adoption: >95%
- Review Cycle: <24h median
- Deployment to Staging: <4h median
- Rollback Rate: <2%

---

## Common Exceptions

Some work is smaller or lower-risk and may have abbreviated gates:

### **Hotfix** (production outage)
- DoR: outcome + owner + dependencies only (≥3/8)
- DoD: all gates except design/product review
- Post-incident: full retrospective added to PR within 24h

### **Refactor** (no behavior change, internal only)
- DoR: owner + success metric ("improve type safety" or "reduce cyclomatic complexity") only (≥2/8)
- DoD: code review + typecheck + build + coverage (no staging if no behavior change)

### **Documentation-only**
- DoR: owner + acceptance test (documentation review) only (≥2/8)
- DoD: review + docs + changelog

---

## Related Reading

- [docs/runbooks/product-quality-review.md](product-quality-review.md) — how product reviews happen
- [CLAUDE.md](../../CLAUDE.md) — Standing Orders, Hard Constraints, Quality Gates
- [WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md) — Strategic context
