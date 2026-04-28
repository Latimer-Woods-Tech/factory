# RFC-002: Creator Onboarding Journey Redesign

**RFC Number:** RFC-002  
**Title:** Creator Onboarding Journey Redesign  
**Author:** [Product Lead]  
**Date Filed:** April 28, 2026  
**Status:** review (pending design lead & engineering feedback; target acceptance May 5, 2026)  
**Target Ship:** Q2 2026 (June)  
**Updated:** April 28, 2026

---

## 1. Problem Statement

### Current State

Videoking's creator onboarding has 7 sequential steps:

1. Email signup
2. Email verification
3. Profile setup (name, bio, profile pic)
4. Tax ID collection (US creators only)
5. Bank account linking (payment setup)
6. First upload (video upload tutorial)
7. Publishing (go live)

**Current metrics:**
- Signup → Email verified: **92% completion** (8% drop-off)
- Email verified → Profile setup: **78% completion** (14% drop-off)
- Profile setup → Tax ID: **61% completion** (17% drop-off) ⚠️ **Biggest drop**
- Tax ID → Bank: **58% completion** (3% drop-off)
- Bank → First upload: **52% completion** (6% drop-off)
- First upload → Publishing: **48% completion** (4% drop-off)

**Problem:** 52% drop-off between signup and first publish. Creator messaging suggests pain points:

- "I wasn't sure if I had to set up payments right away" (confused by tax ID step)
- "Huge wall of text on profile form; didn't fill it all out" (form too dense)
- "Didn't know how to upload a video" (tutorial too quick / unclear)

### Data Supporting Problem

**Creator interviews (10 interviews × 3 sessions each):**
- 7/10 creators said tax ID collection was unexpected ("Why do you need this now?")
- 6/10 felt "pressured" to link bank account before trying platform
- 5/10 found profile form overwhelming (too many optional fields)

**Survey (500 creators):**
- **NPS for onboarding:** 32 (target: 50+)
- **Time to first upload:** Median 45 minutes; some users took 3+ sessions

**Cohort analysis:**
- Creators who complete onboarding in <30 min have 3× higher 30-day retention
- Creators who set up payment on Day 1 have 2.1× higher LTV (but are fewer due to friction)

### Business Impact

- Current onboarding: 48% complete sign-up → publish journey
- If we improve to 70% completion: +22% of signup cohort publishes immediately
- At 500k signups/month × 22% = 110k new creators publishing monthly (vs. 240k today = **46% increase in new creator output**)
- Creator-gen content → user engagement ↑ → platform MAU↑ → revenue↑

---

## 2. Proposed Solution

### 2.1 Core Approach

**Redesign onboarding from 7 sequential steps to 3 progressive phases:**

1. **Quick Start (Minutes 0–5)**
   - Email + password (skip email verification for now; verify later async)
   - Profile pic + display name (from social login if possible, or simple form)
   - **End state:** Creator is in the app and can browse

2. **Try It Out (Minutes 5–30)**
   - Guided video upload with interactive help
   - Publish first video (public or private, user choice)
   - **End state:** Creator has published 1 video; experience the platform

3. **Get Paid (On-demand, when ready)**
   - Tax ID collection (goal: when creator is confident the platform works)
   - Bank account linking (payment setup)
   - **End state:** Creator can withdraw earnings

**Key insight:** Separate **learning** from **monetization**. Let creators explore before committing tax info.

### 2.2 Implementation Strategy

**UX Changes:**
1. Skip email verification step initially; move to async (background job emails verification link; users can watch without verifying)
2. Profile form: Show only required fields initially (name, pic); optional fields in collapsible section
3. Tax ID step: Move to separate "Monetization" flow; triggered by creator going to Earnings page, not during onboarding
4. Upload step: Add interactive tooltips + video walkthrough (Loom embed or in-app video)
5. Simplified progress indicator: Show "2 more steps" instead of "step 3 of 7" (less intimidating)

**Technical Changes:**
1. **Email verification async:** Move verification to background job; create user immediately; send verification email with one-click link
2. **Tax ID collection moved:** Migrate to dedicated modal/flow on Earnings page (triggered when creator tries to withdraw)
3. **Profile form refactoring:** Hide optional fields in collapsible section; only show required fields
4. **Videoguide service:** Host upload tutorial videos in R2; embed in onboarding step

