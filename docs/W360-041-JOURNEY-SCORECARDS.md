# W360-041: Journey Baselines and Scorecards

**Date:** April 29, 2026  
**W360 Tranche:** World Class 360 — Shared UI/UX quality model  
**Depends on:** W360-039 (design tokens), W360-040 (UI primitives), W360-038 (auth framework), W360-006 (Admin Studio safety)  
**Blocks:** W360-042 (UI regression gates), W360-043 (SelfPrime hardening), W360-044 (Admin Studio UX)  
**Disciplines:** D01 (coordination), D02 (product), D03 (design), D04 (frontend), D10 (observability), D12 (QA), D14 (launch)

---

## Executive Summary

Every critical surface in World Class 360 tranche now has an explicit journey spec with:
- **4-stage user flow** (discovery → engagement → action → confirmation)
- **Moment of truth checkpoints** (UX debt inventory)
- **KPI targets** (baseline → Phase C goal)
- **Instrumentation contract** (required analytics events)
- **Scorecard criteria** (a11y, performance, mobile, conversion, trust)

This document defines the **minimum viable quality bar** for each surface. W360-042 will wire these into automated regression gates (Playwright, axe, Lighthouse). W360-043 and W360-044 will execute hardening to meet the Phase C targets.

---

## Part 1: Journey Template (Reusable)

Every journey in this tranche follows this structure:

| Field | Content |
|---|---|
| **User Goal** | What does the user/operator want to accomplish? |
| **Context** | When/where/why do they attempt it? |
| **Persona/Role** | Who is performing this flow? |
| **Reversibility** | Is this reversible/retryable? (from W360-006 safety model) |
| **Auth Requirement** | Public, anonymous, authenticated, role-gated? |
| **Stage 1: Discovery** | How do they find this? Moment of truth? UX debt? |
| **Stage 2: Engagement** | Interactive decision point. Do they proceed? |
| **Stage 3: Action** | Core workflow. Do they complete? |
| **Stage 4: Confirmation** | Final state. Do they understand? Next steps? |
| **Current Metrics** | Today's baseline (from PostHog/analytics) |
| **Target Metrics (Phase C)** | What we commit to by launch |
| **Instrumentation** | Required PostHog events + funnel definition |
| **Scorecard Criteria** | a11y, performance, mobile, conversion, trust checks |
| **Proof Requirements** | Screenshots, video, a11y audit, Lighthouse, interaction timing |

---

## Part 2: SelfPrime Journeys

### Journey A1: Public Landing → Free Video Watch

**User Goal:** Discover and watch a free video to evaluate membership value  
**Context:** Stranger clicks link from YouTube, Twitter, or email; arrives cold  
**Persona:** Prospective paid subscriber (funnel top)  
**Reversibility:** N/A (read-only)  
**Auth Requirement:** Public (anonymous)

#### Stage 1: Discovery
- **Touchpoint:** Landing page with video embed + metadata (creator, title, description, duration, view count)
- **Moment of Truth:** Does the page load? Is the video thumbnail and CTA visible within 2s (LCP)?

| UX Debt | Current | Target (Phase C) |
|---------|---------|---|
| Page load time (Largest Contentful Paint) | 2.8s | ≤ 2.0s |
| Embed visible | 2.5s | ≤ 1.0s |
| Creator name prominence | Meta line | Hero section |
| Video duration indicator | Hidden | Visible + estimated watch time |
| Social trust signals (views, ratings, creator badge) | Missing | Shown inline |

#### Stage 2: Engagement
- **Touchpoint:** Click "Watch Now" or modal CTA
- **Moment of Truth:** Do they understand this is free? Is the player intuitive?

| UX Debt | Current | Target |
|---------|---------|--------|
| Free vs paid clarity | Implicit | Explicit badge |
| Player UX (play, pause, seek, fullscreen) | Responsive | Touch-optimized (44px targets) |
| Caption toggle discoverability | Hidden in player | Inline toggle |

#### Stage 3: Action
- **Touchpoint:** Video playback, seek, pause, exit
- **Moment of Truth:** Do they stay? Do they start watching? (first 10s critical)

| Metric | Baseline | Target (Phase C) |
|--------|----------|---|
| Video plays | 100% click | 100% |
| Watches ≥ 10s | 65% | ≥ 80% |
| Watches ≥ 50% | 42% | ≥ 60% |

#### Stage 4: Confirmation
- **Touchpoint:** End video state, suggested next video, CTA to subscribe
- **Moment of Truth:** Do they understand the value prop? Do they click subscribe?

