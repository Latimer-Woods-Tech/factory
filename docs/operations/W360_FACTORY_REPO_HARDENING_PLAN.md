# World Class 360 — Factory Repo Hardening Plan

**Date:** 2026-04-29  
**Status:** Proposed for immediate activation  
**Parent Dashboard:** [WORLD_CLASS_360_TASK_DASHBOARD.md](./WORLD_CLASS_360_TASK_DASHBOARD.md)  
**Canonical Program:** [../../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md](../../WORLD_CLASS_IMPLEMENTATION_DASHBOARD.md)
**Execution Sprint Plan:** [W360_FACTORY_REPO_HARDENING_SPRINT_PLAN.md](./W360_FACTORY_REPO_HARDENING_SPRINT_PLAN.md)
**Issue Template:** [.github/ISSUE_TEMPLATE/w360-hardening-workstream.md](../../.github/ISSUE_TEMPLATE/w360-hardening-workstream.md)
**Issue Pack:** [W360_FACTORY_REPO_HARDENING_ISSUE_PACK.md](./W360_FACTORY_REPO_HARDENING_ISSUE_PACK.md)

---

## 1. Purpose

This plan converts the deep-dive findings into a mature, execution-ready engineering program.  
It is scoped to eliminate governance drift, deployment ambiguity, observability blind spots, and test confidence gaps across Factory control-plane and shared platform repos.

---

## 2. Program Outcomes

By completion, Factory must be able to prove all of the following:

1. Control-plane service discovery and health fan-out reflect real deployed targets.
2. Deploy APIs perform real actions with audit evidence, dry-run behavior, and rollback playbooks.
3. URL, environment, and endpoint conventions are enforced in docs and CI.
4. Smoke-test credential contracts are singular, deterministic, and fail-fast.
5. Synthetic monitors are generated from canonical service metadata instead of ad-hoc static blobs.
6. Publish and release workflows are deterministic and self-validating.
7. Visual regression and performance gates are technically trustworthy.
8. Dependency/version policy is explicit and machine-enforced.
9. Observability proxy failures are surfaced as actionable operational signals.
10. Service registry and route docs remain synchronized through automation.

---

## 3. Engineering Standards for This Plan

1. Every workstream ships with Definition of Ready and Definition of Done.
2. Every risky change is shipped behind either feature flags, dry-run gates, or staged rollout.
3. Every production-affecting change includes explicit rollback commands and a tested rollback path.
4. Every control-plane/API change must include contract tests and at least one integration smoke.
5. Every docs/process change that affects operations must include CI enforcement.
6. No hidden success criteria: each workstream has objective exit checks.

---

## 4. Workstream Map

| ID | Priority | Theme | Mapped finding | Owner disciplines | Target sprint |
|---|---|---|---|---|---|
| FRH-01 | P0 | Service registry correctness | Admin Studio fan-out targets mismatch deployed workers | D05, D09, D10, D12, D13 | Sprint 1 |
| FRH-02 | P0 | Deploy command-plane integrity | Deploy route queues fake runs (no dispatch) | D05, D09, D11, D12 | Sprint 1 |
| FRH-03 | P0 | URL governance automation | workers.dev format drift in templates/docs | D09, D13, D12 | Sprint 1 |
| FRH-04 | P1 | Smoke contract unification | Dual smoke credential schemas | D12, D09, D13 | Sprint 1-2 |
| FRH-05 | P1 | Monitor target generation | Static TARGETS_JSON drift | D10, D09, D05, D13 | Sprint 2 |
| FRH-06 | P1 | Publish workflow hardening | PACKAGE resolution fragility | D09, D12 | Sprint 2 |
| FRH-07 | P1 | Regression gate trust | Heuristic visual diff + broad lint suppression | D12, D04 | Sprint 2-3 |
| FRH-08 | P2 | Version policy enforcement | Exact-pin policy drift | D09, D13, D12 | Sprint 3 |
| FRH-09 | P2 | Observability failure semantics | Empty-success payloads on provider failures | D10, D05, D12 | Sprint 3 |
| FRH-10 | P2 | Docs/registry consistency | Conflicting VideoKing endpoint narratives | D13, D09, D10 | Sprint 3 |

