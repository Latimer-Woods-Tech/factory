# W360 Launch-Review UX Governance

**W360-045 · Owner: D01, D03, D12, D13, D14**  
**Status**: Active · Last updated: 2026-04-29

---

## Purpose

No UI surface ships without explicit evidence that journey quality, accessibility, performance, and analytics contracts are met.

This governance document defines:
- Definition of Ready (DoR)
- Definition of Done (DoD)
- Required review artifacts
- Launch review checklist
- Approval policy by risk tier

---

## 1) Definition of Ready (DoR)

A UI change is **ready for implementation** only when all items below are true.

| Gate | Requirement | Evidence |
|---|---|---|
| Journey clarity | Target journey documented with entry/exit conditions and edge cases | Journey spec or scorecard section (`docs/W360-041-JOURNEY-SCORECARDS.md`) |
| Design intent | States defined: loading, empty, error, success, disabled | Design notes or component acceptance criteria |
| Instrumentation plan | Event names + required properties defined | Event schema mapping to `packages/analytics` |
| Accessibility intent | Keyboard flow + semantic structure identified | A11y acceptance notes |
| Performance target | p50/p95 expectations defined | Route-level budget note |
| Rollback safety | Reversible rollout path defined | Rollback note in PR description |

If any DoR gate is missing, implementation should not start.

---

## 2) Definition of Done (DoD)

A UI change is **done** only when all required evidence is attached.

| Category | Required proof |
|---|---|
| Functionality | Journey acceptance test passes on critical paths |
| Accessibility | Axe gate passes with no critical/serious violations |
| Performance | Lighthouse budget passes for selected route(s) |
| Visual stability | Regression gate passes against baseline screenshots |
| Event integrity | Required analytics events emitted with valid schema |
| Observability | Errors include context and are visible in Sentry/logs |
| Documentation | Route/journey docs and launch artifacts updated |
| Rollback readiness | Revert procedure is tested or documented with exact command |

---

## 3) Required launch-review artifacts

Every launch candidate PR must include links to:

1. Journey spec / scorecard section
2. Accessibility report (Playwright + axe artifacts)
3. Performance report (Lighthouse output or CI logs)
4. Visual regression evidence (screenshot diff report)
5. Event contract validation proof
6. Smoke verification proof (`curl` or synthetic monitor)
7. Brand pack (`docs/templates/BRAND_PACK_TEMPLATE.md`) for user-facing surfaces
8. API contract (`docs/templates/openapi/template.yaml`) if route/API changed
9. ADR (`docs/templates/adr/template.md`) when decision is architectural

---

## 4) Launch review checklist (copy into PR)

Use this block in launch PRs:

```md
## Launch Review Checklist (W360-045)
- [ ] Journey spec linked
- [ ] UX states covered: loading / empty / error / success / disabled
- [ ] Accessibility gate passed (axe)
- [ ] Performance budget passed (Lighthouse)
- [ ] Visual regression gate passed (screenshots)
- [ ] Analytics events validated against schema
- [ ] Error paths observable in Sentry/logs
- [ ] Smoke check proof attached (`curl`/synthetic monitor)
- [ ] Brand pack linked (if user-facing)
- [ ] OpenAPI updated (if API changed)
- [ ] ADR linked (if architectural)
- [ ] Rollback command documented and tested
```

---

## 5) Approval policy

- **T1 (critical money/auth/privacy surfaces):** minimum 2 approvals, including relevant discipline owner (D05/D07) and one reviewer from D12 or D14.
- **T2 (high user-facing impact):** minimum 1 approval from lead discipline + passing UI regression gates.
- **T3/T4:** standard review policy.

Reference risk model: `docs/operations/W360_DISCIPLINE_ROUTING_AND_REVIEW_GATES.md`.

---

## 6) CI hooks enforcing this governance

Current CI enforcement points:
- `.github/workflows/ui-regression-gates.yml` (visual/performance/a11y PR gates)
- `.github/workflows/smoke-prime-self.yml` (scheduled production smoke)

Future hardening:
- Add PR checklist enforcement bot for required artifact links.
- Add automated validation that launch PR includes DoR + DoD sections.

---

## 7) Non-compliance policy

If any required artifact is missing or any UI regression gate fails:
- PR remains unmerged.
- Release is deferred.
- Exception requires written approval from D01 + owning discipline lead.
