# W360 Factory Repo Hardening — Issue Pack (FRH-01..FRH-10)

**Date:** 2026-04-29  
**Template:** [../../.github/ISSUE_TEMPLATE/w360-hardening-workstream.md](../../.github/ISSUE_TEMPLATE/w360-hardening-workstream.md)  
**Source:** [W360_FACTORY_REPO_HARDENING_PLAN.md](./W360_FACTORY_REPO_HARDENING_PLAN.md)

Use this file to open one GitHub issue per FRH workstream with consistent scope, controls, and evidence.

---

## FRH-01

- Title: `[FRH-01] Canonical service-map generation for control-plane URL resolution`
- Priority: P0
- Parent: W360-046
- Sprint: 1
- Acceptance highlights:
  1. health/catalog URL derivation comes from canonical generated map.
  2. drift check blocks merge.
  3. staging/prod URL resolution tests pass.

## FRH-02

- Title: `[FRH-02] Implement real deploy dispatch with auditable dry-run/execute modes`
- Priority: P0
- Parent: W360-046
- Sprint: 1
- Acceptance highlights:
  1. execute mode dispatches workflow and returns run metadata.
  2. production dispatch owner-gated with confirmation.
  3. failed dispatch cannot return queued success payload.

## FRH-03

- Title: `[FRH-03] Enforce canonical workers.dev URL policy in docs and templates`
- Priority: P0
- Parent: W360-046
- Sprint: 1
- Acceptance highlights:
  1. short-form workers.dev references removed from active docs/templates.
  2. CI lint blocks reintroduction.

## FRH-04

- Title: `[FRH-04] Unify smoke credential contract and remove legacy aliases`
- Priority: P1
- Parent: W360-046
- Sprint: 1-2
- Acceptance highlights:
  1. one canonical smoke secret schema.
  2. CI fail-fast validation for missing vars.
  3. docs + workflow contract fully aligned.

## FRH-05

- Title: `[FRH-05] Generate synthetic monitor targets from canonical service metadata`
- Priority: P1
- Parent: W360-046
- Sprint: 2
- Acceptance highlights:
  1. no long static TARGETS_JSON source-of-truth.
  2. generated target manifest is schema-validated in CI.

## FRH-06

- Title: `[FRH-06] Harden publish workflow package resolution and validation`
- Priority: P1
- Parent: W360-046
- Sprint: 2
- Acceptance highlights:
  1. actionlint clean.
  2. invalid tags fail early and clearly.

## FRH-07

- Title: `[FRH-07] Replace heuristic visual regression comparator with deterministic pixel diff`
- Priority: P1
- Parent: W360-046
- Sprint: 2-3
- Acceptance highlights:
  1. pixel-based diff path in CI.
  2. baseline lifecycle and review policy documented.
  3. broad lint suppressions removed or tightly scoped.

## FRH-08

- Title: `[FRH-08] Ratify and enforce dependency version policy across manifests`
- Priority: P2
- Parent: W360-046
- Sprint: 3
- Acceptance highlights:
  1. policy documented once and referenced everywhere.
  2. CI manifest lint enforcement active.

## FRH-09

- Title: `[FRH-09] Standardize observability degraded-state semantics and provider failure signals`
- Priority: P2
- Parent: W360-046
- Sprint: 3
- Acceptance highlights:
  1. API responses expose degraded status explicitly.
  2. provider-failure alert events emitted.
  3. UI can distinguish empty vs unavailable data.

## FRH-10

- Title: `[FRH-10] Automate docs-to-service-registry endpoint consistency checks`
- Priority: P2
- Parent: W360-046
- Sprint: 3
- Acceptance highlights:
  1. endpoint scanner reports conflicts.
  2. reference-only surfaces cannot be presented as live without override.
  3. release checklist includes consistency gate.

---

## Deferred Feature (Append to End)

After FRH-01..FRH-10 closeout, open:

- Title: `[FRH-11] Admin console end-to-end update orchestration`
- Position: Post-hardening extension (end of sequence)
- Scope:
  1. orchestrate repo edits, deploy dispatch, verification, and rollback from Admin Studio.
  2. include role-safe approvals, dry-run previews, and end-to-end audit trail.
