# W360 Discipline Routing & Review Gates

**W360-038 · Owner: D01 (Coordination) + all discipline leads**  
**Status**: Active · Last updated: 2026-04-29  
**Related**: [WORLD_CLASS_360_TASK_DASHBOARD.md](WORLD_CLASS_360_TASK_DASHBOARD.md) · [ENGINEERING_STANDARDS_CATALOG.md](ENGINEERING_STANDARDS_CATALOG.md)

---

## Purpose

Every W360 item must have:

1. **Lead discipline** — who drives delivery
2. **Reviewer discipline** — who must approve before marking done
3. **Risk tier** — determines required evidence level
4. **Evidence requirements** — what must be demonstrated before status changes to ✅ DONE

This document defines the schema, risk tier definitions, and required approvals for each tier.

---

## Discipline Map

| Code | Discipline | Lead | Examples |
|------|-----------|------|---------|
| D01  | Coordination / Program | @factory-lead | Board updates, sprint planning, decisions |
| D02  | Product / UX | @product-lead | Journey specs, scorecards, feature scope |
| D03  | Design | @design-lead | Components, tokens, brand, accessibility |
| D04  | Frontend | @frontend-lead | React components, Remix routes, CSR/SSR |
| D05  | Auth & Security | @auth-lead | JWT, RBAC, secret management, audits |
| D06  | Infrastructure | @infra-lead | Cloudflare, R2, Neon, Hyperdrive setup |
| D07  | Revenue / Payments | @revenue-lead | Stripe, pricing, credits, refunds |
| D08  | Brand / Content | @brand-lead | Copy, voice, videos, launch assets |
| D09  | Platform / DevX | @platform-lead | Packages, templates, CI, wrangler configs |
| D10  | Observability | @observability-lead | Sentry, PostHog, SLOs, synthetic monitor |
| D11  | AI / LLM | @ai-lead | LLM chains, prompts, narration |
| D12  | Quality / Testing | @quality-lead | Coverage gates, regression, test patterns |
| D13  | Docs / Standards | @docs-lead | ADRs, runbooks, templates, standards |
| D14  | Support / Ops | @support-lead | Runbooks, moderation, incident response |

---

## Risk Tier Definitions

| Tier | Label | Description | Required evidence |
|------|-------|-------------|-------------------|
| **T1** | Critical | Money, auth, data privacy, production data | Code review by lead + D05/D07 co-review; live curl verification; unit tests ≥ 90%; postmortem/ADR if any bug was found in production |
| **T2** | High | User-facing flows, Stripe integration, Worker deploys | Code review by lead; lint + typecheck + test gates pass; smoke test via curl or Playwright |
| **T3** | Standard | Package code, API design, CI config | Code review by lead; lint + typecheck + test gates pass |
| **T4** | Low | Docs, templates, runbooks, board updates | Self-merge with record of update; peer spot-check for correctness |

---

## Per-item routing table

> Abridged. Full board in [WORLD_CLASS_360_TASK_DASHBOARD.md](WORLD_CLASS_360_TASK_DASHBOARD.md).  
> BLOCKED / external-scope items are excluded.