| UX Debt | Current | Target |
|---------|---------|--------|
| Next video suggestion | Missing | Carousels + "More from creator" |
| Subscribe CTA in end state | Subtle link | Prominent button + pricing transparent |
| Share options | Link only | Native share + social copy |

#### Instrumentation (PostHog Events)
```
Required Events:
- video_page_viewed { videoId, creatorId, referrerSource }
- video_play_started { duration, quality }
- video_seeked { from%, to%, method } — capture 2+ seeks per video
- video_completed { watchDuration%, watchTime, completionTime }
- video_quality_changed { newQuality, reason }
- subscribe_cta_clicked { location, price, variant }
- video_shared { medium, context }

Funnel Definition:
video_page_viewed → video_play_started → video_seeked → video_completed → subscribe_cta_clicked
Target funnel pass rate (Phase C): 50% of viewers complete + click subscribe
```

#### Scorecard Criteria (W360-042 gate)
| Criterion | WCAG / Standard | Target | Check Method |
|-----------|---|---|---|
| **a11y: Color contrast** | WCAG AA (4.5:1 text, 3:1 UI) | ✅ Pass | axe audit |
| **a11y: Keyboard navigation** | WCAG 2.1 2.1.1 | All controls keyboard-accessible | Manual + Playwright interaction |
| **a11y: Focus visible** | WCAG 2.4.7 | 3px outline (from design-tokens) | Visual inspection + CSS check |
| **a11y: Video captions** | WCAG 2.1 1.2.3 | Captions present + toggle works | Manual + text-search |
| **Performance: LCP** | Google Core Web Vitals | ≤ 2.0s | Lighthouse (lab + field via PerformanceObserver) |
| **Performance: CLS** | Google Core Web Vitals | ≤ 0.1 | Lighthouse |
| **Performance: FID/INP** | Google Core Web Vitals | ≤ 100ms | Lighthouse INP |
| **Mobile: Touch targets** | Apple HIG / Android Material | 44px minimum | screenshot pixel check + axe |
| **Mobile: Viewport scaling** | Responsive design | No manual zooming | Mobile device test (375px to 1440px) |
| **Conversion: Subscribe CTA**  | UX best practices | Visible in top 3 clicks | Heatmap or click tracking |
| **Trust: Creator badge** | Brand consistency | Visible when creator is verified | Manual spot check |
| **Interaction timing** | UX perception | Click-to-response ≤ 200ms | Synthetic monitor + RUM (PostHog) |

---

### Journey A2: Anonymous → Login → Authenticated Subscriber

**User Goal:** Sign up and subscribe to access premium content  
**Context:** After watching free video, user decides to join  
**Persona:** Converting prospect (funnel mid)  
**Reversibility:** Reversible by user (can unsubscribe)  
**Auth Requirement:** Public signup → authenticated

#### Stage 1: Discovery
- **Touchpoint:** "Subscribe" CTA after free video or from pricing page
- **Moment of Truth:** Does pricing UI appear? Is value prop clear?

| UX Debt | Current | Target |
|---------|---------|--------|
| Pricing table clarity | Compact | Expanded tiers + comparison |
| Plain English benefits | Feature list | User outcomes ("Unlock 100+ videos") |
| Compare button | Missing | Side-by-side comparison modal |

#### Stage 2: Engagement
- **Touchpoint:** Click plan, presented with checkout
- **Moment of Truth:** Is Stripe checkout loading? Is user confident submitting card?

| UX Debt | Current | Target |
|---------|---------|--------|
| Trust badges visible | Missing | Stripe logo + SSL + "Secure payment" |
| Coupon entry discoverability | Hidden | Above total | 
| Cart summary accuracy | Minimal detail | Show what they're paying for |

#### Stage 3: Action
- **Touchpoint:** Stripe Hosted Checkout
- **Moment of Truth:** Does payment succeed? Is the webhook idempotent?

| Metric | Baseline | Target (Phase C) |
|--------|----------|---|
| Checkout loads | 98% | ≥ 99% |
| Abandonment rate | 25% | ≤ 18% |
| Payment success rate | 97% | ≥ 99% |

> **Webhook Guarantee:** Same payment attempted twice = exactly one subscription. Duplicate webhook never double-charges (idempotency key in database).

#### Stage 4: Confirmation
- **Touchpoint:** Success page + confirmation email + dashboard update
- **Moment of Truth:** Does user understand they're subscribed? Can they access premium content immediately?