---

## 5. Detailed Workstreams

## FRH-01 — Service Registry Correctness

**Problem**  
Control-plane app registry and fan-out logic currently assume worker names that do not consistently match deployed targets across environments.

**Implementation**
1. Introduce canonical runtime service map generated from docs/service-registry.yml.
2. Replace hand-maintained environment worker names in app-registry module with generated artifacts.
3. Add CI check that compares generated map to control-plane registry code and fails on drift.
4. Add pre-merge integration test that validates computed health/manifest URLs against approved naming patterns.

**Acceptance Criteria**
1. Admin Studio health fan-out targets resolve to deployed workers for both staging and production.
2. Smoke catalog endpoint URLs derive from the same source map as health fan-out.
3. Registry drift check runs in CI and blocks merge when mismatched.

**Verification**
1. Unit tests for registry URL builders.
2. Integration tests for fan-out route and catalog route URL resolution.
3. Live verification: direct health and manifest checks return expected status codes.

**Rollback**
1. Revert generated map commit.
2. Restore previous static map.
3. Re-run smoke and fan-out tests.

---

## FRH-02 — Deploy Command-Plane Integrity

**Problem**  
Deploy endpoint returns queued metadata without dispatching a workflow, creating false operator confidence.

**Implementation**
1. Implement GitHub workflow dispatch integration with strict input validation.
2. Require signed and auditable operator context for production dispatch.
3. Persist deployment audit rows with request ID, actor, environment, workflow, and result state.
4. Add idempotency key handling to prevent duplicate dispatches.
5. Return upstream run id/url only on successful dispatch response.

**Acceptance Criteria**
1. Dry-run and execute modes are behaviorally distinct and test-covered.
2. Production dispatch requires owner role and explicit confirmation payload.
3. Failed dispatch returns actionable error contract and does not emit queued success response.

**Verification**
1. Unit tests for role gating, env gating, and payload validation.
2. Integration tests using mocked GitHub API responses.
3. One end-to-end staging dispatch with run URL proof.

**Rollback**
1. Feature-flagged route fallback to dry-run only.
2. Disable execute mode while preserving read-only deploy history.

---

## FRH-03 — URL Governance Automation

**Problem**  
workers.dev short-form URL patterns are reappearing in docs/templates despite standing rules.

**Implementation**
1. Create doc lint rule for canonical account-scoped workers.dev patterns.
2. Add check to block short-form URLs in markdown, YAML, and template assets.
3. Run one-time migration script to normalize existing references.
4. Add policy tests for app readme template and environment verification runbooks.

**Acceptance Criteria**
1. No short-form workers.dev references remain in active docs/templates.
2. CI fails if new short-form references are introduced.

**Verification**
1. Regex scan job in CI.
2. Periodic docs freshness pipeline includes URL normalization audit.

**Rollback**
1. Revert doc lint rule only if false-positive rate is unacceptable.
2. Keep migration patch; adjust rule exceptions with explicit allowlist.

---

## FRH-04 — Smoke Contract Unification

**Problem**  
Smoke tests currently support mixed secret names, causing inconsistent coverage.

**Implementation**
1. Define single canonical secret contract for all authenticated smoke tests.
2. Remove legacy alias code paths after transition window.
3. Add startup guard that fails CI immediately when required secrets are missing.
4. Align workflow docs and secrets runbook with the same contract.

**Acceptance Criteria**
1. Exactly one smoke credential schema exists in tests and workflows.
2. Contract tests fail fast when required env vars are absent.

**Verification**
1. Unit tests for credential contract validator.
2. CI smoke workflow dry-run with masked env checks.

**Rollback**
1. Restore alias fallback temporarily behind explicit deprecation flag.
2. Publish migration notice and re-cut contract deadline.

