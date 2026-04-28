# Definition of Ready / Definition of Done

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T6.1 — Define Definition of Ready & Done Quality Gates  
**Reference:** VideoKing + Factory standards

---

## Mission

Prevent ambiguous work starts and weak finishes by establishing **explicit, measurable quality gates** that every feature, bug fix, and infrastructure change must pass. This document standardizes:

- **Definition of Ready (DoR):** Work is shaped and unambiguous before engineers start coding
- **Definition of Done (DoD):** Features are tested, documented, and safe to ship
- **CI/CD Gates:** Automated enforcement (PR template, branch protection rules, workflow checks)

---

## Definition of Ready (DoR)

### Purpose

Work enters a sprint only when:
- Product/design intent is crystal clear
- Acceptance criteria are specific and testable
- Technical approach is understood
- No blocking dependencies

**Benefit:** Stops wasted sprints on ambiguous or ill-shaped work.

### DoR Checklist

**All boxes must be ✅ before PR created.**

#### Product Clarity
- [ ] **Issue/Epic created and linked** — Work has a GitHub issue with:
  - Title (user-facing, not "Fix bug 12345")
  - Description (1–2 paragraphs explaining the "why" and "what")
  - Label (feature / bug / tech-debt / infra)
  - Assignee (who's responsible)

- [ ] **Acceptance criteria specific and testable** — Issue contains:
  - "Given [context], when [user does X], then [observable outcome]" (Gherkin format)
  - At least 3 criteria; all verifiable without ambiguity
  - Example ✅: "When user clicks Subscribe, a modal appears with price + cancellation terms"
  - Example ❌: "Subscribe button should work" (too vague)

- [ ] **Design approved** — If feature has a UI:
  - Figma link in issue
  - Design lead approved (comment: "approved for dev")
  - Rubric checklist completed (accessibility, mobile, consistency)
  - Component specs clear (colors, sizes, states)

- [ ] **No blockers** — Issue explicitly notes:
  - Dependencies (is this blocked by another issue?)
  - External dependencies (API change, third-party service, design decision)
  - Known unknowns (what might we discover during dev?)

#### Technical Clarity
- [ ] **Effort estimated** — Issue contains story points or t-shirt size (XS / S / M / L / XL)
  - XS: 1–4 hours (small bug fix, copy change)
  - S: 4–8 hours (single component, isolated feature)
  - M: 1–2 days (feature + tests + minor refactor)
  - L: 2–3 days (feature + multiple components + docs)
  - XL: 3+ days or splitting is unclear

- [ ] **Tech approach discussed** — Issue includes:
  - Architecture: Will this need a DB change? New endpoint? New component?
  - Platform constraints: Does this work in Workers? Mobile? Admin?
  - Known approach: "Use Factory auth package" or "No auth needed; public endpoint"

- [ ] **Testing strategy sketched** — Issue notes:
  - What needs regression testing? (money-moving? auth? realtime?)
  - Any fixtures or fixtures? (Stripe webhook simulation? DB seed data?)
  - Manual testing needed? (performance? accessibility? A/B test?)

#### Risk Assessment
- [ ] **Risk identified (if any)** —Does this touch:
  - Money? (payouts, subscriptions, unlocks)
  - Auth? (login, permissions, session)
  - Realtime? (chat, polls, reactions)
  - If yes: Marked HIGH_RISK or PAYMENT_CRITICAL; requires additional review

- [ ] **Rollback plan exists** — If risky:
  - Can we roll back without data loss?
  - Any migrations that are hard to reverse?
  - Documented in issue

### DoR Enforcement

**GitHub Automation:**
- PR template includes DoR checklist
- Branch protection rule: Require "ready" label before merge (manually added by PM after DoR met)
- Slack bot watches issues: Reminds team if issue has no design link or acceptance criteria

---

## Definition of Done (DoD)

### Purpose

Code is only considered "done" when:
- Feature works as designed
- All tests pass
- No technical debt introduced
- Team can operate/support it
- Safe to merge without risk

**Benefit:** Prevents broken code from reaching production; enables confident shipping.

### DoD Checklist

**All boxes must be ✅ before code review.**

#### Code Quality
- [ ] **Passes TypeScript strict** — No `any`, no `@ts-ignore`:
  ```bash
  npm run typecheck
  # Exit code 0 (zero errors)
  ```

- [ ] **Passes ESLint with max-warnings 0** — No warnings:
  ```bash
  npm run lint
  # Exit code 0 (zero warnings; no max-warnings exceeded)
  ```

- [ ] **All tests passing** — Unit + integration:
  ```bash
  npm test
  # All tests pass; coverage thresholds met (see below)
  ```

- [ ] **No console errors/warnings** — CI gate checks:
  ```bash
  # During test run: watch for console.error, console.warn
  # Fail test if any found (except expected warnings)
  ```

- [ ] **Follows code standards** —
  - Names are clear (no `x`, `tmp`, `foo`)
  - Functions < 20 lines (logic is simple)
  - Comments on "why", not "what" (code reads like story)
  - No hardcoded values; use constants or config

- [ ] **No performance regressions** —
  - If adding new endpoint: response time < 200ms p95
  - If adding component: Lighthouse score ≥ 85
  - If adding query: EXPLAIN ANALYZE shows reasonable plan

#### Testing
- [ ] **Unit tests for business logic** —
  - Auth: Test protected routes with/without token
  - Money: Test payout calculation, earnings aggregation
  - Validation: Test input validation (empty, invalid, edge cases)
  - Minimum: 90% line coverage, 85% branch coverage

- [ ] **Happy path + sad path tested** —
  - Happy: User does the right thing; feature works
  - Sad: User makes mistake, network error, API down; graceful failure
  - Example: Subscribe flow (happy: success modal) + (sad: payment declined)

- [ ] **Edge cases covered** —
  - Zero values (0 earnings, 0 subscribers)
  - Boundary values (max file size at limit + 1 byte over)
  - Concurrency (two requests at same time; race conditions?)
  - Example subscriptions: First renewal, expired, duplicate

- [ ] **Integration test for public flows** —
  - Viewer signup → watch video → subscribe
  - Creator upload → publish → check earnings
  - Admin payout review → execute → verify DLQ empty
  - At minimum: Happy path end-to-end works

- [ ] **Database changes tested** —
  - Migrations run without error
  - Rollback works (if needed)
  - No N+1 queries (Drizzle query cache validated)
  - Indexes applied (long queries explained)

- [ ] **Error cases tested** —
  - Invalid input: Validation errors returned
  - Permission denied: Correct 403/401 responses
  - Not found: 404 responses
  - Server error: 500 with corrected error tracking (Sentry)

#### Security & Privacy
- [ ] **Auth/permissions vetted** —
  - Public endpoints are intentionally public (no data leakage)
  - Protected endpoints require correct token/scope
  - Admin endpoints limited to admin role only
  - No hardcoded auth tokens or secrets in code

- [ ] **Secrets not in code** — Run check:
  ```bash
  git diff --cached | grep -iE 'password|token|key|secret|api_key'
  # Should return 0 matches
  ```

- [ ] **PII logged safely** — If logging user data:
  - Never log full credit card, password, or email
  - Hash PII before logging (SHA256 OK; never reversible)
  - Log only what's needed for debugging

- [ ] **OWASP top 10 not violated** —
  - SQL injection: Use parameterized queries (Drizzle safe)
  - XSS: All output escaped (React safe; Markdown stripped)
  - CSRF: POST/PUT/DELETE requires CSRF token
  - No direct object references (user can't access other user's data)

#### Documentation
- [ ] **JSDoc on exported API** — Minimum 90% coverage:
  ```typescript
  /**
   * Create a subscription for a viewer.
   * @param userId - Subscriber user ID
   * @param tierId - Creator tier selection
   * @returns Promise<Subscription> with status "active"
   * @throws SubscriptionExistsError if user already subscribed to this tier
   * @example
   * const sub = await createSubscription(userId, tierId);
   * console.log(sub.renewsAt); // 2026-05-28
   */
  export async function createSubscription(userId: string, tierId: string): Promise<Subscription> {
  ```

- [ ] **Complex logic commented** —
  - Why this approach? (not "how")
  - Any edge cases considered?
  - Example: "Aggregate earnings at batch creation time (not execution time) to prevent drift if a creator's earnings change between batch creation and posting"

- [ ] **Runbook updated** — If operational:
  - New endpoint documented (GET /api/subscriptions)
  - New error conditions explained (subscription_already_exists)
  - Troubleshooting added (how to debug subscription failures?)
  - Example: [docs/videoking/TROUBLESHOOTING.md](docs/videoking/TROUBLESHOOTING.md)

#### Deployment Safety
- [ ] **Backward compatible** — Does this break existing clients?
  - Old API version still works (no breaking endpoint changes)
  - Database migration is reversible (if needed)
  - Deployment order documented (if multiple services need coordinating)

- [ ] **Migration strategy clear** — If DB change:
  - Migration script exists and tested
  - Rollback procedure documented
  - Zero-downtime (no table locks > 1 second)
  - Drizzle migration runs in CI/CD successfully

- [ ] **Feature flag strategy** — For risky features:
  - Feature flag in code (disabled by default)
  - Enabled for test user first
  - Gradual rollout (10% → 50% → 100%)
  - Kill switch exists (can disable instantly)

- [ ] **Monitoring added** — If critical:
  - Sentry alert for new error types
  - PostHog event emitted (for analytics)
  - SLO dashboard will track (latency, availability)
  - Example: Payout endpoint monitored for 99.9% uptime

#### Code Review Readiness
- [ ] **PR description complete** —
  - Why: What problem does this solve?
  - What: What did you build?
  - How: What's the approach?
  - Testing: How'd you test it?
  - Risks: Any risky changes?
  - Screenshots: UI changes have before/after

- [ ] **All feedback addressed** — From reviewers:
  - No "approved but with questions" threads left open
  - Design feedback incorporated
  - Accessibility issues fixed
  - Performance concerns resolved

---

### DoD Enforcement

**GitHub Automation:**
- PR template includes DoD checklist
- Branch protection rule: Require 2 approvals (code review + design review)
- CI gates block merge if:
  - TypeScript strict errors exist
  - ESLint warnings > 0
  - Test coverage drops below 90%/85%
  - Lighthouse score < 85 (frontend)
  - Axe accessibility violations exist
- Merge only after all gates pass

---

## CI/CD Quality Gates

### Pre-PR (Local Development)

**Developer must run before committing:**

```bash
# Type check
npm run typecheck
# Exit code 0; zero TypeScript errors

# Lint
npm run lint
# Exit code 0; zero ESLint warnings

# Tests
npm test
# All tests pass; coverage thresholds met

# Build
npm run build
# Output: dist/ with no compilation errors
```

**If any fail:** Fix locally before pushing; don't merge with failures.

### In-PR (GitHub Actions)

**Runs automatically on every commit:**

```yaml
# .github/workflows/quality-gates.yml

Jobs:
  - typecheck: npm run typecheck → exit code 0
  - lint: npm run lint → exit code 0
  - test: npm test → coverage ≥ 90% lines, ≥ 85% branches
  - build: npm run build → dist/ with no errors
  - lighthouse: Lighthouse score ≥ 85 (desktop + mobile)
  - axe: Axe accessibility scan → 0 violations
```

**Branch protection rule blocks merge if any job fails.**

### Post-Merge (Staging/Production)

**Before deploying to production:**

```bash
# Smoke tests
curl https://staging.app.com/health → 200 OK

# Real user testing
Manual QA on staging with real DB

# Performance baseline
Compare Lighthouse score to production (no regression)
```

**Deploy gate:** Manual approval required; can rollback if issues found.

---

## PR Template

**Located:** `.github/pull_request_template.md`

```markdown
## Why
<!-- What problem does this PR solve? -->

## What
<!-- What did you build? Don't say "fixed bug"; say _which_ bug and _how_ -->

## How
<!-- What's your technical approach? Any tradeoffs? -->

## Testing
<!-- How'd you validate this works? What tests did you add? -->

## Checklist (Definition of Done)
- [ ] Passes `npm run typecheck` (zero TypeScript errors)
- [ ] Passes `npm run lint` (zero ESLint warnings)
- [ ] Passes `npm test` (all tests pass; coverage ≥ 90%/85%)
- [ ] Passes `npm run build` (no compilation errors)
- [ ] Lighthouse score ≥ 85 (frontend changes)
- [ ] Axe scan: 0 accessibility violations (frontend changes)
- [ ] JSDoc on exported API (90%+ coverage)
- [ ] Backward compatible (no breaking changes)
- [ ] Feature flag added (if risky)
- [ ] Monitoring alerts added (if critical)
- [ ] Runbook updated (if operational)
- [ ] Design review approved (if UI changes)

## Screenshots (if UI changes)
<!-- Before and after -->

## Risks
<!-- Any risky changes? Rollback strategy? -->

## Related Issues
Fixes #123
Related to #456
```

---

## Quality Gates by Category

### Money-Moving Features (Stripe, Payouts)

**Extra Requirements (Beyond DoD):**

- [ ] All Stripe webhook types tested (charge, transfer, connect account events)
- [ ] Idempotency validated (same request twice = same result, not double-charge)
- [ ] Failure paths tested (webhook timeout, rate limit, user account suspended)
- [ ] DLQ recording tested (if webhook fails, item goes to DLQ)
- [ ] Manual recovery workflow tested (operator can retry from dashboard)
- [ ] Earnings calculation audited (math is correct; no off-by-one errors)
- [ ] Payout batching validated (daily batch snapshot is immutable)
- [ ] Stripe Connect testing (test mode account used; sandbox transfers work)

**Review:** Finance lead + Tech lead (not just engineer)

---

### Auth & Security Features

**Extra Requirements:**

- [ ] Token generation secure (cryptographically random)
- [ ] Token expiration enforced (can't use expired token)
- [ ] Refresh token flow tested (new token issued without re-login)
- [ ] Permission checks tested (unprivileged user can't escalate)
- [ ] Rate limiting on login/signup (prevent brute force)
- [ ] Password hashing correct (bcrypt or Argon2; never reversible)
- [ ] HTTPS enforced (no HTTP allowed)
- [ ] Secrets not in logs (no auth tokens in error messages)

**Review:** Security lead + Auth package owner

---

### Real-Time Features (Chat, Reactions)

**Extra Requirements:**

- [ ] Concurrent connections tested (multiple users subscribing)
- [ ] Disconnection handled (don't lose state if user refreshes)
- [ ] Latency < 100ms (message appears instantly)
- [ ] Scaling tested (performance doesn't degrade with 100+ concurrent)
- [ ] Persistence considered (messages lost on restart? OK? Document it.)

**Review:** Real-time lead (Durable Objects expert)

---

### Database Changes

**Extra Requirements:**

- [ ] Migration is reversible (can rollback if needed)
- [ ] No table locks > 1 second (zero-downtime requirement)
- [ ] Indexes added for new columns (no slow queries introduced)
- [ ] Constraints applied (FK, UNIQUE, NOT NULL; intentional)
- [ ] Data backfill tested (if column added and needs populating, script works)
- [ ] No N+1 queries (Drizzle query aggregation working)

**Review:** DBA / Database specialist

---

## Team DoR/DoD Onboarding

**When:** Every new team member  
**Duration:** 1 hour  
**Deliverable:** Team member signs off on DoR/DoD checklist

**Agenda:**
1. **Why DoR/DoD matter (10 min)** — Prevents wasted sprints; catches bugs early
2. **DoR walkthrough (15 min)** — Show an example issue that passes DoR; one that fails
3. **DoD walkthrough (20 min)** — Show an example PR that passes DoD; one that fails (common mistakes)
4. **Q&A (15 min)** — "What if...?" scenarios; edge cases

---

## T6.1 Exit Criteria (by May 15, 2026)

- [x] DoR checklist published (GitHub issue + PR template)
- [x] DoD checklist published (PR template + CI gates)
- [x] CI/CD gates configured (GitHub Actions + branch protection)
- [ ] Team trained on DoR/DoD (1 training session + Q&A)
- [ ] Template used in ≥5 PRs (verified adoption)
- [ ] Blocked ≥1 merge (gate working; prevented bad PR from shipping)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Engineering Manager | Initial DoR/DoD framework; CI gates; team onboarding |

---

**Status:** ✅ T6.1 READY FOR TEAM ADOPTION  
**Next:** T4.1 (Factory Package Matrix) + T2.2 (Test Coverage) — starts May 5