| UX Debt | Current | Target |
|---------|---------|--------|
| Success page visibility | Quick redirect | Persistent summary (5s min) |
| Email delivery time | <5min | <1min |
| Premium access latency | 2-5s | <500ms |

#### Instrumentation
```
Required Events:
- pricing_page_viewed { context, impression }
- checkout_started { plan, price, currency }
- stripe_webhook_received{ eventType, idempotencyKey }
- subscription_created { plan, billingCycle, price }
- post_purchase_email_sent { delay }
- premium_access_granted { latency, method }

Funnel:
pricing_viewed → checkout_started → subscription_created → post_purchase_email_sent → premium_access_granted
Target (Phase C): 82% → 75% → 74% → 70% (conversion funnel)
```

#### Scorecard
| Criterion | Target |
|-----------|--------|
| **a11y: Form labels** | Every input has `<label htmlFor>` (WCAG 1.3.1) |
| **a11y: Error messages** | aria-describedby linked, clear text (not color alone) |
| **Performance: Checkout load** | Stripe iframe loads in < 2s |
| **Performance: Email delivery** | **Email arrives < 1 min** (post-payment guarantee) |
| **Mobile: Form inputs** | Keyboard type matches (tel for phone, email for email) |
| **Trust: Stripe logo** | Visible + linked to Stripe security page |
| **Trust: Privacy link** | Present and not hidden |
| **Idempotency: Double-pay prevention** | Manual webhook retry does not double-charge (test with Stripe CLI) |
| **Conversion: Premium latency** | Dashboard reflects subscription within 500ms |

---

### Journey A3: Subscriber Dashboard → View All Videos + Management

**User Goal:** Browse library, manage subscription, update profile  
**Context:** After subscribing, user logs in to access content hub  
**Persona:** Active subscriber (retention focus)  
**Reversibility:** Reversible (can unsubscribe, update profile)  
**Auth Requirement:** Authenticated + subscriber role-gated

#### Stage 1: Discovery
- **Touchpoint:** Dashboard landing (grid of recent/recommended videos)
- **Moment of Truth:** Is library loaded? Is search/filter visible?

| UX Debt | Current | Target |
|---------|---------|--------|
| Content grid load time | 3.2s | ≤ 2.0s (skeleton preload recommended) |
| Search discoverability | In footer | Top navigation |
| Filter options (creator, duration, category) | Missing | Sidebar with live preview |
| Sorting (newest, trending, watched) | Hardcoded | Dropdown + remember preference |

#### Stage 2: Engagement
- **Touchpoint:** Click video, or use search/filter
- **Moment of Truth:** Does correct video load? Are filters working?

| UX Debt | Current | Target |
|---------|---------|--------|
| Search latency | 1.5s | <500ms (debounced) |
| Filter responsiveness | Slow re-render | Instant (local state + pagination) |
| Watched indicator | Missing | Badge + continue-watching position |

#### Stage 3: Action
- **Touchpoint:** Watch, add to watchlist, share
- **Moment of Truth:** All interactions work without errors?

| Metric | Baseline | Target (Phase C) |
|--------|----------|---|
| Dashboard session time | 4.2 min | ≥ 5.5 min (engagement target) |
| Videos played per session | 1.8 | ≥ 2.5 |
| Watchlist adds per session | 0.3 | ≥ 0.8 |

#### Stage 4: Confirmation
- **Touchpoint:** Subscription management (update payment, view invoice, cancel)
- **Moment of Truth:** Billing page is clear and not scary?

| UX Debt | Current | Target |
|---------|---------|--------|
| Billing clarity | Generic Stripe portal | Custom SelfPrime billing UI with next charge date |
| Cancel confirmation | One-click | Modal with retention offer + reason collection |
| Invoice history | Plain table | Sortable, filterable, PDF download |

#### Instrumentation
```
Required Events:
- dashboard_loaded { subscriber } — track daily active subscribers
- video_added_to_watchlist { videoId, position }
- dashboard_search_queried { query, resultCount, latency }
- filter_applied { filterType, value, resultCount }
- billing_page_viewed { context }
- cancel_initiated { fromPage, reason }
- profile_updated { fields }

Funnel:
dashboard_loaded → video_played → add_watchlist → return (next session)
Target: Track cohort retention (30-day active %)
```