---

## FRH-05 — Monitor Target Generation

**Problem**  
Synthetic monitor targets are embedded as large static JSON values, which drift from actual service state.

**Implementation**
1. Generate monitor targets from canonical service registry + journey SLO map.
2. Store generated monitor configuration as versioned artifact.
3. Add schema validation for target list shape and URL policy.
4. Split liveness probes from journey probes with separate severity levels.

**Acceptance Criteria**
1. No manually-curated long JSON target blob remains in Wrangler vars.
2. Monitor target generation is reproducible and CI-verified.

**Verification**
1. Unit tests for generator and schema validation.
2. Scheduled monitor job confirms expected target count and IDs.

**Rollback**
1. Revert to previous static set with clear degraded mode marker.
2. Keep generator code for iterative hardening.

---

## FRH-06 — Publish Workflow Hardening

**Problem**  
Tag-to-package resolution in publish workflow has fragility and static-analysis warnings.

**Implementation**
1. Resolve package once in a guarded script step and export deterministic job output.
2. Use workflow outputs to drive install/build/publish steps.
3. Add validation that package path exists and contains expected package name.
4. Add workflow unit test via actionlint and shellcheck in CI.

**Acceptance Criteria**
1. Publish workflow passes actionlint with zero context warnings.
2. Invalid tags fail early with clear operator message.

**Verification**
1. Test tags in dry-run workflow path.
2. Real publish of a non-critical package in staging pipeline.

**Rollback**
1. Revert to prior workflow version and pause release train.
2. Re-run previous known-good publish command path.

---

## FRH-07 — Regression Gate Trust

**Problem**  
Visual regression currently uses file-size heuristics and broad lint suppressions.

**Implementation**
1. Replace heuristic screenshot comparator with deterministic pixel-based diff library path.
2. Remove blanket file-level lint disables; scope any unavoidable exception lines with justification.
3. Define deterministic thresholds per route/profile and store baseline metadata.
4. Add route-level visual-gate evidence artifact uploads in CI.

**Acceptance Criteria**
1. Visual diff engine compares decoded pixels, not file size.
2. Lint suppressions are minimal and justified inline.
3. Baseline update process is documented and review-gated.

**Verification**
1. Unit tests for comparator.
2. CI run showing diff artifact generation and threshold pass/fail behavior.

**Rollback**
1. Feature-flag old comparator for one release window.
2. Disable visual gate blocking while preserving artifact generation.

---

## FRH-08 — Version Policy Enforcement

**Problem**  
Declared policy on pinning vs ranges is inconsistent with package manifests.

**Implementation**
1. Ratify policy in one canonical ADR-style doc.
2. Add package manifest lint rule that enforces policy by dependency scope.
3. Run one-time normalization update and lockfile refresh.
4. Add Renovate alignment to prevent policy regressions.

**Acceptance Criteria**
1. Single explicit policy documented and referenced by templates.
2. CI blocks manifest changes that violate policy.

**Verification**
1. Repo-wide dependency audit report.
2. Successful clean install and lockfile consistency checks.

**Rollback**
1. Temporarily relax lint rule to warn-only if migration blast radius is too large.
2. Complete staged remediation by package group.

---

## FRH-09 — Observability Failure Semantics

**Problem**  
Observability proxy routes can return structurally successful payloads while upstream provider calls fail.

**Implementation**
1. Standardize error envelope with severity, provider status, retryability, and degraded-state marker.
2. Emit internal alert events on provider failure thresholds.
3. Add client-facing status fields so UI can distinguish empty data from unavailable data.
4. Add circuit-breaker and timeout budgets for third-party provider calls.

**Acceptance Criteria**
1. Provider failures are explicit and machine-detectable in API responses.
2. UI displays degraded state instead of silent empty success.

**Verification**
1. Integration tests with simulated Sentry/PostHog failures.
2. Alert-event emission tests and dashboard confirmation.

