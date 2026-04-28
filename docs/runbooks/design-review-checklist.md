# Design Review Checklist

**Document Version:** 1.0  
**Last Updated:** April 28, 2026  
**Purpose:** Ensure RFCs with UX/design changes meet quality standards before implementation

---

## When to Use This Checklist

**Use this checklist if your RFC includes any of these:**
- New customer-facing features or flows
- UX redesign of existing features
- Changes to creator experience or admin UI
- New form, modal, or dialog
- Changes to navigation or information architecture

**Skip this checklist if:**
- Backend-only API changes (no UI changes)
- Infrastructure/operational changes
- Bug fixes with no UX impact

---

## Pre-Review Gate: Designer Assignment

**Before scheduling review, confirm:**
- [ ] Design lead assigned to RFC (if not already)
- [ ] Designer has read RFC problem statement + solution
- [ ] Designer knows target audience (creators, end-users, admins?)
- [ ] Figma / prototype workspace created and shared

---

## Checklist Categories

### 1. Visual Design & Mockups

**Requirement:** Design creates visual mockups or interactive prototype before engineering starts.

- [ ] **Visual mockups created** in Figma or design tool (not just wireframes)
  - Mockups show: Desktop view, tablet view (if applicable), mobile view
  - Include: Light and dark modes (if applicable)
  - Prototype linked in RFC

- [ ] **Interaction states shown** (hover, active, disabled, error, loading)
  - Example: Show button in normal, hover, pressed, and disabled states
  - Example: Form fields show empty state, filled state, focused state, error state

- [ ] **Brand consistency checked**
  - Uses design system tokens (colors, typography, spacing)
  - Follows existing component library (buttons, inputs, modals from `@adrper79-dot/studio-core`)
  - Logo, brand colors, tone of voice aligned

- [ ] **Accessibility color contrast verified**
  - All text meets WCAG AA minimum (4.5:1 for normal text; 3:1 for large text)
  - Use tool: https://webaim.org/resources/contrastchecker/

- [ ] **Whitespace & hierarchy clear**
  - Visual grouping makes task flow obvious
  - No cluttered layouts; breathing room between elements
  - Information hierarchy matches user priorities

### 1a. Red Flags (Visual Design)

❌ **Design not approved by design lead before dev starts**  
❌ **Mobile view not considered** (if feature is consumer-facing)  
❌ **Color contrast < WCAG AA**  
❌ **Uses brand inconsistently** (colors, typography not from design system)  

---

### 2. User Journey & Information Architecture

**Requirement:** Feature aligns with creator/user journeys from T1.2 and makes logical sense in app flow.

- [ ] **Journey mapped to top 8 journeys** (or documented if new journey)
  - Which journey? (Sign-up, payment, payout, content discovery, etc.)
  - Where does this feature fit in the journey?
  - Are there alternative paths / edge cases?
  - Example from T1.2 reference: https://docs.factory.dev/packages/journeys.mdx

- [ ] **Information architecture makes sense**
  - Placement in navigation/menu is logical
  - Related features are grouped together or linked
  - New pages/sections reduce (not add) user cognitive load
  - Deep-link structure clear (e.g., /creator/[id]/payout-status vs /admin/payout-status)

- [ ] **Task flow documented**
  - User journey shown as flowchart or step-by-step (Miro, Figma, or text)
  - Decision points shown (if user takes Action A vs Action B, where do they go?)
  - Example: Creator views payout → clicks "What does processing mean?" → sees help text

- [ ] **Onboarding/education designed**
  - First-time user experience (empty states, tooltips, guided tour?)
  - Help text written for every new field/action
  - Glossary defined (if introducing new terminology)

### 2a. Red Flags (Journey)

❌ **Feature breaks existing user flow** (requires convoluted workarounds)  
❌ **No clear call-to-action** (where does user go next?)  
❌ **Edge cases unaddressed** (what if user has no payouts? multiple accounts? etc.)  
❌ **New terminology without definition**  

---

### 3. Accessibility Requirements

**Requirement:** Design is accessible to users with disabilities (WCAG 2.2 Level AA minimum).