#### Scorecard
| Criterion | Target |
|-----------|--------|
| **a11y: Heading hierarchy** | h1 for page title, h2 for sections (WCAG 1.3.1) |
| **a11y: Skip to content** | Present + keyboard-testable |
| **Performance: Dashboard LCP** | ≤ 2.0s with skeleton preload |
| **Performance: Search latency** | < 500ms after keystroke |
| **Performance: Filter responsiveness** | Instant (no loading state needed for < 100ms) |
| **Mobile: Video grid** | Responsive (1 → 2 → 3 columns at 375px → 768px → 1440px) |
| **Mobile: Touch list hits** | All items > 44px tall |
| **Retention: 30-day active** | Baseline 45-50% → Target 60%+ (tracked via PostHog) |
| **Conversion: Cancel avoidance** | Retention offer on cancel form reduces churn 5%+ |

---

## Part 3: Admin Studio Journeys

> **Note**: Admin Studio uses environment isolation (W360-006) + requireConfirmation tiers. Journeys focus on operator confidence and accident prevention.

### Journey B1: Operator → Smart Smoke Test Runner → Evidence Capture

**User Goal:** Run smoke tests on any environment and verify the entire app is healthy  
**Context:** Pre-deploy verification, post-deploy validation, or incident investigation  
**Persona:** Operator / DevOps engineer  
**Reversibility:** Read-only (no state change)  
**Auth Requirement:** Authenticated + `admin` role  
**Risk Tier:** Tier 1 (reversible) — requires click-to-confirm only

#### Stage 1: Discovery
- **Touchpoint:** "Smoke Tests" tab in Studio, environment selector (gray/amber/red banner)
- **Moment of Truth:** Is environment clearly visible? Can operator select without mistakes?

| UX Debt | Current | Target |
|---------|---------|--------|
| Environment banner prominence | Top-left, small | Full banner top (15% height), color-saturated |
| Current environment clarity | "local" text | "local — SAFE TESTS" (gray badge) |
| Wrong-env warning | Missing | Red warning if staging/prod: "You are about to test PRODUCTION" |
| Test list loading | No skeleton | Skeleton loader for smoother UX |

#### Stage 2: Engagement
- **Touchpoint:** Pick test suite (health, auth, payments, video)
- **Moment of Truth:** Do test names explain what they check?

| UX Debt | Current | Target |
|---------|---------|--------|
| Test descriptions | Names only (e.g., "auth-01") | Plain English ("Login with valid creds works") |
| Expected duration | Missing | Estimated time (e.g., "~45s") |
| Last run status | Not shown | Green/red badge with timestamp |
| Confidence level | N/A | "High risk" label on money-moving tests |

#### Stage 3: Action
- **Touchpoint:** Click "Run Tests", see SSE stream of output
- **Moment of Truth:** Does output stream live? Are failures readable?

| UX Debt | Current | Target |
|---------|---------|--------|
| Output readability | Raw text, no filtering | Color-coded: ✓ pass, ✗ fail, ⚠ warning |
| Failure explanation | Technical trace | Summary line + link to runbook |
| Re-run button | Must restart | "Re-run" button in output footer |
| Time tracking | None | Elapsed time + ETA |

#### Stage 4: Confirmation
- **Touchpoint:** Test run summary (pass/fail counts, export button)
- **Moment of Truth:** Can operator immediately see if they should deploy?

| UX Debt | Current | Target |
|---------|---------|--------|
| Summary clarity | Dense table | Large green checkmark + "70 of 72 tests passed" |
| Export/archive | Manual copy | One-click PDF + Slack integration (async) |
| Audit logged | Not visible | "Run #4829 logged to audit trail" + timestamp |

#### Instrumentation
```
Required Events:
- smoke_suite_started { suiteId, env, operator }
- smoke_test_passed { testId, duration }
- smoke_test_failed { testId, errorClass, assertion }
- smoke_suite_completed { totalTests, passed, failed, duration, env }
- smoke_export_clicked { format } — if operator exports results

PostHog Dashboard:
- Funnel: suite_started → tests completed → export (optional)
- Alert: If failures > 5% on production, Sentry alert + Slack notification (automatic)
```

#### Scorecard
| Criterion | Target |
|-----------|--------|
| **a11y: Status indicators** | Not by color alone; include icons + text (WCAG 1.4.1) |
| **a11y: Output readability** | Monospace font, aria-live for streaming output |
| **Performance: Suite loads** | < 2s first test starts |
| **Performance: Output stream** | < 100ms latency per log line |
| **Mobile: Test list** | Scrollable, clickable targets > 44px |
| **Safety: Wrong-env warning** | Prevents > 1 production smoke-test mistake per 100 runs (target: 0.5% admin error rate) |
| **Verification: Audit logged** | Every run recorded in studio_audit_log + visible in audit viewer (W360-006) |