**Rollback**
1. Keep old response shape as compatibility mode for one release.
2. Provide dual fields until UI consumers migrate.

---

## FRH-10 — Docs and Registry Consistency

**Problem**  
Service registry and endpoint docs present conflicting statements for some surfaces, especially VideoKing references.

**Implementation**
1. Declare docs/service-registry.yml as canonical endpoint authority.
2. Build consistency checker that scans docs for endpoint references and compares to registry.
3. Add “reference-only surface” metadata and lint checks to prevent accidental live endpoint claims.
4. Introduce release checklist gate requiring registry and docs consistency pass.

**Acceptance Criteria**
1. Endpoint reference scanner reports zero unresolved conflicts.
2. Reference-only apps cannot be documented as live endpoints without explicit override process.

**Verification**
1. CI consistency report artifact.
2. Manual review of updated docs set for VideoKing and related runbooks.

**Rollback**
1. Disable blocking mode and run in report-only mode if false positives occur.
2. Maintain allowlist with owner-approved exceptions.

---

## 6. Governance and Execution Model

## Issue Tracking

All FRH work must be opened using the hardening issue template to ensure consistent risk controls, rollout planning, and evidence capture.

1. Use [w360-hardening-workstream.md](../../.github/ISSUE_TEMPLATE/w360-hardening-workstream.md) for every FRH-01..FRH-10 issue.
2. Include FRH ID and parent W360 item in every issue title/body.
3. Do not mark done without evidence links populated in the template.

## Cadence

1. Weekly program review: risk burn-down, blocker removal, evidence review.
2. Twice-weekly engineering standup for FRH P0/P1 items.
3. End-of-sprint architecture and reliability review.

## RACI (Program-Level)

| Function | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| Workstream delivery | Track leads (Dxx) | Platform lead + EM | Security, Product, Ops | All engineers |
| CI gate definitions | DevOps + QA | Platform lead | App leads | All engineers |
| Docs consistency and templates | Tech writing | EM | Platform lead | All engineers |
| Release decision | EM + Tech Lead | Owner group | SRE/Ops | Stakeholders |

## Quality Gates

1. Typecheck, lint, tests, build all pass.
2. New/changed routes include contract tests.
3. Operational routes include smoke checks and audit logs.
4. Docs and service registry consistency checks pass.
5. Live endpoint verification evidence is attached before status promotion.

---

## 7. 30/60/90 Delivery Plan

## First 30 days

1. Deliver FRH-01, FRH-02, FRH-03, FRH-04.
2. Launch CI gates for URL policy and smoke contract validation.
3. Complete one staging deployment cycle proving dispatch + audit + smoke.

## Days 31-60

1. Deliver FRH-05, FRH-06, FRH-07.
2. Move synthetic targets to generated source and stabilize visual gate engine.
3. Complete publish workflow hardening and release drill.

## Days 61-90

1. Deliver FRH-08, FRH-09, FRH-10.
2. Lock dependency policy enforcement.
3. Ship docs/registry consistency scanner in blocking mode.

---

## 8. Exit Evidence Package

The hardening plan is complete only when all evidence below is available:

1. CI run links proving all new enforcement jobs pass.
2. Staging and production smoke evidence for affected control-plane routes.
3. Audit trail exports for deploy dispatch execution.
4. Synthetic monitor generated target manifest and successful run output.
5. Visual regression artifact samples showing deterministic diff behavior.
6. Docs consistency report with zero unresolved conflicts.

---

## 9. Change Management

All major scope changes to this plan require:

1. Issue with rationale and risk assessment.
2. Approval from platform lead and EM.
3. Update to this plan and parent dashboard with date-stamped note.

---

## 10. Deferred Feature Ordering

To preserve original hardening sequencing, the "full admin-console update orchestration" feature is explicitly deferred until after FRH-01..FRH-10 closeout.

1. Track as FRH-11.
2. Do not start FRH-11 until FRH-01..FRH-10 have completion evidence or accepted residual risk sign-off.