| W360 ID | Lead | Reviewer(s) | Risk tier | Evidence requirements |
|---------|------|-------------|-----------|----------------------|
| W360-001 | D01 | D13 | T4 | Board exists; discipline leads assigned |
| W360-002 | D05 | D07, D09 | T1 | Admin Studio auth: live test — bad creds → 401; JWT flows tested; authz pass |
| W360-003 | D09 | D12 | T2 | Xico City: `npm ci` + `npm test` + `wrangler dev` all green |
| W360-005 | D07, D09 | D05, D12 | T1 | Stripe test-card event → 200 ack; webhook idempotency tested; credit deducted |
| W360-006 | D05 | D01, D12 | T1 | Admin Studio operator: role-safe; authz tests pass; audit trail verified |
| W360-007 | D07, D11 | D05, D09, D12 | T1 | Paid user full render flow; credit deducted; Stream UID returned |
| W360-008 | D04 | D02, D07 | T2 | Dashboard renders plan/credits/videos; billing portal accessible |
| W360-009 | D14, D09 | D07, D05 | T1 | Failed job replay; credit reversal; audit trail; no double-debit |
| W360-010–020 | D09 (Xico leads) | D05 (auth items), D07 (money items), D12 | T1–T2 | Unblocked by W360-003; per-item scope in board |
| W360-021 | D10 | D12, D07 | T3 | Event schemas defined; `assertEventShape()` tested; exported from index |
| W360-022 | D10 | D09, D12 | T3 | SLOs documented; synthetic monitor probes active; journey proxies returning 200 |
| W360-023 | D07, D09 | D05, D12 | T1 | Guardrails in `packages/neon`; 35 tests pass; kill switch tested |
| W360-024 | D09 | D12 | T3 | `/manifest` route on all live workers; manifest schema tested |
| W360-025 | D09 | D10, D12 | T3 | Release-train tracking in Admin Studio; package/worker versions visible |
| W360-026 | D13 | D07, D05 | T2 | ToS/privacy/AUP pages linked from checkout and footer |
| W360-027–029 | D08, D02 | D01 | T2 | Launch package live; public URL returns 200; demo narrative complete |
| W360-031 | D13 | D01 | T4 | App scope registry created; graduation gate matrix defined |
| W360-032 | D13, D09 | D12 | T4 | Worker-basic, ADR, OpenAPI templates created; format validated |
| W360-033 | D13, D09, D12 | D01 | T4 | Standards catalog published; 38 standards with owner/gate/check |
| W360-034 | D09, D12 | D13 | T3 | wrangler.jsonc + package.json normalized; config audit doc updated |
| W360-035 | D09, D12, D13 | D01 | T2 | Each app repo passes 10-point graduation checklist |
| W360-036 | D14, D07, D11, D13 | D01 | T4 | Operator runbook covers 7 failure modes with reversal and audit |
| W360-037 | D03, D04 | D08, D14 | T4 | Brand asset inventory; tokens packaged; design boundaries documented |
| W360-038 | D01 | All leads | T4 | This document; discipline map and risk tiers published |
| W360-039 | D09, D12 | D03, D04 | T3 | `packages/design-tokens` gates pass; token groups documented |
| W360-040 | D09, D12 | D03, D04 | T3 | `packages/ui` gates pass; component API documented |
| W360-041 | D02, D03, D04 | D10, D12 | T3 | Journey scorecards doc published; baseline KPIs defined |
| W360-042 | D04, D09, D12 | D10, D14 | T2 | Playwright/axe/Lighthouse in CI; CI blocks on regression |
| W360-043 | D03, D04, D10 | D02, D12, D14 | T2 | SelfPrime journeys pass scorecard with live evidence |
| W360-044 | D03, D04, D05 | D11, D12 | T2 | Admin Studio UX: role-safe, a11y-clean, auditable |
| W360-045 | D01, D03, D12 | D14 | T4 | Launch-review governance doc; DoR/DoD; launch checklist |
| W360-046 | D09, D10, D11 | D01, D12 | T2 | FRH-01..FRH-10 workstreams active; CI gates verified |

---

## PR Review Policy

### Merge requirements by tier

| Tier | Min approvals | Required reviewers |
|------|--------------|-------------------|
| T1   | 2            | Lead discipline + one of D05/D07 (always for money/auth) |
| T2   | 1            | Lead discipline or delegated reviewer |
| T3   | 1            | Any team member with domain context |
| T4   | 0 (self-merge allowed) | Peer spot-check recommended; record update in board |

### Required CI checks (all tiers)

- TypeScript typecheck — zero errors
- ESLint — zero warnings (`--max-warnings 0`)
- Unit tests — all pass
- Coverage — ≥ 90% lines (where applicable)
- Build — `tsup` produces dist with no errors

### Additional T1 requirements

- Live `curl` verification: health/auth/webhook endpoint returns expected status code
- No `@ts-ignore` or `eslint-disable` in changed files
- ADR opened if this decision has cross-team impact

---

## Evidence documentation format

When marking a W360 item ✅ DONE on the board, the status cell must include:

```
✅ DONE YYYY-MM-DD — [one-line summary of what was delivered].
Evidence: [gate names] ✓. [Any live curl/smoke result if T1/T2].
```

When marking IN PROGRESS:

```
⚡ IN PROGRESS YYYY-MM-DD — [what is done]. Remaining: [what blocks completion].
```