---

### Journey B2: Operator → Deploy Control → Staging → Production Promotion

**User Goal:** Deploy new code to staging for verification, then promote to production with guardrails  
**Context:** After CI passes and prerelease testing approved  
**Persona:** DevOps / Release engineer  
**Reversibility:** Reversible (staging redeploy), manual-rollback (production has wrangler rollback)  
**Auth Requirement:** Authenticated, `admin` (staging) or `owner` (production) role  
**Confirmation Tier:** Tier 1 (staging: click), Tier 2 (production: type-to-confirm)

#### Stage 1: Discovery
- **Touchpoint:** Deploy tab, version selector, target environment
- **Moment of Truth:** Is current deployed version clear? Is target unambiguous?

| UX Debt | Current | Target |
|---------|---------|--------|
| Current version visibility | Version hash only | "v0.2.1-abc1234 deployed 2h ago" |
| Target selection clarity | Dropdown only | Show diff count (e.g., "3 commits since current") |
| Environment warning | Minimal | Upgrade warning: "Deploying to PRODUCTION — only owners can do this" |
| Pre-deploy checks | Not shown | CI status, smoke test results, deploy prerequisites |

#### Stage 2: Engagement
- **Touchpoint:** Click target version or branch, see diff preview
- **Moment of Truth:** Can operator understand what's changing?

| UX Debt | Current | Target |
|---------|---------|--------|
| Diff size limit | Shows all files | Group by impact (high-risk files highlighted) |
| File filtering | Not available | Filter by path (e.g., hide node_modules) |
| Risk assessment | None | Red flags: payment code, DB migration, config changes |

#### Stage 3: Action
- **Touchpoint:** Staging deploy (1-click), production deploy (type-to-confirm)
- **Moment of Truth:** Does deploy start? Is rollback plan visible?

| UX Debt | Current | Target |
|---------|---------|--------|
| Deploy confirmation | Generic modal | Staging: "Ready to deploy to staging?" ✓ Production: "Type 'prod' to confirm" |
| Rollback plan | Missing | "Current version: v0.2.0—can rollback with one click" |
| Estimated duration | Not shown | "Deployment takes ~2-3 minutes" |
| Live log access | Hidden | "View deployment logs" button with live SSE stream |

#### Stage 4: Confirmation
- **Touchpoint:** Deployment complete, health checks pass, production option unlocked (staging)
- **Moment of Truth:** Can operator promote with confidence?

| UX Debt | Current | Target |
|---------|---------|--------|
| Success feedback | Version number updated | "✓ Deployed v0.2.1 to staging (2:34 PM) — staging.thefactory.dev returning 200" |
| Staging smoke status | Manual check | Auto-run staging smoke → show results inline |
| Production readiness | Unclear | "Staging passed smoke tests. Ready to deploy to production?" |

#### Instrumentation
```
Required Events:
- deploy_started { targetEnv, version, operator }
- deploy_completed { targetEnv, version, duration, success }
- deploy_rolled_back { fromVersion, toVersion, operator, reason }
- post_deploy_smoke_triggered { env, version }
- post_deploy_smoke_completed { env, passed, failed }

Guardrails:
- Alert (Sentry + Slack): If production deploy fails → immediate escalation
- Metric: Deploy frequency (target: ≥ 1/week) and MTTR (target: < 30 min)
- Audit: Every deploy recorded with operator, timestamp, version, outcome
```

#### Scorecard
| Criterion | Target |
|-----------|--------|
| **Safety: Env confirmation** | Type-to-confirm works (autocapture typos, case-insensitive) |
| **Safety: Rollback safety** | One-click rollback always works; rehearsed monthly |
| **Performance: Diff load** | < 1s for typical deploy (< 50 files) |
| **Performance: Deploy time tracking** | Live feedback; no "is it still going?" confusion |
| **Mobile: Deploy form** | Readable on 375px; no horizontal scroll |
| **a11y: Confirm modal** | Input field has aria-label; error messages linked via aria-describedby |
| **Audit: Every deploy logged** | Visible in audit viewer within 5s of completion |

---

## Part 4: Xico Marketplace Journeys

> **Note**: Xico is a 2-sided marketplace. Each user type has critical journeys. All money-moving interactions use requireConfirmation (W360-006).

