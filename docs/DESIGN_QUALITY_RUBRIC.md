# Design Quality Rubric & Principles

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T1.1 — Define Design Principles and Product Quality Rubric  
**Reference Implementation:** VideoKing

---

## Mission

Establish a **measurable design quality bar** that every feature must meet before shipping. This rubric:
- Prevents "feature-complete but ugly" outcomes
- Ensures consistent user experience across all Factory apps
- Makes design review objective, not subjective
- Applies to all surfaces: viewer journeys, creator dashboards, operator flows, admin interfaces

---

## Design Principles (Foundational)

### 1. User Clarity Over Visual Cleverness

**Principle:** Users should understand what to do within 2 seconds of landing on a screen.

**Implementation:**
- Clear primary action button (CTA) — label clearly states outcome ("Subscribe for $5/month", not "Next")
- Hierarchy: Headline → Context → CTA → Secondary options
- Microcopy removes ambiguity (e.g., "Unlock video" vs "Buy", "Reconnect your Stripe account" vs "Settings")

**Fails When:**
- Icon-only buttons without tooltip
- Headline buried below fold
- Multiple primary CTAs (user doesn't know what to do)
- Form labels that are vague ("Details" instead of "Creator Name")

**Review Check:** Show design to non-technical person; ask what action they'd take. If they hesitate > 2 sec, fail.

---

### 2. Accessibility is Built In, Not Bolted On

**Principle:** Designs must be accessible to all users from day one, including those with visual, motor, cognitive, and auditory differences.

**Implementation:**
- **Color:** Never use color alone to convey meaning. Red error + ❌ icon. Status chips use color + icon + text.
- **Contrast:** WCAG 2.2 AA minimum (4.5:1 for body text, 3:1 for large text)
- **Focus:** Keyboard navigation visible (focus indicator at least 3px, not removed with `outline: none`)
- **Motion:** No auto-play animations > 5 seconds; respect `prefers-reduced-motion`
- **Form Labels:** All inputs have `<label>` or `aria-label`; error messages linked to inputs
- **Images:** All images have descriptive alt text (or marked decorative)

**Fails When:**
- Status only shown by color ("green means ready")
- Text color < 4.5:1 contrast on background
- Focus indicator invisible or removed
- Videos auto-play sound
- Form input without associated label

**Review Check:** Run Axe accessibility scan; manual keyboard-only navigation; zoom to 200%.

---

### 3. Consistency Reduces Cognitive Load

**Principle:** Users shouldn't have to re-learn the interface on every screen. Patterns repeat; exceptions are rare and justified.

**Implementation:**
- **Buttons:** All primary actions use same button style (color, size, corner radius)
- **Status states:** All modals have close button (top-right X); all forms have cancel button
- **Spacing:** Use defined spacing scale (4px, 8px, 12px, 16px, 24px, 32px, 48px)
- **Typography:** 3–4 font sizes max (headline, subheading, body, small); consistent line-height
- **Icons:** All icons from same set (Feather, Heroicons, etc.); sized consistently (16px, 20px, 24px)

**Fails When:**
- Different button styles for same action in different flows
- Some forms have cancel buttons, others don't
- Arbitrary spacing (15px here, 14px there)
- 5+ different font sizes in same page
- Mixed icon sets (Material Design + Font Awesome)

**Review Check:** Design components audit; compare against component library.

---

### 4. Fast is a Feature

**Principle:** Performance is a design problem. Slow interactions feel broken.

**Implementation:**
- **Page load:** Initial meaningful paint < 2s (measured on 4G mobile)
- **Navigation:** Route transitions < 300ms (no loading spinner visible)
- **Interactions:** Button press → visual feedback within 100ms (ripple, color change, icon animation)
- **Search:** Search results appear as user types (auto-complete, no Enter required)
- **Video playback:** Stream starts within 2s; quality adapts to bandwidth

**Fails When:**
- Page load > 3s
- Click button → 500ms delay before anything happens
- Forms refresh entire page instead of inline validation
- Search requires manual submit
- Video takes > 5s to start

**Review Check:** Lighthouse score > 85; real-device testing on 4G mobile.

---

### 5. Trust Through Transparency

**Principle:** Users should never wonder if their action succeeded or failed. State must be visible and verifiable.

**Implementation:**
- **Confirmations:** Destructive actions require explicit confirmation ("Delete" button → modal with "Are you sure?" + "Delete" + "Cancel")
- **Progress:** Long operations show progress bar or spinner with estimated time
- **Errors:** Error messages are specific ("Email already used by another account" not "Error")
- **Success:** Success state visible for 2–3 seconds after action (green checkmark, toast notification)
- **Loading states:** Skeletons, spinners, or placeholders when content loading; never blank

**Fails When:**
- Clicking "delete" immediately deletes without warning
- Long process with no indication of progress
- "Something went wrong" with no explanation
- Success state disappears instantly
- Blank page while content loads

**Review Check:** End-to-end flow testing; verify error handling paths.

---

### 6. Mobile-First Design

**Principle:** Design for constraints first (mobile), then enhance for larger screens.

**Implementation:**
- **Breakpoints:** Design at 375px (mobile), 768px (tablet), 1440px (desktop)
- **Touch targets:** All interactive elements ≥48px × 48px
- **Scrolling:** Content tall but not > 5 viewport heights; above-the-fold has primary CTA
- **Responsive:** Text scales to fit screen; images don't crop on mobile; no horizontal scroll
- **Gestures:** Swipe, tap, double-tap work as expected

**Fails When:**
- Button < 44px (too small to tap)
- Text forces horizontal scroll on mobile
- Images crop or distort on smaller screens
- Desktop design scaled down for mobile (text too small)

**Review Check:** Test at 375px, 768px, 1440px widths; touch-test on real phone.

---

## Design Quality Rubric (Measurable)

### Component-Level Checks

Every UI component must pass these checks before code review:

| Category | Criterion | Pass | Fail |
|----------|-----------|------|------|
| **Clarity** | User understands primary action within 2 sec | CTA clearly labeled + positioned | Ambiguous label or hidden action |
| **Accessibility** | Axe scan passes (0 critical errors) | Scan shows 0 violations | Any violations reported |
| **Accessibility** | Color + text conveys meaning | "Red + ❌ = error" not "just red" | Color-only meaning |
| **Accessibility** | Focus indicator visible | Tab key shows clear focus ring | No visible focus or `outline: none` |
| **Accessibility** | Contrast ≥ 4.5:1 (AA) | Text readable on background | Contrast < 4.5:1 |
| **Consistency** | Button style matches design system | Button uses defined color + size | Custom button style |
| **Consistency** | Spacing uses 8px grid | All margins/padding = 8, 16, 24, 32px | Arbitrary 15px, 13px spacing |
| **Consistency** | Icon size consistent | All icons same size in context | Mixed 20px + 24px icons |
| **Performance** | Interactive response < 100ms | Click → ripple/color change visible | > 500ms delay before feedback |
| **Performance** | Load time < 2s (4G mobile) | Lighthouse score > 85 | LH < 85 or > 2s load |
| **Trust** | Destructive actions require confirmation | Delete → modal confirmation | Direct deletion |
| **Trust** | Error messages specific | "Email already used" not "Error occurred" | Generic error message |
| **Trust** | Success state visible 2–3 sec | Checkmark or toast after submission | Success state disappears instantly |
| **Mobile** | Touch targets ≥ 48px | Button = 48×48px minimum | Button < 44px |
| **Mobile** | No horizontal scroll on 375px | Content fits 375w viewport | Text forces horizontal scroll |

---

## Design Review Checklist

**Before Code Review:** Design lead + PM sign off on these items:

### Visual Design
- [ ] Comp matches reference app (VideoKing, not a new style)
- [ ] Color palette (primary, secondary, accent, neutral) uses defined tokens
- [ ] Typography sizes, weights, line-heights follow design system
- [ ] Spacing on 8px grid (all margins/padding = 8, 16, 24, etc.)
- [ ] Icons from unified icon set; sized consistently (16px, 20px, 24px)
- [ ] States designed (hover, active, disabled, error, success)

### Clarity & UX
- [ ] Primary action clear and prominent
- [ ] Form labels clear; required fields marked
- [ ] Error states explain what went wrong ("Email is required" not "Invalid input")
- [ ] Success states confirm action ("Payment processed" with amount)
- [ ] Loading states prevent assumption that nothing happened (skeleton, spinner, toast)
- [ ] Empty states explain what to do next ("No videos yet. Upload your first video")

### Accessibility
- [ ] Axe scan exported; 0 violations shown
- [ ] Keyboard-only navigation tested (Tab, Enter, Arrow keys work)
- [ ] Color not sole indicator (status uses icon + text + color)
- [ ] Contrast verified (4.5:1 for body text, 3:1 for large text)
- [ ] Form labels linked to inputs (not placeholder-only)
- [ ] Alt text written for all images

### Responsive Design
- [ ] Tested at 375px, 768px, 1440px
- [ ] Touch targets ≥ 48px on all screens
- [ ] No horizontal scroll on mobile
- [ ] Images don't distort or crop on smaller screens
- [ ] Text readable without pinch-zoom

### Performance
- [ ] Lighthouse score ≥ 85 (desktop + mobile)
- [ ] LCP (Largest Contentful Paint) < 2s (4G throttle)
- [ ] No layout shift (CLS score < 0.1)
- [ ] Images optimized (WebP, lazy-loaded if below fold)

### Code Quality
- [ ] Component uses design system tokens (not hardcoded colors/sizes)
- [ ] CSS follows BEM or component CSS conventions
- [ ] No magic numbers (all sizes/spacings justified)
- [ ] Animations performant (GPU-accelerated, `transform`/`opacity` only)

---

## Design System Reference (VideoKing Baseline)

### Color Palette

| Usage | Value | Example |
|-------|-------|---------|
| **Primary** (CTA, active states) | #FF006B (vibrant red) | Subscribe button |
| **Secondary** (links, hover states) | #8F5FFF (purple) | Secondary CTA |
| **Success** (completion, checkmark) | #00B366 (green) | "Payout successful" |
| **Warning** (caution, rate limit) | #FFB347 (orange) | "Rate limited; retry in 30s" |
| **Error** (failures, validation) | #FF3B30 (red) | "Email already used" |
| **Neutral** (text, borders) | #333333 (dark gray), #F5F5F5 (light gray) | Body text, dividers |

**Contrast Check:** All text uses #333 or #FFFFFF on semantic colors; all pass 4.5:1 (AA).

### Typography

| Role | Font | Size | Weight | Line-Height |
|------|------|------|--------|-------------|
| **H1 (Page Title)** | Inter | 32px | Bold (700) | 40px |
| **H2 (Section)** | Inter | 24px | Bold (700) | 32px |
| **H3 (Subsection)** | Inter | 18px | Semibold (600) | 27px |
| **Body** | Inter | 16px | Regular (400) | 24px |
| **Small** | Inter | 14px | Regular (400) | 21px |
| **Label** | Inter | 12px | Medium (500) | 18px |

**Note:** All font sizes responsive at 375px (reduce by 20–30% on mobile).

### Spacing Scale

```
4px   (gap between inline elements)
8px   (small margin, padding)
12px  (standard margin between elements)
16px  (standard padding, spacing)
24px  (larger spacing between sections)
32px  (extra-large spacing between major sections)
48px  (hero section margin)
```

### Components (Design System Inventory)

| Component | States | Variants |
|-----------|--------|----------|
| **Button** | default, hover, active, disabled | primary (red), secondary (purple), ghost (outline) |
| **Badge** | default, hover | info (gray), success (green), warning (orange), error (red) |
| **Card** | default, hover | elevated (shadow), flat (border) |
| **Input** | default, focused, disabled, error | text, email, password, number, select |
| **Checkbox** | unchecked, checked, disabled, indeterminate | - |
| **Radio** | unchecked, checked, disabled | - |
| **Toggle** | off, on, disabled | - |
| **Modal** | default, loading, error, success | large (80vw), small (60vw), full (100vw) |
| **Toast** | info, success, warning, error | top, bottom (position) |
| **Skeleton** | - | - |
| **Spinner** | - | sizes (sm, md, lg) |
| **Status Chip** | pending, active, paused, completed, failed | - |

---

## Design-to-Code Handoff

### Before Engineers Start

1. **Design spec exported** (Figma → Zeplin or similar)
   - Component library linked
   - Spacing/colors/fonts documented
   - Interactions + animations described

2. **Accessibility audit completed**
   - Axe scan passed
   - Color contrast verified
   - ARIA labels planned

3. **Responsive breakpoints defined**
   - 375px, 768px, 1440px comps provided
   - Touch/click targets verified ≥ 48px

4. **Design review approved**
   - Design lead: "Ready to build"
   - PM: "Matches product intent"
   - Engineering lead: "Technically feasible"

### During Implementation

- Engineers use Figma (read-only) to measure spacing, colors, sizes
- Design tokens (colors, fonts, spacing) injected via CSS variables
- Components tested in browser during dev; design lead spot-checks
- Accessibility testing runs in CI (Axe + Lighthouse)

### Post-Implementation

- Design lead reviews built component in staging
- A/B testing (if product decision needed)
- Performance testing (Lighthouse CI gate)

---

## Common Design Mistakes (Anti-Patterns)

| Mistake | Why Bad | Fix |
|---------|---------|-----|
| Color-only status | Colorblind users miss meaning | Add icon + text to color |
| Text too small on mobile | Unreadable without pinch-zoom | 16px minimum; 18px preferred |
| No loading state | Users think button is broken | Show spinner or disable button |
| Form error doesn't link input | User doesn't know which field | Use `aria-describedby` to link |
| Destructive action no confirmation | Accidental clicks cause data loss | Require modal confirmation |
| Hardcoded colors in CSS | Design system impossible to maintain | Use CSS variables; reference tokens |
| Hover-only interaction | Mobile users can't access feature | Use tap; add fallback for desktop |
| Animated transition > 300ms | Feels sluggish and unresponsive | Keep animations < 300ms |
| Icon without tooltip | Users don't know what it does | Add `title` or `aria-label` |

---

## Design Review Gates (CI/CD Integration)

### Pre-Code-Review (Designer Gate)

**Trigger:** PR created with design changes

**Checks:**
- [ ] Figma link present + approval noted
- [ ] Axe scan 0 violations (exportable proof)
- [ ] Lighthouse score ≥ 85 (target: staging deploy)
- [ ] Responsive design tested 375px, 768px, 1440px

**Block Merge If:**
- Figma not approved
- Axe scan shows violations
- Lighthouse < 85
- Mobile design missing

### Post-Code-Review (Automated Gate)

**Trigger:** Code review approved; before merge

**Checks:**
- [ ] CSS lint (no undefined colors/sizes; all use design tokens)
- [ ] Axe scan in built component (0 violations)
- [ ] Lighthouse CI gate (≥ 85; no regression)
- [ ] No console warnings (accessibility, performance)

**Block Merge If:**
- Hardcoded colors (not using CSS variables)
- Axe violations in component
- Lighthouse regression > 10 points
- Console warnings detected

---

## Design Review Meeting Format

**When:** Weekly design review (Tuesdays 2pm UTC)  
**Duration:** 30 minutes  
**Attendees:** Design lead, PM, 1–2 engineers, on-call (if applicable)

**Agenda:**
1. **New designs in review** (15 min)
   - Designer presents comp + rationale
   - Team checks against rubric
   - Approve or request changes

2. **Built components in staging** (10 min)
   - Review against Figma
   - Test accessibility + responsiveness
   - Sign off or request tweaks

3. **Meta** (5 min)
   - Blockers? Process working?
   - Design system gaps?
   - Next week's work preview

---

## T1.1 Exit Criteria (by May 22, 2026)

- [x] Design principles documented (6 principles)
- [x] Quality rubric with measurable criteria (15 checks per component)
- [ ] Design review checklist published and adopted
- [ ] Design system inventory documented (VideoKing baseline)
- [ ] CI gates configured (Axe + Lighthouse)
- [ ] Team trained on rubric + process (1 design review session)
- [ ] Rubric used in ≥3 code reviews (proven adoption)

---

## Appendix: Example Design Review Pass/Fail

### ✅ PASS: Creator Subscribe Button

**Figma Design:**
- Red button (#FF006B)
- Label: "Subscribe for $5/month"
- Size: 48px × 48px (within mobile touch target)
- Hover state: Slightly darker red (#E60060)

**Checklist:**
- [x] Clarity: CTA clear; label explains outcome
- [x] Accessibility: Axe scan 0 issues; contrast 7:1 (AA)
- [x] Consistency: Primary button style; uses design tokens
- [x] Performance: No animation; instant click feedback
- [x] Trust: Next screen shows confirmation ("Confirm subscription")
- [x] Mobile: 48×48px touch target; responsive

**Result:** Approve

---

### ❌ FAIL: Video Status Indicator

**Figma Design:**
- Only a colored dot (green = processing, red = failed)
- No label

**Checklist:**
- [x] Clarity: User must hover to understand
- ❌ **Accessibility: Color-only meaning; colorblind users can't distinguish**
- ❌ **Accessibility: No tooltip or aria-label; hidden meaning**
- [ ] Consistency: Others use icon + text
- [ ] Performance: Unclear (might have animation)
- [ ] Trust: User can't verify state without guessing
- ❌ **Mobile: No touch target for tooltip; unclear on small screens**

**Fix Required:**
- Replace with colored badge: colored background + icon + text ("Processing" or "Failed")
- Add tooltip on hover: "Videos are being transcoded"
- Testing: Passes Axe; colorblind test passes

**Result:** Reject; request revision

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Design Lead | Initial design rubric + principles; VideoKing baseline; exit criteria |

---

**Status:** ✅ T1.1 READY FOR TEAM TRAINING  
**Next:** T1.2 (Journey Maps) — starts May 8, depends on T1.1 approval

