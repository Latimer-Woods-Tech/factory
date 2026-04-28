# Product Quality Review Runbook

## Purpose

This runbook scales the [design standards rubric](../packages/design-standards.mdx) into a practical PR review workflow. Use it when:
- Reviewing PRs before merge
- Designing new features
- Testing before release
- Troubleshooting quality issues (why did this bug get through?)

---

## Quick Start: 5-Minute PR Quality Check

For every PR, run this before requesting review:

1. **Does it build?** `pnpm build` → no errors
2. **Does it pass tests?** `pnpm test` → green, coverage ≥ 90%
3. **Is TypeScript clean?** `pnpm typecheck` → zero errors
4. **Any console warnings?** `pnpm lint` → max-warnings 0
5. **Accessibility spot-check:** Click through the flow, use Tab/arrow keys, try Axe browser extension

If all pass, request review. If any fails, fix before publishing.

---

## Full PR Review Checklist (15 minutes)

Use this checklist when you're the reviewer. The PR must pass **all Required** checks to be approved.

### Code Quality

**Required**
- [ ] Build succeeds with no errors: `pnpm build`
- [ ] TypeScript strict mode: `pnpm typecheck` → 0 errors
- [ ] Linting: `pnpm lint` → 0 errors (or issues resolved)
- [ ] Tests pass: `pnpm test` → all green
- [ ] Coverage meets baseline: line ≥90%, branch ≥85% (for new code)
- [ ] No hardcoded secrets or credentials
- [ ] Commit message follows format: `<type>(<scope>): <description>`

**Optional (must be ≥ 80% pass)**
- [ ] Comments explain complex logic
- [ ] Variable/function names are clear
- [ ] No dead code (commented-out blocks removed)
- [ ] No TODO/FIXME without an associated issue
- [ ] DRY: no obvious duplication

**Decision:** ✅ Pass / ❌ Fail

---

### UX & Accessibility (Dimension 2 from Rubric)

**Required**
- [ ] Feature is WCAG 2.2 AA compliant (Axe check passes)
- [ ] Color is not the only way to convey information
- [ ] Minimum text contrast: 4.5:1
- [ ] Keyboard navigation works (Tab, Enter, Escape, arrows)
- [ ] Form labels are explicit and semantic

**Optional (must be ≥ 80% pass)**
- [ ] Screen reader tested (spot-check with NVDA/JAWS on Windows or VoiceOver on Mac)
- [ ] Works at 200% zoom
- [ ] Works on 375px mobile viewport
- [ ] Input fields have visible labels (not just placeholder)
- [ ] Error messages are specific and actionable
- [ ] Loading states are clear (not just a blank screen)
- [ ] Images have alt text

**Decision:** ✅ Pass / ❌ Fail

**If Fail:** Request changes and re-review before merge.

---

### Clarity (Dimension 1 from Rubric)

**Required**
- [ ] User can understand the purpose without reading code
- [ ] CTAs use action verbs (e.g., "Upload Video" not "Submit")
- [ ] Error messages tell users how to fix the problem

**Optional (must be ≥ 80% pass)**
- [ ] Flow matches user mental model (not engineering taxonomy)
- [ ] Terminology is consistent with the rest of the product
- [ ] Empty states are helpful (not just blank)
- [ ] Documentation includes examples

**Decision:** ✅ Pass / ❌ Fail

---

### Performance (Dimension 3 from Rubric)

**Required**
- [ ] No obvious performance regressions (spot-check in staging)
- [ ] API calls have timeouts (< 5s)
- [ ] No N+1 queries or obvious inefficiencies

**Optional (must be ≥ 80% pass)**
- [ ] Web Vitals measured (FCP, LCP, CLS, INP)
- [ ] Images are optimized (no huge uncompressed files)
- [ ] Third-party scripts are deferred or lazy-loaded
- [ ] Database queries use indexes
- [ ] Caching strategy is appropriate

**Decision:** ✅ Pass / ❌ Fail

---

### Consistency (Dimension 4 from Rubric)

**Required**
- [ ] Uses existing button/form styles (no new one-off CSS)
- [ ] Uses design tokens for colors, spacing, typography

**Optional (must be ≥ 80% pass)**
- [ ] Matches modal/dialog patterns elsewhere
- [ ] Event schema (analytics) is consistent with existing events
- [ ] API response shape & error format match standards
- [ ] Loading skeletons/ empty states style is consistent

**Decision:** ✅ Pass / ❌ Fail

---

### Error Handling (Dimension 5 from Rubric)

**Required**
- [ ] API errors are caught and handled (not unhandled promise rejections)
- [ ] User-facing errors have messages (not just codes)
- [ ] UI state is preserved during error (no spinning wheel forever)