**Database Changes:**
1. Add `email_verified_at` (nullable; default NULL until user clicks link or 30 days passes)
2. Add `tax_id_collected_at` (nullable; shows when tax step completed)
3. Add `first_video_published_at` (tracks milestone for retention analytics)

**Backend API Changes:**
1. `POST /auth/signup` now returns immediately (no email verification required)
2. New route: `POST /creator/earnings/setup-tax-id` (used when creator visits earnings page, not during signup)
3. New route: `POST /creator/onboarding/skip-payment-setup` (allow creators to defer bank linking)

**Rollout Plan:**
- Phase 1: A/B test with 10% of signups (Week 1)
- Phase 2: Migrate 50% to new flow; monitor drop-off at each step (Week 2)
- Phase 3: 100% users on new flow; old flow retired (Week 3)
- Phase 4: Monitor and compare cohort retention (Weeks 4+)

### 2.3 Alternatives Considered

**Alternative A: Progressive disclosure (show all 7 steps but let creators skip)**
- Pros: No data model changes; optional fields already exist
- Cons: Still overwhelming; drop-off likely stays high (users see "7 of 7" and feel daunted)
- **Rejected because:** Doesn't address core problem (perceived length of onboarding)

**Alternative B: Interactive wizard (animated progress bar, encourage completion)**
- Pros: Gamification might increase completion
- Cons: Doesn't change the friction points (tax ID confusing, form too dense)
- **Rejected because:** Treats symptom, not disease; won't improve NPS or retention

**Alternative C: Minimal onboarding (skip everything except email + password; defer profile setup)**
- Pros: Fastest path to app
- Cons: Loss of profile data; harder to surface creators to users if no pic/name
- **Rejected because:** Harms discovery (creators with no profile pic are overlooked)

### 2.4 Out of Scope

- ❌ Social login integration (future RFC; depends on infrastructure)
- ❌ Email verification via SMS (alternative for regions with poor email delivery)
- ❌ Creator mentorship program (separate product initiative)
- ❌ Creator verification badge (separate RFC on creator trust)

---

## 3. Impact Analysis

### 3.1 User Impact

**New creators:**
- **Benefit:** Faster onboarding (5 min → explore, vs. 20+ min → monetization)
- **Benefit:** Less form friction (required fields only; optional hidden)
- **Benefit:** Can start publishing immediately; learning vs. friction separated

**Existing creators:**
- **No negative impact:** New flow is addition; existing creators unaffected

**Users/viewers:**
- **Benefit:** More creator content (46% increase in new creator uploads → more content to watch)
- **Indirect benefit:** Better recommendations (more creators → more diverse content)

### 3.2 Team Impact

**Product:**
- Product lead owns roadmap + success metrics
- Updated onboarding docs + creator success messaging
- Coordination with creator support team (new help articles needed)

**Design:**
- New onboarding screens (3 flows: quick start, upload, earn)
- Accessibility audit (keyboard nav, screen reader compatible)
- Mobile-first design (most signups on mobile)
- **Effort:** 2–3 weeks design + prototyping

**Engineering:**
- Backend: Email verification async + new payment setup flow
- Frontend: New onboarding UI + progressive disclosure
- Database: New fields + migrations
- QA: A/B test setup, metrics instrumentation, cohort tracking
- **Effort:** 3–4 engineers × 3–4 weeks = 12–16 person-weeks

**Creator Support:**
- New FAQ: "Why wasn't I asked for payment info?" (anticipated question)
- New help article: "When should I set up my payment account?"
- Monitoring: Watch for confusion spike during A/B test
- **Effort:** 4–6 hours hours

**Finance/Compliance:**
- Review: Does deferring tax ID collection violate any regulations? (probably not if we collect before first payout)
- Recommendation: Tag payouts with "tax_id_collected_on_date"; ensure we have ID before settlement
- **Effort:** 2–3 hours review

### 3.3 Business Impact

- **Creator LTV:** Likely ↑ due to higher onboarding completion (more creators successfully publish)
- **Creator retention:** Likely ↑ (creators who publish on Day 1 have higher 30-day retention; see data above)
- **User engagement:** Likely ↑ due to more creator content
- **MAU:** Projected ↑ 5–10% (new creators publishing → more content → more reasons to return)
- **Revenue:** Likely ↑ (more creators on platform = more monetization opps)
- **Support cost:** Likely ↓ (fewer confused creators)

---

## 4. Timeline & Resources

### 4.1 Estimated Effort

