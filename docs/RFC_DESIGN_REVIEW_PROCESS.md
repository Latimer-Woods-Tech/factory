# RFC & Design Review Process

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T6.2 — Create Lightweight RFC + Design Review Process  
**Reference:** VideoKing Phase B initiatives + system design decisions

---

## Mission

Establish one clear process for:
- **RFC (Request for Comments):** Proposal → team review → decision → implementation
- **Design Review:** UX/visual → feedback → iteration → approval → handoff to dev
- **Approval Gates:** Who approves? When can work start? What's the SLA?

Goal: Prevent surprises, wasted effort, and rework by aligning before coding starts.

---

## Part 1: RFC Process

### When to Write an RFC

**Required for (always):**
- Any system design change (schema, architecture, new service)
- New user/operator journey or flow
- Monetization changes (pricing, payout logic, tier structure)
- Any breaking change (API, database migration, auth)
- New package or major feature that other apps might use

**Optional for (consider):**
- Bug fixes (unless architectural impact)
- UI tweaks (unless they affect a journey)
- Technical debt (unless it blocks other work)

### RFC Template

**Filename:** `rfcs/YYYY-MM-DD-{feature-name}.md`

```markdown
# RFC: {Feature Name}

**Date:** YYYY-MM-DD  
**Author(s):** [name(s)]  
**Status:** Draft → Review → Approved → Implemented → Complete  
**Decision:** [TBD initially]

---

## Summary

One paragraph: what problem are we solving? Why now?

Example:
> Stripe's latest API requires us to migrate from `stripe.charges.*` to `stripe.payments.*`. 
> This affects payout batching (current: single transfer per batch; new: batch transfers = group pending creators by region). 
> Window to migrate: 3 months (deadline June 28, 2026) before old API deprecated.

---

## Problem Statement

**Current State:**
- What's not working today? Specific pain points + evidence (metrics, user feedback, etc.)
- Example: "Payout execution time is 8 min; creators expect < 5 min. SLA target: 99.9% success rate; current: 99.2%."

**Why Now:**
- What changed? Why is this urgent?
- Example: "Stripe deprecated charges API (deadline June 28); new payments API has batch transfer feature (fix our latency issue)."

---

## Proposed Solution

**High-Level Approach:**
- What's the core idea? (1–3 paragraphs)
- What won't we do? (important: be clear about non-goals)

**Detailed Design:**

### Component 1: [Name]
- What does this do?
- How does it interact with existing systems?
- Schema changes (if any)
- New endpoints (if any)
- Example code snippet (if helpful)

### Component 2: [Name]
- (Same structure as Component 1)

**Key Decisions & Tradeoffs:**

| Option | Pros | Cons | Recommendation |
|--------|------|------|---|
| Option A | Pro1, Pro2 | Con1, Con2 | If [condition], choose A |
| Option B | Pro1 | Con1, Con2, Con3 | ⬅️ Recommended if [reason] |
| Option C | Simplest | Doesn't scale | Not recommended |

---

## Impact Analysis

**Who is affected (by role):**
- [ ] Core engineers (implementation)
- [ ] Creator ops (if monetization change)
- [ ] Designers (if user-facing)
- [ ] Data analysts (if instrumentation changes)
- [ ] Security/compliance (if auth/PII changes)

**Breaking Changes:**
- Is this backward compatible? (ideal: yes)
- If not, what's the migration path?
- How long do we support the old API? (concurrent mode?)

**Risk Assessment:**

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Payout failure during migration | Medium | High (creators don't get paid) | Run migrations on staging first; parallel mode (old + new API) for 1 week |
| Data loss (incomplete batch history) | Low | High | Backup existing batch records before migration |
| Performance regression | Low | Medium | Benchmark batch transfer latency before/after |

---

## Metrics & Success Criteria

**Before** (current state):
- Payout execution time: 8 min
- Payout success rate: 99.2%

**After** (expected, Phase C):
- Payout execution time: ≤ 5 min
- Payout success rate: 99.9%

**How We'll Measure:**
- PostHog dashboard: `payout_batch_execution_duration_seconds`
- Sentry: `payout_transfer_failed` errors
- Weekly revenue integrity report

---

## Implementation Plan

**Phase 1: Preparation (May 5–12)**
- [ ] Set up staging environment with new Stripe API
- [ ] Build parallel-mode client (can call old + new API)
- [ ] Write tests for batch transfer logic
- [ ] Security review (PII in transfer data?)

**Phase 2: Pilot (May 15–19)**
- [ ] Deploy parallel mode to staging; test with prod-like data
- [ ] Test recovery scenario (one batch transfer fails; does backup succeed?)
- [ ] Load test: 100 simultaneous batch transfers

**Phase 3: Production Rollout (May 22–26)**
- [ ] Deploy parallel mode to production (no visible changes yet)
- [ ] Run both APIs for 1 week (shadow mode)
- [ ] Toggle over to new API only (May 26); keep old API as fallback
- [ ] Monitor for 1 week (SLO = zero incidents)
- [ ] Remove old API code (May 31)

**Rollback Plan:**
- If issues arise, switch back to old API (1-minute toggle)
- Restore from database backup if data corruption detected

---

## Alternatives Considered

**Alternative 1: Delay Migration**
- Pro: More time to plan
- Con: Stripe deadline is June 28; if we delay, we rush in final week
- Decision: Not recommended; start now

**Alternative 2: Manual Payout Processing**
- Pro: Simpler; no need to integrate new API
- Con: Not scalable; requires ops person to manually create transfers
- Decision: Not recommended; we have too many creators

---

## Open Questions

- [ ] Can we request SLA from Stripe on batch transfer latency? (We expect < 100ms)
- [ ] Are batch transfers in trial mode, or do we need prod setup?
- [ ] Do failed batch transfers trigger webhook? (Needed for DLQ)

---

## Review & Approval

| Role | Status | Notes |
|------|--------|-------|
| Tech Lead | ⬜ Pending | Need to confirm parallel mode approach |
| Product Lead | ⬜ Pending | Need to confirm scope (batch transfers only?) |
| Security Lead | ⬜ Pending | PII risk review on transfer data |
| Engineering Manager | ⬜ Pending | Resource allocation; sprint capacity |

**Comment Thread:**
- @tech-lead: LGTM on parallel mode; adds 10% overhead but safe. Can we run staging pilot May 10? (Tech Lead)
- @product-lead: Approve scope. One follow-up: can creators batch multiple videos into one payout? (e.g., deposit once per week instead of daily?) (Product Lead)
  - @author: Good idea; deferred to Phase C (would need UI redesign + creator education). Added as Phase C initiative. (Author)

---

## Decision

**Approved:** May 1, 2025, 10am UTC by [Tech Lead + Product Lead]

**Approved with conditions:**
- (if any)

**Rejected:** (if not approved; note reason)

---

## Implementation Tracking

- [ ] PR #1234: Parallel mode client + tests (Author Name)
- [ ] PR #1235: Batch transfer logic + instrumentation (Author Name)
- [ ] PR #1236: Staging migration + validation (Author Name)
- Deployment: May 22 (Target Envoy: Production)

---

## Resolution & Learnings (Post-Implementation)

**Completed:** May 31, 2026

**Actual Metrics:**
- Payout execution time (post): 4.2 min ✅ (beat target of 5 min)
- Payout success rate (post): 99.87% ✅ (met 99.9% target)

**Unexpected Challenges:**
- Stripe batch transfer had 500ms init delay; optimized via connection pooling
- One creator with 500+ pending transfers caused timeout; added cursor pagination

**Lessons Learned:**
- Parallel mode added safety; worth the 10% overhead
- Staging pilot caught edge case (timeout); saved us from production incident
- Rollback plan was never needed; confidence gave ops team peace of mind

---

## Template End

Template sections to include in RFC:
- [ ] Summary (1 paragraph)
- [ ] Problem statement (current + why now)
- [ ] Proposed solution (high-level + detailed)
- [ ] Impact analysis (who is affected + risks)
- [ ] Metrics & success criteria
- [ ] Implementation plan (phases + rollback)
- [ ] Alternatives considered
- [ ] Open questions
- [ ] Review & approval (roles + comments)
- [ ] Decision (approved/rejected + conditions)
- [ ] Implementation tracking (PRs + deployment)
- [ ] Resolution (post-implementation learnings)

```