### Journey C1: Anonymous Traveler → Search/Map Discovery → Booking Checkout

**User Goal:** Find, evaluate, and book an experience (marketplace core loop)  
**Context:** Discovery from landing page, SEO, or referral link  
**Persona:** Leisure traveler, first-time visitor  
**Reversibility:** Reversible (can cancel before charge)  
**Auth Requirement:** Public search → authenticated for booking  
**Confirmation Tier:** Tier 2 (booking checkout: type-to-confirm for payment)

#### Stage 1: Discovery
- **Touchpoint:** Landing page with map, category filters, neighborhood exploration
- **Moment of Truth:** Can user find relevant listings in 30s?

| UX Debt | Current | Target |
|---------|---------|--------|
| Map loading | 4s (Mapbox) | ≤ 2.0s (vector tile optimization) |
| Initial listings shown | 12 (grid only) | 12 grid + map pins visible |
| Category visibility | Tabs only | Persistent sidebar + "Trending Now" |
| Search autocomplete | Not present | Live suggestions (location + category) |

#### Stage 2: Engagement
- **Touchpoint:** Click listing card → detail page or modal; review availability calendar
- **Moment of Truth:** Is listing compelling? Can user understand what they get?

| UX Debt | Current | Target |
|---------|---------|--------|
| Image carousel UX | 6 images, slow swipe | Lazy-load thumbnails, smooth swipe |
| Host info prominence | Hidden below fold | Card with verified badge + review count above images |
| Calendar availability | Text only | Visual (green = available, red = booked) |
| Description clarity | Long form | Short + "What's included" bullet list |
| Reviews anchor | Not working | Scroll-to + count visible in hero |

#### Stage 3: Action
- **Touchpoint:** Click "Book Now" → select date → checkout flow
- **Moment of Truth:** Checkout doesn't abandon users; payment succeeds?

| UX Debt | Current | Target |
|---------|---------|--------|
| Date selector UX | Calendar, slow | Fast inline picker (mobile: native date picker) |
| Price breakdown | Inline only | Fixed header with total visible always |
| Discount code entry | Missing | Before payment (promote Explorer/Local tier) |
| Checkout iframe latency | 3s | Preload on "Book Now" click (< 500ms display) |
| Payment failure recovery | Generic error | "Card declined—try another method" + link to help docs |

#### Stage 4: Confirmation
- **Touchpoint:** Post-checkout confirmation page → email → traveler dashboard
- **Moment of Truth:** Does traveler know they're booked? Can they access booking details?

| UX Debt | Current | Target |
|---------|---------|--------|
| Booking number display | Tiny text | Large, copy-to-clipboard |
| Email delivery | 5-10 min | < 1 min |
| Add-to-calendar button | Missing | iCal download + Google Calendar link |
| Host message channel | Not obvious | In confirmation page: "Message host" button |
| Cancellation policy clarity | Terms link only | Summary (e.g., "Free cancel 48h before") in confirmation |

#### Instrumentation
```
Required Events:
- search_executed { query, filters, resultCount, latency }
- listing_viewed { listingId, source } — track engagement
- booking_started { listingId, dates, travelerType }
- checkout_loaded { delayMs } — measure Stripe iframe performance
- booking_confirmed { bookingId, amountUsd, host, traveler }
- booking_confirmation_email_sent { delayMs }
- add_to_calendar_clicked { method }
- host_message_clicked { bookingId }
- cancellation_requested { reason, refundAmount }

Funnel:
search → listing_viewed → booking_started → checkout_loaded → booking_confirmed → confirmation_email_sent
Target (Phase C): Convert 8% of search visitors to bookings (currently 3%)
```

#### Scorecard
| Criterion | Target |
|-----------|--------|
| **a11y: Map** | Keyboard-navigable; aria-label for map regions + POIs |
| **a11y: Calendar** | WCAG-compliant date picker (not browser-dependent) |
| **a11y: Images** | Alt text on all listing images (not generic "photo 1") |
| **Performance: Map frame** | Paint ≤ 2.0s; map interactive ≤ 2.5s |
| **Performance: Search results** | Delivered in < 500ms (memoized + server-side filtering) |
| **Performance: Detail modal** | Opens < 300ms (preload on hover) |
| **Performance: Checkout frame** | Preloaded, displays < 500ms |
| **Mobile: Map zoom** | Pinch-to-zoom works smoothly; no lag |
| **Mobile: Date picker** | Native picker on iOS/Android (delegated platform) |
| **Mobile: Image carousel** | Smooth swipe; touch targets > 44px (prev/next arrows) |
| **Trust: Host verification** | Badge present if verified (checkmark + verified-by label) |
| **Trust: Reviews visible** | Min 3 total reviews shown; sorting by recency |
| **Conversion: Booking funnel** | Measure A/B (image carousel speed, price summary placement) |