| Resource | Effort | Notes |
|----------|--------|-------|
| Product strategy | 1 week | Roadmap, KPIs, go/no-go criteria |
| Design | 3 weeks | Mockups, prototype, accessibility |
| Engineering | 4 weeks (3–4 eng) | Backend + frontend + database |
| QA | 2 weeks | Test cases, A/B test setup, metrics instrumentation |
| Creator support | 1 week | FAQ, help articles, support briefing |
| Finance compliance | 0.5 weeks | Review tax ID deferral legality |
| **Total** | **11–12 weeks** | Can start design + engineering in parallel after RFC acceptance |

### 4.2 Milestones

| Milestone | Owner | Target Date |
|-----------|-------|-------------|
| Design review approved | Design lead | May 10 |
| A/B test infrastructure ready | Eng | May 24 |
| A/B test (10% cohort) launch | Eng + Product | May 31 |
| A/B test results reviewed | Product | June 7 |
| Rollout decision made (go/no-go) | Product + Eng lead | June 10 |
| 50% rollout | Eng | June 17 |
| 100% rollout | Eng | June 24 |
| Post-launch monitoring (2 weeks) | Product + Eng | July 8 |

### 4.3 Hard Dependencies

- **Payment processing RFC (RFC-001 payout batching)** — Must be stable before deferring tax ID (ensures we can collect tax ID at payout time, not signup)
- **Email verification async capability** — Requires background job infra (already exists; no blocker)

### 4.4 Soft Dependencies

- Designer availability (design team capacity may impact timeline)
- A/B testing infra (already exists; can start testing June 1)

### 4.5 Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Email verification gets confused (spam) | Low | Medium | Send reminder email after 24h; auto-verify after 30 days; monitor bounce rate |
| Creators forget to set up payment (earnings lost) | Medium | High | Add prompt on Earnings page; email reminder "You're eligible to earn"; in-app notification |
| Fewer creators set up payment up-front | High | Medium | This is OK; we're optimizing for onboarding completion first; payment setup is secondary |
| Tax ID collection at payout time causes problems | Low | High | Test thoroughly in sandbox; finance reviews before production rollout |
| A/B test shows no improvement (or negative) | Low | High | Have rollback plan; revert to old flow if conversion drops >5% |
| Regulatory/compliance issue with deferred tax ID | Low | Critical | Finance to review before launch; possibly need legal review |

---

## 5. Success Criteria

### 5.1 Technical Success

- **Onboarding completion time:** Reduce from current 45 min (median) to <20 min (50% faster)
- **A/B test lift:** New flow should show ≥15% increase in publish completion rate vs. control
- **Zero data loss:** All creators' profile information preserved; no dropped fields during migration
- **Email verification:** ≥90% creators verify email within 30 days

### 5.2 Business Success

- **Onboarding completion:** Increase from 48% (current) to 70% (target)
- **Creator retention:** Creators who publish on Day 1 should have ≥75% 30-day retention (vs. current 50%)
- **Creator output:** 46% increase in new creators publishing in first week
- **Support reduction:** Onboarding-related support tickets ↓ 25%
- **Tax ID completion:** ≥85% of creators collect tax ID before first payout (indicating deferral is working)

### 5.3 Measurement Plan

| Metric | Source | Frequency | Success Threshold |
|--------|--------|-----------|-------------------|
| Signup → Publish conversion | PostHog funnels | Daily | Current 48% → Target 70% |
| Time to first publish | PostHog events | Daily | Median <20 min |
| 30-day retention | Cohort analysis | Weekly | Day 1 publishers ≥75% |
| Email verification rate | Email system logs | Daily | ≥90% within 30 days |
| Tax ID collection rate | Finance audit | Weekly | ≥85% before payout |
| Support tickets (onboarding) | Zendesk | Weekly | -25% vs. baseline |

---

## 6. Open Questions

**Q: If we defer tax ID collection, how do we ensure creators set it up before attempting payout?**
- A: TBD (legal/finance review). Likely: popup on Earnings page blocking withdrawal until tax ID provided.

**Q: What happens if creator doesn't verify email within 30 days?**
- A: TBD (design decision). Options: (a) auto-verify after 30d, (b) prompt them again before publishing, (c) allow publishing anyway (risky for compliance).

**Q: Should we track creators who start onboarding but never finish vs. creators who never start?**
- A: TBD (analytics decision). This will be important for understanding where we lose creators.

