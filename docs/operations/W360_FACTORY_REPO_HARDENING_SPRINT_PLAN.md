# World Class 360 — Factory Repo Hardening Sprint Plan

**Date:** 2026-04-29  
**Source Plan:** [W360_FACTORY_REPO_HARDENING_PLAN.md](./W360_FACTORY_REPO_HARDENING_PLAN.md)  
**Program Queue Anchor:** [WORLD_CLASS_360_TASK_DASHBOARD.md](./WORLD_CLASS_360_TASK_DASHBOARD.md)
**Issue Pack:** [W360_FACTORY_REPO_HARDENING_ISSUE_PACK.md](./W360_FACTORY_REPO_HARDENING_ISSUE_PACK.md)

---

## 1. Planning Model

This sprint plan operationalizes FRH-01..FRH-10 into five 2-week sprints.

1. Sprint duration: 10 working days.
2. Release mode: weekly staging release, bi-weekly production window.
3. Definition of done per issue:
- implementation merged
- tests passing
- CI gates passing
- docs updated
- rollout + rollback notes attached
- evidence artifact links attached

---

## 2. Team Lanes

| Lane | Scope | Primary disciplines |
|---|---|---|
| Control Plane | Admin Studio routes, service mapping, deploy actions | D05, D09, D11, D12 |
| Reliability | Synthetic monitor, observability semantics, SLO-aligned checks | D10, D09, D12 |
| Workflow & Release | Publish pipeline, manifest policy, version governance | D09, D12, D13 |
| Documentation Governance | URL policy, service-registry consistency, runbook updates | D13, D09, D10 |

---

## 3. Sprint-by-Sprint Execution

## Sprint 1 (Weeks 1-2): Risk Removal First

**Goal:** eliminate false control-plane signals and fake deployment outcomes.

### In Scope
1. FRH-01 Service Registry Correctness
2. FRH-02 Deploy Command-Plane Integrity
3. FRH-03 URL Governance Automation
4. FRH-04 Smoke Contract Unification (phase 1: canonical contract + deprecation warning)

### Entry Criteria
1. W360-046 active with named owners.
2. CI branch protections on for affected paths.

### Exit Criteria
1. Fan-out/crawler URL resolution tests pass.
2. Deploy execute path returns real run IDs for staging dispatch.
3. URL lint rule blocks non-canonical workers.dev references.
4. Smoke contract validator enabled in CI.

### Evidence Required
1. Test report links for routing/dispatch.
2. One staging deploy run URL + audit log row.
3. URL lint CI artifact showing zero violations.

---

## Sprint 2 (Weeks 3-4): Pipeline Determinism

**Goal:** make monitoring and publishing deterministic.

### In Scope
1. FRH-05 Monitor Target Generation
2. FRH-06 Publish Workflow Hardening
3. FRH-04 Smoke Contract Unification (phase 2: remove legacy aliases)

### Exit Criteria
1. Generated target manifest replaces static long JSON var source of truth.
2. Publish workflow passes actionlint and invalid-tag negative tests.
3. Legacy smoke aliases removed from tests and workflows.

### Evidence Required
1. Generated target manifest artifact + schema validation output.
2. Publish dry-run execution logs.
3. Smoke workflow run proving canonical secrets only.

---

## Sprint 3 (Weeks 5-6): Test and Signal Trust

**Goal:** increase confidence in regression and observability signals.

### In Scope
1. FRH-07 Regression Gate Trust
2. FRH-09 Observability Failure Semantics

### Exit Criteria
1. Pixel-based visual diff implemented and baseline process documented.
2. Observability APIs distinguish degraded provider states from empty data.
3. Alert events emitted on provider outages.

### Evidence Required
1. Visual diff artifacts from changed route.
2. Integration tests for provider-failure semantics.
3. Dashboard screenshot showing degraded-state handling.

---

## Sprint 4 (Weeks 7-8): Policy and Docs Alignment

**Goal:** lock governance and endpoint truth-source consistency.

### In Scope
1. FRH-08 Version Policy Enforcement
2. FRH-10 Docs and Registry Consistency

### Exit Criteria
1. Version policy ratified and lint-enforced.
2. Endpoint scanner runs in CI report mode then blocking mode.
3. VideoKing reference-only status consistently represented in docs.

### Evidence Required
1. Dependency policy report.
2. Docs consistency report with zero unresolved conflicts.
3. PR links for template and runbook updates.

---

## Sprint 5 (Weeks 9-10): Program Hardening and Closeout

**Goal:** validate end-to-end readiness and operationalize ongoing maintenance.

### In Scope
1. Regression hardening from sprint retros.
2. CI gate tuning and false-positive control.
3. Final hardening closeout package.

### Exit Criteria
1. All FRH-01..FRH-10 marked complete or accepted with explicit residual risk.
2. All new gates stable for at least two release cycles.
3. Closeout report delivered to W360 dashboard.

### Evidence Required
1. Two consecutive green release trains.
2. Rollback drills for deploy and docs-registry checks.
3. Final sign-off from platform lead + EM.

---

## 4. Risk Register

| Risk | Trigger | Mitigation | Owner |
|---|---|---|---|
| CI false positives block velocity | New lint/scanner rules too strict | Start in report-only mode; promote to blocking after tuning | D09 |
| Deploy API integration destabilizes control plane | Dispatch path errors in production | Feature flag execute mode; dry-run fallback | D05 |
| Smoke credential migration breaks CI | Secret names not rotated in all workflows | Add transition checklist + one sprint overlap | D12 |
| Docs scanner generates noise | Ambiguous endpoint examples in narrative docs | allowlist + severity tagging by folder | D13 |

---

## 5. Board Columns (Recommended)

1. Backlog (ready)
2. In progress
3. In review
4. In staging verification
5. In production verification
6. Done (evidence attached)

---

## 6. Weekly Ceremony Checklist

1. Review blocked items and dependency chain.
2. Confirm evidence completeness for completed issues.
3. Track CI gate false positive rate.
4. Review rollout safety and rollback readiness.
5. Update W360 dashboard status in one place.

---

## 7. Deferred End-of-Sequence Feature

After Sprint 5 closeout, append FRH-11 only:

1. FRH-11: Admin console end-to-end update orchestration.
2. Start gate: FRH-01..FRH-10 complete (or accepted residual risk sign-off).
3. This preserves the original hardening-first plan and avoids scope contention during risk-removal sprints.
