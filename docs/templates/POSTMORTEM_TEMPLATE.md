---
title: Postmortem Template
description: Structure for documenting incidents, analyzing root causes, and capturing action items.
---

# Incident Postmortem Template

**Copy this template after every P1 or P2 incident (within 24 hours of resolution).**

---

## Incident Summary

| Field | Value |
|-------|-------|
| **Incident ID** | INCIDENT-2026-04-28-001 (auto-generated) |
| **Date/Time** | 2026-04-28, 14:22 UTC to 14:47 UTC (25 min) |
| **Severity** | P1 / P2 / P3 |
| **Service** | videoking (or relevant service) |
| **Detection Method** | Sentry alert / Customer report / Monitoring dashboard |
| **Detected by** | [Name] |
| **Severity Reason** | [Brief reason: revenue down, auth broken, etc.] |

---

## Impact

### Scope
- **Users affected:** ~50,000 (25% of active users)
- **Duration:** 25 minutes (14:22–14:47 UTC)
- **Region:** Global (if applicable, list specific regions)

### Financial Impact
- **Revenue lost:** ~$12,000 (estimated; based on avg transaction value × failed transactions)
- **Refunds issued:** $0
- **SLA credits issued:** $500 (to 3 customers)

### Operational Impact
- **Support tickets:** 42 received during incident
- **Customer escalations:** 1 director-level call
- **External comms:** Posted to status page at 14:24 UTC

### Data Loss
- **Data affected:** None
- **Data corruption:** None
- **Backups verified:** Yes, automated restore test passed

---

## Timeline

**2026-04-28 14:20 UTC** — Bad deploy merged to main
- Author: jane@factory.local
- Commit SHA: `abc1234def567`
- Files changed: `src/payment/process.ts` (added new validation rule)

**2026-04-28 14:22 UTC** — Alert fires in Sentry
- Error: `ValidationError: amount must be positive integer`
- Error rate: 45% (5% threshold exceeded)
- Alert latency: 2 minutes from deploy

**2026-04-28 14:22 UTC** — PagerDuty pages on-call
- Primary: john@factory.local
- Ack time: 1 minute
- Incident channel created: `#incident-2026-04-28-1422`

**2026-04-28 14:24 UTC** — RCA hypothesis formed
- Triage identified new deployed code as culprit
- Status page updated to "Investigating"

**2026-04-28 14:27 UTC** — Rollback decision made
- Author: john@factory.local
- Command: `wrangler rollback --message "Revert bad payment validation"`
- Rollback time: 3 minutes

**2026-04-28 14:30 UTC** — Rollback verified
- Health check: 200 OK
- Error rate dropping to <0.1%

**2026-04-28 14:35 UTC** — Status page updated to "Resolved"

**2026-04-28 14:47 UTC** — All systems nominal
- Error rate: 0.05% (baseline)
- Support team begins response to 42 tickets

---

## Root Cause Analysis

### What Happened?

The `payment/process.ts` file was updated to validate that transaction amounts are positive integers. However, due to a type coercion bug, amounts like `"10.99"` (strings) were being rejected, even though the API contract accepts strings.

### Why Did It Happen?

**Contributing factors (list 3–5):**

1. **Insufficient test coverage:** No test case existed for string amounts (only integers were tested)
2. **Inadequate code review:** Reviewer didn't catch the type coercion in the validation function
3. **No staging validation:** Unit tests passed, but integration tests (hitting real payment processor) were skipped
4. **Late code change:** Validation rule was added in last commit before deploy (not reviewed in PR review window)
5. **No pre-deploy check:** Pre-deployment test suite didn't include payment integration tests

### Root Cause (5 Whys)

- **Q1:** Why did the deploy break payment processing?
  - A: New validation rule was too strict
- **Q2:** Why was the validation rule too strict?
  - A: Type coercion bug: string amounts were rejected
- **Q3:** Why wasn't this caught in testing?
  - A: Test suite only tested integer amounts, not strings
- **Q4:** Why don't we test with actual request formats?
  - A: Integration tests were excluded from pre-deploy check
- **Q5:** Why are integration tests optional?
  - A: They're slow (30s); CI only runs fast unit tests (5s)

**Root cause identified:** Incomplete test coverage + decision to skip slow tests pre-deploy

---

## Resolution

### Immediate Fix (What We Did)