---

### Journey C2: Host → Onboarding → Create Listing → Receive Booking

**User Goal:** Become a host, create experience, and get first booking  
**Context:** Referral or discovery of host program  
**Persona:** Creator/entrepreneur, first-time host  
**Reversibility:** Reversible (can unpublish listing)  
**Auth Requirement:** Authenticated + host role  
**Confirmation Tier:** Tier 1 (publish draft: click), Tier 2 (change pricing: type-to-confirm)

#### Stage 1: Discovery
- **Touchpoint:** "Become a Host" landing page + host onboarding wizard
- **Moment of Truth:** Does host understand requirements? Is first step clear?

| UX Debt | Current | Target |
|---------|---------|--------|
| Requirements clarity | Vague description | Checklist (3 steps: identity verify, Stripe connect, insurance) |
| Progress tracking | No indicator | Stepper: "1/3 Identity Verified — Next: Stripe Connect" |
| Estimated time | Not shown | "Stripe setup takes ~5 min" |
| Help availability | FAQ link only | Chatbot + email support button |

#### Stage 2: Engagement
- **Touchpoint:** Stripe Connect OAuth (KYC)
- **Moment of Truth:** Does host successfully connect bank account?

| UX Debt | Current | Target |
|---------|---------|--------|
| OAuth flow clarity | Generic Stripe modal | "We'll verify your ID and bank — takes < 2 min" |
| Failure recovery | Generic error | Specific guidance: "Stripe couldn't verify your ID—try: 1) Update name spelling, 2) Use different card" |
| Status transparency | Not shown | "Stripe processing... (step 2/3)" |

#### Stage 3: Action
- **Touchpoint:** Host creates listing (title, description, images, price, calendar)
- **Moment of Truth:** Can host create without errors? Can they preview?

| UX Debt | Current | Target |
|---------|---------|--------|
| Form validation | Server-side only | Client feedback (e.g., "Title too short" inline) |
| Image upload | One-by-one | Bulk drag-and-drop + mobile camera support |
| Preview accuracy | Separate page | Split-screen: form left, preview right |
| Price optimization | None | Suggestion: "Hosts with pricing $X–$Y get 40% more bookings" |
| Calendar sync | Manual | One-click Google Calendar import |

#### Stage 4: Confirmation
- **Touchpoint:** Listing published → appears in search → first booking arrives
- **Moment of Truth:** Host sees booking notification + can accept?

| UX Debt | Current | Target |
|---------|---------|--------|
| Publish confirmation | Success message | "🎉 Your listing is live! View it: [link] or share: [socials]" |
| Search visibility timeline | Unknown | "Appears in search within 5 minutes" confirmation |
| Booking notification | Email delay | < 1 min email + in-app notification (real-time) |
| Accept/decline clarity | Ambiguous buttons | "Accept + set price" vs "Decline for now" |

#### Instrumentation
```
Required Events:
- host_onboarding_started { hostId }
- stripe_connect_completed { hostId, connectId }
- listing_created { listingId, hostId, price, category }
- listing_published { listingId }
- booking_request_received { hostId, bookingId, travelerReviews }
- booking_accepted_or_declined { bookingId, hostAction }
- first_booking_earned { hostId, amount, date } — milestone tracking

Funnel:
onboarding_started → stripe_connected → listing_created → listing_published → booking_received → booking_accepted
Target(Phase C): 60% of hosts who start onboarding complete it;  completed hosts get first booking within 14 days (70% target)
```

#### Scorecard
| Criterion | Target |
|-----------|--------|
| **a11y: Form labels** | Every input has label; required fields marked |
| **a11y: Error messages** | Linked via aria-describedby; clear language (not "err_422") |
| **a11y: Stepper** | aria-current step and keyboard navigation |
| **Performance: Form load** | < 2s with Stripe iframe preload |
| **Performance: Image upload** | Thumbnail appears < 1s; bulk upload < 5s for 10 images |
| **Performance: Preview render** | < 500ms as host types fields |
| **Mobile: Image upload** | Camera capture button (not file picker only) |
| **Mobile: Calendar** | Touch-friendly date range picker |
| **Safety: Price change** | Confirmation tier 2 (type-to-confirm) prevents mistakes |
| **Trust: Stripe verification** | Badge visible: "Verified host" after Stripe approval |
| **Notification: Real-time** | Booking appears in-app < 2s of traveler booking |