**Optional (must be ≥ 80% pass)**
- [ ] Errors are logged to Sentry (with context: user, flow, session)
- [ ] Failed events go to DLQ (if they're critical to business logic)
- [ ] Retry logic is implemented (with exponential backoff)
- [ ] Error messages suggest recovery action ("Refresh and try again" or "Contact support")
- [ ] Timeouts are reasonable (not 30s for a simple query)

**Decision:** ✅ Pass / ❌ Fail

---

### Mobile Optimization (Dimension 6 from Rubric)

**Required**
- [ ] Works on 375px viewport (tested in Chrome DevTools mobile view)
- [ ] Touch targets are ≥ 48px × 48px
- [ ] No horizontal scrolling (except for content like tables/carousels)

**Optional (must be ≥ 80% pass)**
- [ ] Tested on actual mobile device
- [ ] Form inputs display mobile keyboard correctly (number, email, tel, etc.)
- [ ] Long-form content scrolls smoothly on mobile
- [ ] Modal dialogs are full-width or appropriately sized on phone
- [ ] No redundant mobile-specific styles; responsive CSS handles it

**Decision:** ✅ Pass / ❌ Fail

---

## Scoring the Review

### Pass Criteria

A PR is **approved** if:
- ✅ **All Required checks** pass across all dimensions
- ✅ **≥ 80% of Optional checks** pass
- ✅ **No high-risk issues** flagged (security, accessibility, data loss)

### Needs Work

If any Required check fails or Optional score is < 80%, request changes:
1. Comment on the specific line(s) with the issue
2. Link to the Decision section above (e.g., "Performance - Optional checks")
3. Use `request-changes` status (don't approve)
4. Wait for author to fix and request re-review

### Edge Case: Acceptable Technical Debt

If a Known Issue or Technical Debt exists, it can be passed through IF:
- An issue is created and linked in the PR
- It's explicitly called out in the PR description
- The risk is documented and accepted by the tech lead
- A timeline for fixing is agreed

Example comment:
```
Technical debt flagged:
- Mobile responsiveness not optimized (issue #1234)
- Accepted for timeline; fix targeted for Q2
- Will not ship to production until resolved
```

---

## Post-Merge: Deployment Quality Gate

After merge, before deploying to production, run:

```bash
# Build final artifact
pnpm build

# Run full test suite
pnpm test

# Audit dependencies
npm audit

# Check for performance regressions
# (requires baseline from previous production deployment)
pnpm measure-performance
```

If any fails, **do not deploy**. Fix, merge again, and re-run.

---

## Quarterly Quality Review Meeting

Once per quarter, the team reviews:

1. **Escape rate:** How many bugs reached production? *(Target: ≤ 1 per 10k LOC)*
2. **Coverage trend:** Is it staying at ≥ 90% lines / 85% branches?
3. **Performance trend:** Are Web Vitals stable or improving?
4. **Accessibility:** Any new WCAG failures? *(Target: zero)*
5. **DLQ health:** Is the dead-letter queue growing? (indicates missed error handling)
6. **NPS/feedback:** Are users satisfied with the product?

**Action:** If any metric is degrading, create an OKR for the next quarter to fix it.

---

## Troubleshooting: "This Bug Should Have Been Caught"

If a bug reaches production, use this to diagnose why it escaped:

1. **Did it have tests?** If no → add tests before fixing (prevent regression)
2. **Did tests miss it?** If yes → improve test case (edge cases? mocks?)
3. **Did it fail accessibility?** If yes → was Axe run? Update CI to enforce
4. **Was it a performance issue?** If yes → add performance budget to CI
5. **Was it undocumented?** If yes → add runbook or FAQ once fixed

**Always ask:** How do we prevent this class of bug in the future? Add a check to this runbook if needed.

---

## Tool Reference

### Accessibility
- **Axe DevTools:** Browser extension (Chrome, Firefox) — one-click scan
- **WAVE:** Browser extension or web version
- **NVDA:** Free screen reader (Windows)
- **macOS VoiceOver:** Built-in (`Cmd+F5` to toggle)

### Performance
- **Chrome DevTools Lighthouse:** Built-in audits
- **WebPageTest:** https://www.webpagetest.org (advanced profiling)
- **Bundle Analyzer:** Visualize code size

### Testing
- **Vitest:** Framework (pnpm test)
- **Testing Library:** React testing utilities
- **Cypress / Playwright:** E2E testing

### Code Quality
- **TypeScript:** Type checking (pnpm typecheck)
- **ESLint:** Linting (pnpm lint)
- **Prettier:** Code formatting (pnpm format)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Baseline | Initial product quality review runbook for Factory + videoking |