---

## Part 2: Design Review Process

### When to Design-Review

**Required for:**
- New user journeys (from T1.2)
- UI changes to critical paths (checkout, payout, moderation)
- Accessibility changes (colors, buttons, forms)
- Responsive redesigns (major layout shifts)

**Optional for:**
- Copy tweaks
- Icon changes
- Color adjustments (if not accessibility-related)

### Design Review Workflow

#### Stage 1: Design Proposal (Designer → Team)

**Designer prepares:**
- [ ] Figma file with 2–3 design options (exploration)
- [ ] For each option: rationale (why this approach?)
- [ ] Responsive considerations (320px, 1280px)
- [ ] Accessibility checklist from T1.1 (color contrast, focus states, etc.)
- [ ] Are we using existing design system components, or new patterns?

**Checklist (from T1.1):**
- [ ] User clarity: Can anyone understand the action within 2 seconds?
- [ ] Accessibility: Axe scan would pass (high contrast, focus visible?)
- [ ] Consistency: Are we using design system tokens?
- [ ] Performance: Images optimized? Animations < 500ms?
- [ ] Trust: Destructive actions require confirmation?
- [ ] Mobile: Touch targets ≥ 48px? No horizontal scroll?

**Async Review Window (24–48 hours):**
- [ ] Designers + stakeholders review Figma link
- [ ] Async comments on Figma (by role):
  - **Design Lead:** Consistency with design system, visual hierarchy
  - **Frontend Lead:** Implementation feasibility, component reusability
  - **Product Lead:** User goal alignment, business impact
  - **Accessibility Lead:** WCAG 2.2 AA compliance