Reverted commit `abc1234def567` via CloudFlare Rollback (3 min, fully recovered).

### Permanent Fix (What We'll Do)

1. **Add test case:** String amount validation in `test/payment-validation.test.ts`
2. **Update pre-deploy check:** CI now runs integration tests (even though slower) for payment module
3. **Type safety:** Convert validation function to use stricter types (reject JSON strings in types)
4. **Code review:** Require reviewer sign-off even on "simple" validation changes (suggested in PR template)

---

## Action Items

| # | Action | Owner | Priority | Target Date | Status |
|---|--------|-------|----------|-------------|--------|
| 1 | Add string amount test case | jane@factory.local | P0 (blocking) | 2026-04-29 EOD | Assigned |
| 2 | Enable integration tests in CI pre-deploy | devops@factory.local | P0 (blocking) | 2026-04-30 EOD | To do |
| 3 | Update payment validation review checklist | john@factory.local | P1 | 2026-05-01 EOD | To do |
| 4 | Type audit: payment processing (all endpoints) | jane@factory.local | P1 | 2026-05-15 | To do |
| 5 | Post incident learnings to team Slack | john@factory.local | P2 | 2026-04-28 EOD (now) | To do |
| 6 | Schedule Q2 incident drills (quarterly) | ops@factory.local | P3 | 2026-05-01 | To do |

---

## Blameless Culture Notes

- This was a **systems failure**, not a personnel failure
- Jane followed existing process; the process was missing safeguards
- John performed rollback correctly and quickly
- Team responded excellently under pressure

**What went well:**
- Fast detection (2 min from deploy)
- Fast rollback (3 min decision, 3 min execution)
- Clear communication to customers

**What to improve:**
- Test coverage gaps (this is a systems fix, not a person issue)
- CI pipeline speed (decide whether to slow CI down or parallelate)

---

## Follow-Up

- **Postmortem Sync:** Scheduled 2026-04-29 10:00 UTC (agenda: agree on action item priorities, assign owners, identify any process risks)
- **Team Debrief:** All-hands follow-up at weekly sync (learn from incident, share with wider team)
- **Documentation:** Update [Definition of Ready & Done](../../runbooks/definition-of-ready-done.md) if needed

---

## Appendix: Additional Data

### Error Log Sample

```
ERROR: payment.process: Validation failed
  Input: { amount: "10.99", currency: "USD", user_id: 123 }
  Error: amount must be positive integer
  Stack:
    at validateAmount (src/payment/validate.ts:45)
    at processPayment (src/payment/process.ts:12)
    at POST /api/payment/process (src/routes/payment.ts:5)
  Timestamp: 2026-04-28T14:22:15Z
  Request ID: req-xyz789
```

### Deployment Diff

```diff
--- a/src/payment/validate.ts
+++ b/src/payment/validate.ts
@@ -42,7 +42,7 @@ export function validateAmount(amount: string | number): number {
-  const num = parseFloat(String(amount));
+  const num = parseInt(String(amount), 10); // BUG: rejects decimal strings
   if (!Number.isInteger(num)) throw new ValidationError("amount must be positive integer");
   if (num <= 0) throw new ValidationError("amount must be > 0");
   return num;
```

### Monitoring Dashboard (Snapshots at Key Times)

- **14:20 UTC (before):** Error rate 0.02%, latency p99 120ms
- **14:22 UTC (detection):** Error rate 45%, latency p99 2000ms
- **14:30 UTC (rollback):** Error rate 0.1%, latency p99 150ms
- **14:40 UTC (stable):** Error rate 0.03%, latency p99 110ms (baseline restored)

---

## Approvals

- **On-call:** john@factory.local ✓
- **Tech lead:** jane@factory.local ✓
- **Product lead:** alice@factory.local ✓
- **Ops lead:** bob@factory.local ✓

**Postmortem Date:** 2026-04-29, 10:00 UTC

---

## Related Docs

- [Incident Response Playbook](incident-response-playbook.md) — How incidents are triaged
- [Postmortem Sync Agenda](postmortem-sync-agenda.md) — Follow-up meeting structure
- [Rollback Runbook](rollback-runbook.md) — How to quickly revert bad deploys
- [Definition of Ready & Done](../../runbooks/definition-of-ready-done.md) — Process improvements from this incident may update this