---

## Part 5: Quality Standards (Applies to All Journeys)

Every journey scorecard above includes checks for:

### Cross-Cutting Quality Criteria

| Category | WCAG / Standard | Implementations |
|----------|---|---|
| **Accessibility** | WCAG 2.1 AA | Color contrast 4.5:1, focus indicators (3px min), keyboard navigation all interactive elements, semantic HTML, alt text, aria-labels |
| **Performance** | Google Core Web Vitals + Custom | LCP ≤ 2.0s, CLS ≤ 0.1, INP ≤ 100ms, search/filter < 500ms |
| **Mobile** | Responsive + Touch | 375px+ viewport support, 44px touch targets, native pickers where appropriate, no horizontal scroll |
| **Conversion** | UX best practices | Primary CTA prominent, loading states clear, error messages actionable, success states affirming |
| **Trust** | Brand + Security | HTTPS, Stripe/secure payment badges, host/creator verification visible, privacy/terms accessible |
| **Observability** | PostHog contract + Sentry | Required events present, funnel metrics tracked, error tracking on critical paths |
| **Reversibility** | W360-006 model | Soft deletes where possible, audit logging on all mutations, undo/rollback clear to users |

---

## Part 6: Risk Tiers & Confirmation Model

Every journey maps to W360-006 confirmation tiers:

| Journey | Critical Mutation | Tier | Confirmation |
|---------|---|---|---|
| **A1** (Watch video) | None | - | Public |
| **A2** (Subscribe) | Payment | Tier 2 | Type-to-confirm (prod) |
| **A3** (Dashboard) | Profile updates, cancel | Tier 1 | Click confirmation |
| **B1** (Smoke tests) | None | - | Read-only |
| **B2** (Deploy) | Deploy to prod, rollback | Tier 2 (prod) | Type-to-confirm |
| **C1** (Traveler booking) | Booking payment | Tier 2 | Type-to-confirm |
| **C2** (Host onboarding + listing) | Stripe connect, publish listing, price change | Tier 2 | Type-to-confirm |

---

## Part 7: Success Measures (OWR Integration)

This W360-041 delivers scorecards that:

1. **Unblock W360-042** (UI regression gates) — each scorecard becomes a test suite in Playwright + axe + Lighthouse
2. **Enable W360-043** (SelfPrime hardening) — targets are now explicit; developers know exactly what "premium" means
3. **Enable W360-044** (Admin Studio UX) — operator journeys have defined moments of truth
4. **Feed observability** (W360-021) — journey KPIs feed PostHog dashboards + SLO definitions
5. **Support launch** (W360-027, W360-028) — journey stories become part of marketing narrative

---

## Part 8: Verification Checklist

- [ ] All 7 journeys documented (A1, A2, A3, B1, B2, C1, C2)
- [ ] Each journey has 4-stage flow + UX debt inventory
- [ ] Each journey has current baseline + Phase C target metrics
- [ ] Each journey maps to PostHog event contract
- [ ] Each journey has scorecard with measurable criteria
- [ ] All accessibility criteria cross-reference WCAG standards
- [ ] All performance criteria use concrete ms targets
- [ ] All journeys map to W360-006 confirmation tiers
- [ ] Reversibility model documented for money-moving flows
- [ ] Audit logging specified for all mutations
- [ ] Mobile support explicitly tested (375px, 768px, 1440px)
- [ ] Scores reviewed by Product (metrics) + Design (UX) + QA (test criteria)

---

## Next: W360-042 & W360-043

**W360-042** will wire these scorecards into:
- Playwright journeys (happy path + error cases)
- axe accessibility audits (auto-run on every PR)
- Lighthouse performance budgets
- Screenshot diff detection (visual regressions)
- Mobile device matrix (375px–1440px breakpoints)

**W360-043** will execute hardening against Phase C targets, with PRs specifically linked to journey KPIs.

---

**Document Status**: ✅ COMPLETE (Ready for review and W360-042/043 teams)  
**Last Updated**: 2026-04-29  
**Owning Disciplines**: D02 (Product), D03 (Design), D04 (Frontend), D10 (Observability)  
**Reviewers**: Product Lead, Design Lead, QA Lead