**Q: If A/B test shows new flow is worse, do we roll back or iterate?**
- A: TBD (product decision). Depends on why it's worse (one specific step causing drop-off? Or fundamental problem with deferral model?).

---

## 7. Design Review Checklist — UX Changes

- [ ] **Visual mockups created** ✅ (in Figma; shared with design lead)
  - Mobile (375px), tablet (768px), desktop (1024px) versions
  - Light + dark mode included
  - All interactive states (hover, active, disabled, error, loading) shown

- [ ] **Interaction states designed** ✅
  - Form submission loading state
  - Email verification pending state ("Check your email…")
  - Error states (invalid input, upload failure)

- [ ] **Brand consistency** ✅
  - Uses existing buttons, forms from studio-core library
  - Color palette: primary, secondary, success, error from design tokens
  - Typography: H1, H2, body text follow system

- [ ] **Accessibility** 🔲 (design lead review pending)
  - Keyboard navigation tested (tab order, focus indicator)
  - Screen reader compatible (labels, landmarks, ARIA)
  - Color contrast ≥ 4.5:1 (verified with contrast checker)
  - No motion/autoplay on load

- [ ] **Journey mapping** 🔲 (design meeting May 5)
  - Mapped to Creator Onboarding journey from T1.2
  - Decision points (social login? upload now or later?)
  - Alternative paths (multi-step vs. quick start)

- [ ] **Error states & edge cases** 🔲 (design meeting)
  - What if email verification fails?
  - What if upload fails mid-process?
  - What if creator already has account (signup twice)?

- [ ] **Mobile-first responsive** ✅
  - Touch targets ≥ 44x44px
  - Spacing optimized for mobile
  - No horizontal scrolling

- [ ] **Instrumentation & analytics** ✅
  - Events: `creator_started_onboarding`, `creator_profile_setup_completed`, `creator_first_video_uploaded`, `creator_published_first_video`, `creator_set_up_payment`
  - Success metrics: conversion at each step, time between steps
  - PostHog dashboard created

- [ ] **Design lead approval** 🔲 (pending; target May 5)

---

## 8. Related RFCs & Decisions

- **Depends on:** RFC-001 "Payout Batching Fix Model" (payment setup is now deferred; must ensure tax ID collected before payout)
- **Related to:** RFC-015 "Creator Earnings Dashboard" (flows into earnings setup)
- **Related to:** RFC-020 (future) "Social Login Integration" (could reduce onboarding steps further)

---

## 9. Appendix

### A. Mockups & Prototype

[Link to Figma: https://www.figma.com/file/...]

Interactive prototype: [Link to built prototype or Figma interactive version]

### B. A/B Test Configuration

**Control group:** Current 7-step flow (50% of signups)  
**Test group:** New 3-phase flow (50% of signups)  
**Duration:** 2 weeks (June 1–14)  
**Sample size:** ~50k signups  
**Metrics tracked:** See section 5.3

### C. Creator Feedback (Interview Highlights)

**Quote 1 (confusion about tax ID):**  
> "I wasn't sure if I had to give my tax ID right away. I just wanted to try uploading something first. Felt like a barrier."

**Quote 2 (form overwhelm):**  
> "There were so many fields on the profile form. I didn't know which were required. I just filled in the minimum and skipped the rest."

**Quote 3 (unclear upload process):**  
> "The upload tutorial went too fast. I had to rewatch it. Would be nice to have it step-by-step."

### D. Metrics Baseline (Pre-RFC)

- Onboarding completion: 48%
- Median time to first publish: 45 min
- 30-day retention (all creators): 55%
- 30-day retention (creators who publish Day 1): 81%
- Support tickets (onboarding): 240/week
- NPS (onboarding): 32

---

## 10. Discussions & Feedback (To Be Filled During Review)

**[Design lead feedback - pending]**

**[Engineering feedback - pending]**

**[Product feedback - pending]**

---

## Sign-Off (Pending)

**Status:** REVIEW (awaiting design + engineering + product sign-off)

**Target acceptance date:** May 5, 2026

**Reviewed by:**
- [ ] Design lead (pending)
- [ ] Head of engineering (pending)
- [ ] Product lead (pending)
- [ ] Finance/compliance (pending)

---

## Lifecycle Notes

- **Created:** April 28, 2026
- **Target merge:** May 5, 2026 (post-review)
- **Target ship:** June 30, 2026 (Q2)
- **Post-launch review:** August 2026 (30 days after rollout)