- [ ] **Keyboard navigation tested**
  - Tab order makes sense (top-to-bottom, left-to-right)
  - Can all actions be performed via keyboard (no mouse-only features)?
  - Skip-to-content link present (for long pages)
  - Focus indicator visible on all interactive elements

- [ ] **Screen reader compatible**
  - Text labels on all icons (aria-label or visible text)
  - Form labels programmatically associated (not just placeholder text)
  - Heading hierarchy correct (h1, h2, h3 in order; no skipping levels)
  - ARIA landmarks used: `<main>`, `<nav>`, `<aside>`, `<form>`, etc.
  - Example: `<button aria-label="Close menu">×</button>` (not just `<button>×</button>`)

- [ ] **Color not the only indicator**
  - Errors shown with icon + color (not color alone)
  - Links distinguished from text (underline or icon, not color alone)
  - Example: Don't use "red text" for errors; use "❌ Error: " + red text

- [ ] **Motion & animation safe**
  - Animations don't auto-play on page load (can trigger motion sickness)
  - Respects `prefers-reduced-motion` CSS media query
  - Autoplay videos include `autoplay muted` (not autplay with sound)

- [ ] **Readability defaults**
  - Font size ≥ 16px minimum for body text (mobile-friendly)
  - Line-height ≥ 1.5 (space between lines)
  - Line length ≤ 80 characters (readability max-width)
  - Sans-serif font for UI (better on screens than serif)

- [ ] **Mobile text zooming works**
  - No `user-scalable=no` in viewport meta tag
  - Text should be zoomable to 200% without horizontal scrolling

### 3a. Tools & Testing

**Use these tools to verify accessibility:**

- **Color contrast:** https://webaim.org/resources/contrastchecker/
- **Automated audit:** https://www.deque.com/axe/devtools/ or Chrome DevTools → Lighthouse
- **Manual keyboard test:** Tab through entire UI; verify focus is visible
- **Screen reader test:** NVDA (Windows) or VoiceOver (Mac) — read through page
- **Mobile zoom test:** Firefox DevTools → Responsive Design Mode → Zoom to 200%

### 3b. Red Flags (Accessibility)