- [ ] Designer reads comments; notes patterns (if 3+ people mention same issue, it's a concern)

#### Stage 2: Refinement (Designer → Revised Figma)

**Designer iterates (48–72 hours):**
- [ ] Incorporate high-confidence feedback (3+ comments on same issue)
- [ ] Decide to defer low-priority items (mark as "v2" or "tech debt")
- [ ] Update accessibility checklist (recalculate contrast ratios, test focus states)
- [ ] Post revised version in Figma thread: "Updated per feedback. See updated file at [link]. Deferred items: [list]."

#### Stage 3: Sign-off (Design Lead → Approval)

**Design Lead approves when:**
- All major feedback resolved (accessibility, consistency, clarity)
- Responsive checks passed (no horizontal scroll on 375px, touch targets ≥ 48px)
- Design system alignment confirmed
- Designer has written implementation notes (colors, spacing, component boundaries)

**Comment in Figma:** "✅ Approved for development. Handoff specs: [link to handoff doc]"

#### Stage 4: Handoff to Engineering

**Designer creates handoff doc (Notion or markdown):**

```
# Design Handoff: [Feature Name]

**Figma Link:** [link to approved design]  
**Status:** Ready for development [date]

## Components

### Component 1: Subscribe Button
- Size: 44px height (desktop), 48px (mobile — touch target)
- Background: `primary` token = #FF006B
- Text: `caption-link` size = 14px weight 500
- States: default, hover (darker: #E6005F), active, disabled, loading
- Icon: $4.99 badge (if needed)

### Component 2: Success Toast
- Position: Top-right, 24px safe area
- Animation: Slide-in 200ms ease-out
- Duration: 3 seconds auto-dismiss
- Accessible: role="alert", announce via aria-live

## Responsive Breakpoints
- Mobile (375px): Full width, stack vertically
- Tablet (768px): Side by side
- Desktop (1280px+): Fixed layout

## Accessibility Notes
- All buttons tested in axe.core; 0 violations
- Contrast ratio: 4.8:1 (exceeds 4.5:1 AA requirement)
- Focus indicators: 2px solid #8F5FFF (secondary color)
- Color not sole indicator: Lock icon + red + text

## Implementation Notes
- Reuses Button + Toast components from design system
- New: `primary-button` Tailwind class (can be extracted to shared)
- No new fonts; all typography uses existing scale

```

---

## Part 3: Approval Gates

### Who Approves What

| Change Type | Approver | SLA | Notes |
|---|---|---|---|
| **RFC (major design/architecture)** | Tech Lead + Product Lead | 3 business days | If no major objections, auto-approve after SLA expires |
| **Design (new journey or UI)** | Design Lead | 2 business days | Can be async; Figma reviews |
| **Database schema** | Tech Lead + DBA | 1 business day | Security + performance impact |
| **Security/Auth change** | Security Lead | 1 business day | Can block indefinitely if concerns |
| **Performance budget change** | Frontend Lead | 1 business day | If changing from 85 Lighthouse to 80, needs justification |
| **Monetization logic** | Product Lead + Tech Lead | 2 business days | Revenue impact; both must sign off |

### Escalation Path

**If no approver responds by SLA:**
1. Send Slack reminder (tag approver)
2. If still no response after 24h, escalate to Engineering Manager
3. Engineering Manager can approve or reassign

**If approver rejects:**
1. Author + approver meet (Slack or 15-min call)
2. Reach agreement: adjust proposal, defer to Phase C, or override with written rationale
3. Document decision + rationale

---

## Part 4: RFC + Design Review Workflow (Combined)

**Typical Timeline for Major Feature:**

| Phase | Week | Owner | Activity | Gate |
|---|---|---|---|---|
| **Proposal** | W1 Mon | Product | RFC drafted + Figma exploration | Tech Lead + Product Lead review |
| **Refinement** | W1 Tue–Wed | Designer | Design iteration per feedback | Design Lead approval |
| **Handoff** | W1 Thu | Designer | Hand off specs to engineering | Ready for coding |
| **Implementation** | W2–3 Mon–Fri | Engineer | Code + tests | DoD + design review (code review) |
| **Integration** | W4 Mon–Tue | TBD | Any tweaks post implementation | DoD gates |
| **Ship** | W4 Wed+ | TBD | Deploy to staging, verify, release | SLO metrics within targets |

---

## Part 5: RFC Repository Structure

**Location:** `rfcs/` directory in repo root

```
rfcs/
├── 2026-05-01-stripe-batch-transfers.md       (Approved)
├── 2026-05-03-creator-onboarding-redesign.md  (In Review)
├── 2026-05-05-season-2-content-strategy.md    (Draft)
├── TEMPLATES/
│   ├── RFC_TEMPLATE.md
│   └── DESIGN_REVIEW_CHECKLIST.md
└── ARCHIVE/
    └── 2026-04-20-video-preload-strategy.md   (Rejected; replaced by different approach)
```

**Naming:** `YYYY-MM-DD-{feature-name}.md` (sortable by date)

---

## Part 6: Design Review Meeting (If Needed)

**When:** If async feedback contradicts (multiple competing proposals) or RFC/design is complex

**Duration:** 30–45 minutes (max; keep focused)

**Attendees:**
- Designer (presenting)
- Design Lead (moderating)
- Product Lead (representing user need)
- Tech Lead (feasibility check)
- Optional: Accessibility lead, frontend lead

**Agenda:**
1. **Designer presents** (10 min): "Here's why I chose this approach"
2. **Questions** (5 min): Clarification only; save critique for next round
3. **Feedback round** (15 min): Each person 2–3 minutes (what works + concerns)
4. **Decision** (5 min): Approve, defer, or request revision

**Output:** Designer notes action items; sends recap Slack thread

---

## Part 7: RFC Examples (for Reference)

### Example 1: Approved RFC
**Title:** Stripe Batch Transfers Migration  
**Status:** ✅ Approved May 1  
**Impact:** Core payout system; enables 5-min SLA target  
**Timeline:** May 22 deployment

### Example 2: In-Review RFC
**Title:** Creator Onboarding Redesign  
**Status:** 🔄 In Review (awaiting security lead feedback)  
**Impact:** New user journey; monetization funnel  
**Timeline:** Feedback due May 5; deploy May 22

### Example 3: Deferred RFC
**Title:** Season 2 Content Strategy  
**Status:** ⏸️ Deferred to Phase D (July+)  
**Reason:** Depends on T1.2 (journey maps) + Phase C UX work first  
**Timeline:** Revisit June 15

---

## Part 8: Anti-Patterns (What NOT to Do)

❌ **"Let's just build it and see"** (skip RFC entirely)
→ Risk: Weeks of work, wrong direction, rework

❌ **"RFC approved! Ship immediately"** (skip design review)
→ Risk: Technical solution doesn't match user needs; UX debt

❌ **"Designer decided; engineering implements as-is"** (no engineering input in design phase)
→ Risk: Design not feasible; or infeasible component introduces regressions

❌ **"Approver says no comment = approval"** (silent consensus)
→ Risk: Approver didn't actually review; surprise objection at merge time

❌ **"We'll do a design review meeting every time"** (over-process)
→ Risk: Meetings take 30 min × 2 people × 40 RFCs/year = 1,200 hours/year of overhead

---

## Part 9: New Team Member Onboarding

**When:** Every new engineer, designer, or product manager  
**Duration:** 30 min (walkthrough of one real RFC)  
**Deliverable:** Team member can articulate:
- When to write an RFC (required vs optional)
- What goes in an RFC (sections)
- How design review works (stages)
- Who approves what + SLAs
- How to escalate if stuck

**Example Walkthrough:** Walk through an approved RFC (Stripe batch transfers) and live Figma file (creator onboarding redesign) to show the process in action.

---

## T6.2 Exit Criteria (by May 29, 2026)

- [x] RFC template published (sections + examples)
- [x] Design review checklist created (from T1.1 rubric)
- [x] Approval gates defined (who approves, SLA per change type)
- [x] Escalation path documented (if approver unresponsive or rejects)
- [x] RFC repository structure created (`rfcs/` directory)
- [ ] First RFC under new process (starts May 5; due May 15)
- [ ] First design review using new process (starts May 5; due May 15)
- [ ] Approved RFC implemented + deployed (demonstrates full cycle)
- [ ] Team trained on process (1 walkthrough + Q&A)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Engineering Manager | Initial RFC + design review process; templates; gates |

---

**Status:** ✅ T6.2 READY FOR TEAM ADOPTION  
**Next:** T1.3 (Accessibility Audit) + T2.2 (Test Coverage) — starts May 15–22