❌ **Color contrast < 4.5:1** (fails WCAG AA)  
❌ **Form inputs have no labels** (screen reader reads nothing)  
❌ **Focus indicator invisible** (can't see where you are on page)  
❌ **Keyboard shortcuts with no mouse alternative**  
❌ **Autoplaying video with sound** (jarring for users with sensory issues)  

---

### 4. Error States & Edge Cases

**Requirement:** Design anticipates what happens when things go wrong.

- [ ] **Error states designed**
  - What if API call fails? (Show friendly error message, not "error 500")
  - What if user submits empty form? (Highlight required fields)
  - What if network is slow? (Loading spinner, "please wait…")
  - Example error states in Figma: empty state, error state, loading state

- [ ] **Empty states designed**
  - What if creator has no payouts yet? (Show illustration + "You'll see payouts here once approved")
  - What if search returns no results? (Clear message + suggestion)
  - Includes call-to-action or next step (not just "Nothing here")

- [ ] **Timeouts & retries handled**
  - What if user loses internet mid-action? (Graceful retry or save state)
  - What if user tabs away and comes back 10 min later? (Still works? Or re-auth needed?)
  - What if operation takes >5 seconds? (Progress indicator; maybe cancel option)

- [ ] **Permission errors designed**
  - What if user lacks permission? (Friendly "You don't have access" vs. 403)
  - What if permission expires mid-action? (Prompt re-auth gracefully)
  - What if user tries to access deleted item? (404 page designed; not generic error)

- [ ] **Data validation shown**
  - Invalid email format → error message shown below field (not after submit)
  - Required field left empty → clear indication which field is required
  - Example: "Email is required. Enter a valid email address."

### 4a. Red Flags (Error Handling)

❌ **No error states shown** (how does user know something failed?)  
❌ **Error messages are technical** ("JSON parse error" vs. "something went wrong, please try again")  
❌ **No empty state design** (what does user see when no data exists?)  
❌ **Spinners but no timeout** (user waits forever if API hangs)  

---

### 5. Responsive Design (Mobile-First)

**Requirement:** If feature is consumer-facing, mobile view is designed and tested.

- [ ] **Mobile-first strategy documented**
  - Desktop view is enhancement of mobile (not mobile view is shrunk desktop)
  - Touch targets ≥ 44x44px (big enough for fingers; WCAG AA)
  - Spacing increased for mobile (touch needs more breathing room)

- [ ] **Breakpoints defined**
  - Mobile (default): 375px (iPhone SE width)
  - Tablet: 768px (iPad width)
  - Desktop: 1024px+
  - Browser window resize tested

- [ ] **Tap-friendly UI**
  - Buttons and links ≥ 44x44px
  - Spacing between tappable items ≥ 8px (prevent accidental misclicks)
  - No hover-only content (mobile has no hover!)

- [ ] **Responsive images**
  - Images scale to fit screen without stretching
  - High-DPI displays (2x, 3x pixel density) handled
  - Alt text on all images (for screen readers)

- [ ] **Responsive typography**
  - Font sizes scale with screen size (not fixed pixel sizes)
  - Headings don't wrap awkwardly on mobile
  - Line length stays readable on mobile (max 80 chars)

- [ ] **No horizontal scrolling** (except intentional horizontal lists, e.g., carousels)
  - All content fits viewport width
  - Forms, tables, content reflow (not scroll horizontally)

### 5a. Testing Tools

- **Responsive simulator:** Chrome DevTools → Ctrl+Shift+M (or Cmd+Shift+M on Mac)
- **Real device testing:** Test on iPhone 13–14 mini (375px), iPhone 13–14 Pro (390px), iPad (768px)
- **Touch simulation:** Chrome DevTools → Sensors → Touch

### 5b. Red Flags (Responsive)

❌ **Mobile mockups not created** (only desktop shown)  
❌ **Touch targets < 44x44px** (too small for fingers)  
❌ **Horizontal scrolling required** (user has to scroll sideways)  
❌ **Text unreadable on mobile** (font too small or line length too long)  

---

### 6. Instrumentation & Analytics

**Requirement:** Design specifies what events to track (PostHog instrumentation).

- [ ] **User actions tracked**
  - What are the key user actions? (view page, click button, fill form, etc.)
  - Which actions should be tracked? (all? only important ones?)
  - Event names defined: `button_click`, `form_submitted`, `error_shown`, etc.
  - Example: `posthog.capture('creator_viewed_payout_status', { status: 'processing' })`

- [ ] **Success metrics defined**
  - How will we know users are adopting this feature?
  - Example: "If 40% of creators view payout status within 1 week, feature is successful"
  - Events to track: `page_view`, `button_click`, `action_completed`, `error_encountered`

- [ ] **Debugging events added**
  - If feature is complex, add debugging events (logged but not publicly visible)
  - Example: `creator_payout_status_api_latency_ms: 245` (helps diagnose slow loads)

- [ ] **Privacy considered**
  - No PII captured in events (emails, phone numbers, account numbers)
  - Example: ❌ `user_email: 'alice@example.com'`; ✅ `user_email_domain: 'example.com'`

### 6a. PostHog Integration

**Add to RFC:**

```markdown
## Instrumentation

**Events to track:**

| Event Name | Trigger | Properties | Purpose |
|------------|---------|-----------|---------|
| `creator_viewed_payout_status` | User navigates to payout page | `{status: 'processing' \| 'sent' \| 'failed'}` | Adoption tracking |
| `creator_clicked_payout_help` | User clicks "?" icon | `{section: 'processing' \| 'bank_delay' \| ...}` | Help effectiveness |
| `creator_copy_payout_ref` | User copies payout reference # | `{}` | Utility signal |
| `payout_status_load_error` | Page fails to load | `{error_type: 'api_timeout' \| 'permission' \| ...}` | Error diagnosis |

**Dashboard:** [Link to PostHog dashboard]
```

### 6b. Red Flags (Instrumentation)

❌ **No events tracked** (how do we know if feature is working?)  
❌ **PII in events** (privacy violation; Sentry flags this as leak)  
❌ **Event names unclear** (what does `action_123` mean?)  
❌ **No success definition** (how will we measure feature success?)  

---

### 7. Brand & Design System Alignment

**Requirement:** Design uses existing design system; new patterns propose updates to system.

- [ ] **Component reuse verified**
  - Uses existing buttons, inputs, cards from `@adrper79-dot/studio-core` (not custom HTML)
  - If new component needed, documented in RFC
  - Component library version pinned

- [ ] **Design tokens used**
  - Colors: Uses palette from design system (not arbitrary hex colors)
  - Spacing: Multiples of 8px or 4px (not random sizes)
  - Typography: Predefined font scales (h1, h2, p, etc.)
  - Example: ✅ `color.primary`, ✅ `spacing.md` (16px); ❌ `#3E7C8E`, ❌ `padding: 13px`

- [ ] **Brand voice consistent**
  - Copy is friendly, approachable, not corporate or robotic
  - Example: ✅ "Your payout is on the way!"; ❌ "Payout status: processing"
  - Error messages empathetic (not blame user)
  - Example: ✅ "We couldn't load your payouts. Let's try again."; ❌ "Request failed"

- [ ] **Tone & microcopy reviewed**
  - Button labels are action-oriented (verb + noun)
  - Example: ✅ "View Help", ✅ "Copy Reference"; ❌ "Click Here"
  - Consistency in terminology (don't use "payout" and "disbursement" interchangeably)

### 7a. Red Flags (Brand & System)

❌ **Custom component built instead of using library**  
❌ **Arbitrary colors/spacing used** (not from design tokens)  
❌ **Copy is inconsistent** (mixes casual language with corporate tone)  
❌ **Missing microcopy** (buttons just say "OK" instead of "Save Changes")  

---

## Design Review Meeting Agenda (30 min)

**Attendees:** Design lead, 1–2 eng leads, product lead (optional)

**Format:**

| Time | Topic | Owner |
|------|-------|-------|
| 0–5 min | **Introductions & problem** | RFC author |
| 5–15 min | **Walkthrough mockups** | Designer |
| 15–20 min | **Q&A & feedback** | Everyone |
| 20–30 min | **Accessibility & edge cases** | Designer + everyone |

**Output:** Design approval ✅ OR  "small tweaks, then approved" OR "major revisions needed, reschedule"

---

## Sign-Off

**Design lead approval is a gate to coding start.**

Once all checklist items are complete and design lead approves, add to RFC:

```markdown
## Design Review Approval

✅ **Approved by:** [Design Lead Name] on [Date]

**Checklist:**
- [x] Visual mockups complete and reviewed
- [x] Journey mapped to creator journeys from T1.2
- [x] Accessibility: WCAG 2.2 AA verified
- [x] Error states and empty states designed
- [x] Mobile-first responsive design
- [x] Analytics/instrumentation defined
- [x] Brand consistency checked

**Feedback:** [Summary of any tweaks requested and implemented]
```

**After approval:** Eng team can start implementation. Code review will check for adherence to approved design.

---

## Exceptions

**Can we skip design review?**

- ❌ Never for customer-facing features
- ✅ OK for backend-only API changes
- ✅ OK for small bug fixes (internal changes)
- ⚠️ If Urgent security fix: Skip review, merge ASAP, add design review post-launch

---

## Related Documents

- [RFC Template](../templates/RFC_TEMPLATE.md) — Includes design review checklist reference
- [RFC Process](rfc-process.md) — Describes when design review happens
- [Definition of Ready & Done](definition-of-ready-done.md) — Gates design approval before coding
- [Frontend Standards](../packages/frontend-standards.mdx) — Component library & patterns
- [Design Standards & Rubrics](../packages/design-standards.mdx) — Brand guidelines

---

## Questions?

- **Design question?** Ask design lead (#design Slack)
- **Accessibility question?** Follow [WCAG 2.2 checklist](https://www.w3.org/WAI/standards-guidelines/wcag/glance/) or ask accessibility specialist
- **Post-launch audit?** File issue with label `design-debt`
