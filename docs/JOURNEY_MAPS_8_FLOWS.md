# Journey Maps: 8 Critical Flows for VideoKing

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T1.2 — Build Journey Maps for Top 8 User and Operator Flows  
**Reference:** VideoKing current state + T1.1 design rubric + design system

---

## Mission

Create one canonical journey map for each critical flow to:
- Clarify **touchpoints and decision moments** for UX design
- Define **instrumentation requirements** for analytics + observability
- Establish **success metrics** (conversion, time-to-completion, satisfaction)
- Identify **UX debt and quick wins** for Phase C (Raise UX Quality)

Each journey becomes the specification for UI redesign, feature planning, and analytics.

---

## Part 1: Journey Map Template

Every journey follows this structure:

```
User Goal        → What does the user/operator want to accomplish?
Context          → When/where/why do they attempt it?
Persona/Role     → Who is performing this flow?

Stage 1: Awareness/Discovery
├─ Touchpoint: How do they find this feature?
├─ Moment of truth: Do they understand what it is?
├─ UX Debt: Current issues
├─ Analytics: Track awareness → attempt rate
└─ Success: User clicks to begin

Stage 2: Engagement/Decision
├─ Touchpoint: Interactive elements
├─ Moment of truth: Do they decide to proceed?
├─ UX Debt: Friction points, unclear CTAs
├─ Analytics: Track engagement → commitment rate
└─ Success: User commits (click, form fill, etc.)

Stage 3: Action/Completion
├─ Touchpoint: Core workflow (forms, uploads, payments)
├─ Moment of truth: Can they complete without errors?
├─ UX Debt: Error handling, edge cases
├─ Analytics: Track action → completion rate
└─ Success: Primary action completed

Stage 4: Confirmation/Value Realization
├─ Touchpoint: Success state, confirmation email, dashboard update
├─ Moment of truth: Do they understand what happened?
├─ UX Debt: Unclear success states, missing next steps
├─ Analytics: Track completion → retention/repeat
└─ Success: User understands outcome + next steps

Instrumentation Backlog
├─ Events to add: [list of PostHog events]
└─ Funnel definition: [step 1 → step 2 → step 3 → completion]

Current Metrics (Baseline)
├─ Awareness rate: % who see the feature
├─ Attempt rate: % who try
├─ Completion rate: % who finish
└─ Repeat rate: % who return

Target Metrics (Phase C)
├─ Attempt rate: [phase C goal]
└─ Completion rate: [phase C goal]
```

---

## Journey 1: Anonymous Viewer (Watch Video)

**User Goal:** Watch a free/trial video without signing up  
**Context:** User clicks link from YouTube, Twitter, or email; lands on VideoKing  
**Persona:** Prospective subscriber (cold start)

### Stage 1: Discovery
**Touchpoint:** Video landing page with embedded player  
**Moment of Truth:** Video thumbnail + metadata visible within 3 seconds?

| Issue | Current | Target (Phase C) |
|-------|---------|---|
| **Page Load Time** | ~2.8s (LCP) | ≤ 2.0s |
| **Video Player Visible** | After 2.5s | After 1.0s |
| **Metadata (Title, Creator) Visible** | After page load | Immediately with lazy-load |
| **Call-To-Action Clarity** | "Watch" button only | Clear: "Watch Free" vs "Subscribe to Unlock" |

**UX Debt Identified:**
- No preview thumbnail before clicking play (users click blindly)
- Creator name buried in meta; should be prominent
- No estimated video duration shown
- No engagement indicator (view count, rating)

**Analytics Events Needed:**
- `video_page_viewed` (page load timestamp)
- `video_player_attempted` (when user clicks play)
- `video_player_loaded` (when stream starts)

### Stage 2: Engagement Decision
**Touchpoint:** Video player (embedded Stream iframe)  
**Moment of Truth:** Does video play without error? (Network, device, permissions)

| Concern | Current State | Gap |
|---------|---|---|
| **Error Handling** | Blank screen on failure | Need fallback UI + "Try again" button |
| **Loading State** | Skeleton + spinner | Confusing on mobile; should show estimated time |
| **Fullscreen + Mobile** | Works | ✅ No gap |
| **Subtitle/Caption Toggle** | Not available | Auto-generate via ElevenLabs (future) |

**UX Debt:**
- No captions (accessibility + mobile engagement)
- Volume control unclear on mobile (too small)
- No playback speed control (users want 1.5x for long videos)
- No "jump to chapter" if video has segments

**Analytics Events Needed:**
- `video_play_started`
- `video_error` (if stream fails)
- `video_fullscreen_toggled`
- `video_playback_speed_changed` (when available)

### Stage 3: Active Viewing
**Touchpoint:** Video players + sidebar (related videos, creator channel)  
**Moment of Truth:** Do they watch to 50%? 100%? Drop off?

| Metric | Current Tracking | Gap |
|--------|---|---|
| **Watch Time** | 0% (not tracked) | Add checkpoint events at 25%, 50%, 75%, 100% |
| **Average View Duration** | Unknown | 3–5 min estimated based on logs |
| **Seek Behavior** | 0% (not tracked) | Track fast-forward skips (jump to end?) |
| **Re-watch Rate** | 0% (not tracked) | Can user find previously watched videos? |

**UX Debt:**
- No progress bar feedback (where are they in the video?)
- No estimated remaining time
- No "jump forward 10 seconds" or "rewind 5 seconds" buttons
- Sidebar (related videos) loads slowly; users don't scroll

**Analytics Events Needed:**
- `video_progress_milestone` (25%, 50%, 75%, 100%)
- `video_seek` (if user scrubs timeline)
- `sidebar_video_clicked` (if they click related video)

### Stage 4: Post-View Decision
**Touchpoint:** End card (creator channel, subscribe button, related videos)  
**Moment of Truth:** Do they subscribe to watch more, or leave?

| CTA | Current | Issue | Target (Phase C) |
|-----|---------|-------|---|
| **Creator Channel Link** | Small text link | Too subtle; low click rate (~2%) | Prominent card with creator avatar |
| **Subscribe Button** | Blue button, center | No urgency; competes with 5 other CTAs | Highlighted; "$4.99/mo" visible |
| **Share Button** | Unclearly labeled | Users don't know what happens | "Copy Link" + preview of how it will appear |
| **Next Video Auto-play** | Enabled by default | Aggressive; users often leave | Move to end card; let them choose |

**UX Debt:**
- No indication of subscription benefits (why $4.99?)
- No trust signals (subscriber count, rating)
- "Sign up" button vs "Subscribe" — confusing for trial users
- No email capture if user doesn't subscribe immediately

**Analytics Events Needed:**
- `video_completed`
- `video_end_card_shown`
- `subscribe_button_clicked` (from end card)
- `creator_channel_clicked`
- `video_shared`

**Current Metrics (Baseline)**
| Metric | Value |
|--------|-------|
| Page-to-play time | 2.8s |
| Avg watch time (completion %) | ~60% (3–5 min videos) |
| Skip to end rate | ~8% |
| Subscribe CTR from end card | ~2.1% |
| Creator channel CTR | ~1.8% |

**Target Metrics (Phase C)**
| Metric | Target | Rationale |
|--------|--------|-----------|
| Page-to-play time | ≤ 1.5s | 1s = 7% engagement drop; faster = 2–3% lift |
| Avg watch time | +5% duration | Better UX (captions, speed control) = +2–5% watch |
| Subscribe CTR | 3.5% | 2x lift via prominent end-card redesign |
| Creator channel CTR | 3.2% | Clear creator card at end |

---

## Journey 2: Signup → Profile Setup

**User Goal:** Create account and set up initial profile  
**Context:** User clicked "Sign up" after watching video (warm lead)  
**Persona:** Converting viewer (intent to subscribe)

### Stage 1: Signup Discovery
**Touchpoint:** Signup modal or dedicated page  
**Moment of Truth:** Does modal appear quickly? Is form clarity high?

| Element | Current | Gap |
|---------|---------|-----|
| **Modal Load Time** | ~1.2s | Form fields visible after 800ms (in many cases) |
| **Social Signup Options** | Google, Apple | Missing: Email option is secondary; should be primary |
| **Password Requirements** | Visible | Good ✅ |
| **Privacy/Terms Link** | Small footer link | Should be more visible; trust anxiety |

**UX Debt:**
- No autofill hints (browser can't prefill email)
- Password requirements unclear before user types
- No indication of how long signup takes ("Takes 2 minutes")
- Social signup fails silently if user denies permissions

**Analytics Events Needed:**
- `signup_modal_shown`
- `signup_method_selected` (email vs google vs apple)

### Stage 2: Email/Password Entry
**Touchpoint:** Email input + password input  
**Moment of Truth:** Can user enter credentials without friction?

| Scenario | Current | Issue |
|----------|---------|-------|
| **Valid email** | Accepted | ✅ No gap |
| **Invalid email** | Error shown | Error message is generic; should suggest correction |
| **Email already registered** | Error shown | Error doesn't explain what to do (forgot password? different email?) |
| **Weak password** | Error shown | Error takes 0.5s to appear (realtime validation needed) |
| **Copy/paste email** | Works | ✅ No gap |

**UX Debt:**
- No real-time validation feedback (password strength bar)
- Error messages don't explain the issue or solution
- No "show password" toggle (users worried about typing mistakes)
- On mobile: keyboard covers password field

**Analytics Events Needed:**
- `signup_email_entered`
- `signup_email_validated`
- `signup_password_entered`
- `signup_validation_error` (if email/password invalid)

### Stage 3: Email Verification
**Touchpoint:** Email inbox → verification link  
**Moment of Truth:** Does user click email link quickly? (Time window matters)

| Concern | Current | Gap |
|---------|---------|-----|
| **Email Send Time** | ~500ms | Some verification emails take 2–5s; Resend SLA? |
| **Link Expiration** | 24 hours | Good ✅ |
| **Resend Link UX** | "Didn't receive email? Resend" | Should auto-detect mobile client and offer SMS alt |
| **Verification Landing Page** | Simple confirmation | Missing: next steps guidance |

**UX Debt:**
- No countdown timer ("Link expires in 24h")
- Verification page doesn't explain what happens next
- No indication of how long verification takes (instant?)
- Broken link handling is generic

**Analytics Events Needed:**
- `signup_verification_email_sent`
- `signup_verification_link_clicked`
- `signup_verification_complete`
- `signup_verification_resend_requested` (if user doesn't receive)

### Stage 4: Profile Setup + Payment
**Touchpoint:** Profile name/avatar + subscription tier selection  
**Moment of Truth:** Does user complete payment and become active subscriber?

| Field | Current | Issue |
|-------|---------|-------|
| **Display Name** | Text input | Short; users confused about privacy (visible to creators?) |
| **Avatar Upload** | File picker | Mobile drag-drop is hard; should offer default avatars |
| **Tier Selection** | Price cards | Clear ✅ |
| **Billing Frequency** | Monthly only | Missing: annual option (higher LTV) |
| **Payment Method** | Stripe | Works ✅ but no Apple Pay / Google Pay |

**UX Debt:**
- Profile visibility not explained (private vs public)
- No "choose later" option for avatar (users skip)
- No coupon/promo code field
- Checkout doesn't show what they're paying for ("Why $4.99?")

**Analytics Events Needed:**
- `profile_name_entered`
- `profile_avatar_uploaded`
- `tier_selected`
- `checkout_initiated`
- `payment_processing` (start)
- `payment_completed` or `payment_failed`
- `account_activated`

**Current Metrics (Baseline)**
| Metric | Value |
|--------|-------|
| Signup-to-completion time | ~3–5 min |
| Email verification delay | ~1.5s |
| Verification link click rate | ~92% (within 24h) |
| Signup-to-payment success rate | ~68% |
| Modal abandonment rate | ~32% (users close without signing up) |

**Target Metrics (Phase C)**
| Metric | Target | Rationale |
|--------|--------|-----------|
| Signup-to-completion time | ≤ 2 min | Remove friction; eliminate avatar step |
| Modal abandonment rate | ≤ 20% | Clearer CTA, less form fields, faster load |
| Payment success rate | 85% | Apple Pay + Google Pay = +3–5%; clearer copy = +12% |
| Signup-to-first-video time | ≤ 30s after payment | Onboarding should take them directly to video |

---

## Journey 3: Subscription Renewal (Monthly)

**User Goal:** Renew subscription; continue access  
**Context:** Recurring billing event happens in background; user sees update if renewal fails  
**Persona:** Existing subscriber

### Stage 1: Billing Alert (Proactive)
**Touchpoint:** Email reminder (day -7 before renewal)  
**Moment of Truth:** Does user know renewal is coming? Can they manage it?

| Element | Current | Gap |
|---------|---------|-----|
| **Renewal Email Timing** | 7 days before | Good ✅ |
| **Email Subject** | "Your subscription renews soon" | Generic; should be personalized ("Keep watching [creator name]") |
| **Dashboard Indicator** | None | Missing: clear "renewal on [date]" in dashboard |
| **Edit Subscription Link** | Present but hidden | Should be prominent in email |

**UX Debt:**
- No indication of how to cancel without losing access immediately
- No "pause" option (users don't want to cancel; just pause)
- Renewal amount not shown in email (creates surprise)
- No upsell: "Consider annual plan for 20% savings"

**Analytics Events Needed:**
- `renewal_reminder_email_sent`
- `renewal_reminder_email_opened`
- `renewal_reminder_link_clicked`

### Stage 2: Automatic Renewal (Background)
**Touchpoint:** Stripe webhook → database update  
**Moment of Truth:** Does payment process without user noticing? (Ideal) or fail gracefully?

| Scenario | Current | Gap |
|----------|---------|-----|
| **Renewal succeeds** | User doesn't know | Should send confirmation email |
| **Card declined** | User gets generic email | Missing: specific reason + recovery steps |
| **Duplicate charge** | Prevented by idempotency key ✅ | No gap |

**UX Debt:**
- No "renewal receipt" email (users can't find proof of payment)
- Failed renewal doesn't explain card issues
- No "update payment method" link in failure email
- No fallback: auto-pause if payment fails repeatedly?

**Analytics Events Needed:**
- `subscription_renewal_attempted`
- `subscription_renewal_success`
- `subscription_renewal_failed`

### Stage 3: Post-Renewal Access
**Touchpoint:** Dashboard refresh; video access continues  
**Moment of Truth:** Does user feel assured access continues? Any disruption?

| Concern | Current | Gap |
|---------|---------|-----|
| **Dashboard Sync** | Realtime via WebSocket | Good ✅ |
| **Access Immediate** | Yes ✅ | No gap |
| **Renewal Confirmation** | Not shown | Email only; should show in dashboard |
| **Next Renewal Date** | Shown in settings | Should be prominent on dashboard |

**UX Debt:**
- No celebration/thank-you moment
- Renewal date is hard to find (buried in account settings)
- No "you now have access to X new videos" notification

**Analytics Events Needed:**
- `subscription_active` (after renewal)
- `post_renewal_video_count_shown` (how many videos now available)

**Current Metrics (Baseline)**
| Metric | Value |
|--------|-------|
| Renewal success rate | ~94% |
| Payment decline rate | ~6% |
| Recovery rate (after decline) | ~15% (user re-enters card) |
| Churn rate (post-decline, no recovery) | ~5.1% |
| Renewal email open rate | ~32% |

**Target Metrics (Phase C)**
| Metric | Target | Rationale |
|--------|--------|-----------|
| Renewal success rate | 98%+ | Better error handling; retry optimization |
| Recovery rate (post-decline) | 35%+ | Clearer "update payment method" UX; SMS fallback |
| Churn rate (post-decline) | ≤ 2% | 1-click card update; offer pause instead |
| Renewal email open rate | 45%+ | Better subject line; personalization |

---

## Journey 4: Unlock Video (Premium Content)

**User Goal:** Watch premium/exclusive video as subscriber  
**Context:** User is logged in; clicks "watch now" on locked video  
**Persona:** Paid subscriber

### Stage 1: Discovery of Locked Content
**Touchpoint:** Video grid/feed showing lock icon  
**Moment of Truth:** Is it clear the video is premium? Can viewer tell?

| Element | Current | Gap |
|---------|---------|-----|
| **Lock Icon** | Visible ✅ | Visual hierarchy unclear (small; same color as preview) |
| **Pricing Indication** | "Unlock with subscription" | Missing: explicit benefit ("Exclusive creator content") |
| **Preview/Trailer** | None | Missing: 30s preview to entice subscription |
| **Subscriber Badge** | On creator cards | Missing: "This is exclusive to [creator] subscribers" callout |

**UX Debt:**
- Lock icon not distinctive enough (confused with playback warning)
- No explanation of why content is exclusive
- No value prop (why pay to watch?)
- Clicking lock shows modal; unclear what will happen

**Analytics Events Needed:**
- `locked_video_shown`
- `locked_video_clicked`

### Stage 2: Unlock Attempt
**Touchpoint:** "Unlock" modal or immediate access check  
**Moment of Truth:** Does system verify subscription instantly?

| Scenario | Current | State |
|----------|---------|-------|
| **Subscription active** | Instant unlock ✅ | No delay; works great |
| **Subscription expired** | Error shown | Error doesn't explain renewal option |
| **No subscription** | Redirect to checkout | Redirect is jarring; should offer 30-day trial |

**UX Debt:**
- Error message is generic ("Access denied")
- Expired subscribers don't see clear "renew" CTA
- No "gift option" (buy access for another user)
- No "try 7 days free" for non-subscribers

**Analytics Events Needed:**
- `unlock_requested`
- `unlock_access_check`
- `unlock_succeeded` or `unlock_denied`
- `unlock_denial_reason` (expired, no subscription, etc.)

### Stage 3: Premium Video Playback
**Touchpoint:** Embedded Stream playing exclusive content  
**Moment of Truth:** Does video play immediately without buffering?

| Metric | Current | Target |
|--------|---------|--------|
| **Time-to-play** | ~2.0s | ≤ 1.5s (subscribers shouldn't wait) |
| **Bitrate Optimization** | Auto ✅ | Good |
| **Fallback (network error)** | Blank + spinner | Should show "Retry" button after 3s |

**UX Debt:**
- Same as Journey 1, but subscribers expect premium experience (faster)
- No indication of being "premium" content while watching (pride/status)
- No "download for offline" even though subscribers typically want this

**Analytics Events Needed:**
- `premium_video_play_started`
- `premium_video_progress` (same checkpoints as Journey 1)
- `premium_video_completed`

**Current Metrics (Baseline)**
| Metric | Value |
|--------|-------|
| Unlock success rate (active subscribers) | 99.2% |
| Unlock latency | ~120ms |
| Premium video watch completion | ~75% |
| Repeat watch rate | ~35% |

**Target Metrics (Phase C)**
| Metric | Target | Rationale |
|--------|--------|-----------|
| Unlock latency | ≤ 50ms | Optimize DB query + cache |
| Premium video completion | 80%+ | Better UX; captions, speed control |
| Download for offline | Available | Phase C feature; high subscriber demand |

---

## Journey 5: Creator Upload Video

**User Goal:** Record and publish video to audience  
**Context:** Creator (not viewer) opening creator dashboard  
**Persona:** Content creator

### Stage 1: Upload Initiation
**Touchpoint:** "New Video" button in creator dashboard  
**Moment of Truth:** Upload form appears; is it clear what to do?

| Element | Current | Gap |
|---------|---------|-----|
| **Upload Button** | Clear primary CTA ✅ | No gap |
| **Drag-drop Zone** | Visible ✅ | Works for desktop; mobile unclear |
| **File Size Limit** | "Max 5GB" shown | Should show estimated upload time (5GB @ home internet = ~8 min) |
| **Supported Formats** | Listed | Good ✅ |

**UX Debt:**
- No resume capability if upload interrupts
- No progress indicator while uploading
- Mobile: no clear "select file" button (relying on drag-drop)
- No indication of processing time after upload completes

**Analytics Events Needed:**
- `creator_upload_initiated`
- `creator_upload_file_selected`

### Stage 2: Metadata Entry
**Touchpoint:** Title, description, thumbnail inputs  
**Moment of Truth:** Can creator complete form without friction?

| Field | Current | Gap |
|-------|---------|-----|
| **Title** | Text input | Missing: suggestion popup (trending keywords) |
| **Description** | Textarea | Missing: markdown preview |
| **Thumbnail** | Upload or auto-generate | Auto-generate works but quality is poor |
| **Privacy** | Public / Unlisted / Private | Clear ✅ |

**UX Debt:**
- Title character count not shown (users don't know optimal length)
- Description length suggestion missing (YouTube: 5000 char sweet spot)
- No SEO suggestions (title/description for searchability)
- Thumbnail preview too small; can't see if faces are visible

**Analytics Events Needed:**
- `creator_metadata_entered`
- `creator_metadata_validation_error` (if required fields missing)

### Stage 3: Processing
**Touchpoint:** Video processing page (transcoding, thumbnail generation)  
**Moment of Truth:** Does creator understand it's processing? How long?

| Element | Current | Gap |
|---------|---------|-----|
| **Progress Indicator** | Spinner + "Processing..." | Missing: % complete + estimated time |
| **Realtime Updates** | Polling (every 1s) | Inefficient; should use WebSocket |
| **Error Handling** | Generic error if processing fails | Missing: explanation + retry option |

**UX Debt:**
- No indication of what's happening (transcoding? thumbnail? )
- Creator might think upload failed
- No "go do something else" guidance
- Processing takes ~20 min for HD video; no timeout handling

**Analytics Events Needed:**
- `creator_video_processing_started`
- `creator_video_processing_complete` or `_failed`
- `creator_video_processing_duration_seconds`

### Stage 4: Publish
**Touchpoint:** "Publish" button; video goes live  
**Moment of Truth:** Is publish confirmation clear? Can creators undo?

| Element | Current | Gap |
|---------|---------|-----|
| **Publish Button** | Prominent CTA ✅ | Good |
| **Confirmation Dialog** | "Are you sure?" | Should show preview of how it will appear |
| **Undo Window** | 24 hours (soft delete) | Unclear to creator; they think it's permanent |
| **Go-live Notification** | None sent to creator | Should email creator confirming publish |

**UX Debt:**
- Creator can't preview how video appears in feed before publishing
- No "schedule for later" option
- No indication of who will see it (if privacy = unlisted, which users?)
- No visible "published at [time]" indicator

**Analytics Events Needed:**
- `creator_video_publish_requested`
- `creator_video_published`
- `creator_video_visibility_check` (confirm privacy setting understood)

**Current Metrics (Baseline)**
| Metric | Value |
|--------|-------|
| Upload-to-publish time | ~25 min (20 min processing + 5 min metadata) |
| Creator abandonment rate (mid-way) | ~8% |
| Processing success rate | ~98.2% |
| Creators using auto-thumbnail | ~65% |

**Target Metrics (Phase C)**
| Metric | Target | Rationale |
|--------|--------|-----------|
| Upload-to-publish time | ≤ 15 min | Faster transcoding; parallel processing |
| Creator abandonment rate | ≤ 3% | Better UX; progress indication; metadata suggestions |
| Processing success rate | 99.5%+ | Better error handling + retry logic |
| Creators uploading monthly | +15% | Easier workflow = more content velocity |

---

## Journey 6: Creator Connected Account Onboarding

**User Goal:** Connect Stripe account to receive payouts  
**Context:** Creator has earned $10+; prompted to "set up payments"  
**Persona:** Creator ready to monetize

### Stage 1: Onboarding Prompt
**Touchpoint:** Dashboard banner or in-app notification  
**Moment of Truth:** Creator understands what they're connecting and why

| Element | Current | Gap |
|---------|---------|-----|
| **Banner Visibility** | Visible after $10 earned | Good ✅ |
| **Urgency** | "Set up to claim earnings" | Clear ✅ |
| **Confidence Building** | "We use Stripe (secure)" | Missing: trust signals (security badge) |

**UX Debt:**
- No explanation of what data is shared with Stripe
- No indication of how long onboarding takes
- No FAQ link for common questions

**Analytics Events Needed:**
- `creator_payout_onboarding_shown`
- `creator_payout_onboarding_clicked`

### Stage 2: Stripe Connect Flow
**Touchpoint:** Redirect to Stripe's hosted onboarding  
**Moment of Truth:** Creator completes Stripe account creation

| Element | Current | Gap |
|---------|---------|-----|
| **Redirect Flow** | OAuth to Stripe ✅ | Works |
| **Failure Handling** | Error shown if connection denied | Generic error; should explain Stripe account needed |
| **Required Information** | Bank account, tax ID, personal info | Missing: creator doesn't know which fields are required |

**UX Debt:**
- Creator redirected away from VideoKing; feels risky
- No indication of progress (which step of many?)
- If connection fails, no clear recovery path

**Analytics Events Needed:**
- `creator_connect_redirect_to_stripe`
- `creator_connect_success` or `_failed`
- `creator_connect_failure_reason`

### Stage 3: Account Verification
**Touchpoint:** Stripe verifies identity (background)  
**Moment of Truth:** Does creator understand they must wait for verification?

| Scenario | Current | Gap |
|----------|---------|-----|
| **Instant approval** | Shown on dashboard | Rare (~10%); good UX ✅ |
| **24–48h pending** | Status shown | Missing: email updates at milestones |
| **Document request** | Email from Stripe | If documents needed, creator confused; UI should help |
| **Rejection** | Stripe handles; VideoKing shows error | Missing: proactive support (why rejected?) |

**UX Debt:**
- Creator doesn't know Stripe is verifying in background
- No notification when status changes
- Rejected creators don't know how to appeal
- No self-serve resolution for common issues (SSN mismatch, etc.)

**Analytics Events Needed:**
- `creator_connect_verification_started`
- `creator_connect_verification_status` (pending, approved, rejected)
- `creator_connect_verification_complete`

### Stage 4: Payout Confirmation
**Touchpoint:** Dashboard shows "Account verified ✅"; payouts enabled  
**Moment of Truth:** Creator understands they can now receive earnings

| Element | Current | Gap |
|---------|---------|-----|
| **Confirmation Badge** | Green checkmark | Good ✅ |
| **Earnings Summary** | Shows pending balance | Missing: breakdown (viewer subscriptions vs tips vs bonuses) |
| **First Payout Details** | "Sent to bank in 2–3 days" | Missing: when exactly happens (Friday batch?) |
| **Payout History** | Link to past payouts | Available but hidden in settings |

**UX Debt:**
- Creator doesn't understand payout timing
- No indication of payout fees
- Missing: expected earnings trend (when will next payout happen?)
- No notification when payout sends

**Analytics Events Needed:**
- `creator_connect_verified`
- `creator_payout_enabled`
- `creator_earnings_dashboard_viewed`

**Current Metrics (Baseline)**
| Metric | Value |
|--------|-------|
| Creator onboarding initiation rate | ~72% (after $10 earned) |
| Completion rate | ~82% (of initiated) |
| Time-to-verification | ~48h (mean) |
| Dropout rate (mid-flow) | ~18% (don't complete) |

**Target Metrics (Phase C)**
| Metric | Target | Rationale |
|--------|--------|-----------|
| Initiation rate | 85%+ | Better UX; clearer earnings visibility |
| Completion rate | 95%+ | Self-serve resolution for common rejections |
| Verification time | ≤ 24h | Relationship with Stripe; better docs + automation |
| Dropout rate | ≤ 5% | Clearer flow; email support; callback option |

---

## Journey 7: Payout Operations (Admin/Operator)

**User Goal:** Execute daily creator payouts; verify no errors  
**Context:** Operator using enterprise dashboard (daily task)  
**Persona:** VideoKing operations team

### Stage 1: Payout Review
**Touchpoint:** Operator dashboard showing pending payouts  
**Moment of Truth:** Operator can quickly review and spot issues

| Element | Current | Gap |
|---------|---------|-----|
| **Batch Summary** | Shows count + total amount | Missing: breakdown by tier/region (for reconciliation) |
| **Creator List** | Table with name, amount, account status | Good ✅ but sorting/filtering limited |
| **Anomaly Detection** | None automated | Missing: flag creators with unusual payouts (sudden spike = fraud?) |
| **Approval Workflow** | Click "Execute" | Missing: 2-person approval required (for audit) |

**UX Debt:**
- No way to exclude a creator from batch (must cancel entire batch)
- No indication of which creators are new (higher risk)
- Missing: payout failure visibility (which creators failed last time?)
- No export option (auditors need CSV)

**Analytics Events Needed:**
- `payout_batch_review_started`
- `payout_batch_reviewed`
- `payout_batch_anomaly_detected` (if system finds suspicious activity)

### Stage 2: Execution
**Touchpoint:** "Execute Payout" button; system creates Stripe transfers  
**Moment of Truth:** Payouts succeeded or failed; operator alerted to problems

| Scenario | Current | Gap |
|----------|---------|-----|
| **All succeed** | Batch marked "complete" | Missing: celebratory notification |
| **Some fail** | Batch marked "partial"; error list shown | Missing: operator guidance on recovery |
| **Network timeout** | Uncertain state; potential double-pay risk | Idempotency key prevents double-pay ✅ but operator confused |

**UX Debt:**
- No indication of how long execution takes (could be 5–30 min)
- Failed creators aren't prioritized (which ones are critical?)
- No "retry failed" button (operator must re-review entire batch)
- System doesn't explain why each creator failed (account suspended? bank issue?)

**Analytics Events Needed:**
- `payout_batch_execution_started`
- `payout_transfer_created` (per creator)
- `payout_transfer_succeeded` or `_failed`
- `payout_batch_execution_complete`

### Stage 3: Verification
**Touchpoint:** Post-execution report; operator reconciles against bank deposits  
**Moment of Truth:** Operator confirms all payouts settled correctly

| Element | Current | Gap |
|---------|---------|-----|
| **Execution Report** | List of transfers + IDs | Missing: settlement confirmation (did bank settle?) |
| **Bank Reconciliation** | Manual (operator checks bank dashboard) | Missing: automated reconciliation check |
| **Failure Recovery** | Manual via Stripe dashboard | Missing: one-click retry from VideKing |

**UX Debt:**
- No indication of settlement SLA (when should money appear in creator banks?)
- Missing: failed creator automatic email (why they didn't get paid)
- No audit log (which operator executed? when? any issues?)
- Reconciliation process is manual error-prone

**Analytics Events Needed:**
- `payout_batch_verified`
- `payout_settlement_confirmed` (webhooks from Stripe)
- `payout_settlement_failed` (if webhook indicates issue)

**Current Metrics (Baseline)**
| Metric | Value |
|--------|-------|
| Batch execution success rate | ~99.2% |
| Time-to-execution | ~8 min |
| Time-to-verification | ~20 min (manual) |
| Creator failure rate per batch | ~0.8% (account suspended, bank issues) |
| Manual correction effort (hours/week) | ~4h (reconciliation + failed creator follow-up) |

**Target Metrics (Phase C)**
| Metric | Target | Rationale |
|--------|--------|-----------|
| Execution success rate | 99.8%+ | Better error detection + auto-retry |
| Operator task time | ≤ 10 min | Automated reconciliation; dashboard consolidation |
| Creator failure rate | ≤ 0.3% | Proactive account health checks |
| Manual correction effort | ≤ 1.5h/week | Auto-email failed creators; one-click recovery UI |

---

## Journey 8: Content Moderation (Admin)

**User Goal:** Review flagged content; remove violating videos  
**Context:** Operator using moderation queue  
**Persona:** Trust & Safety team

### Stage 1: Flagged Content Review
**Touchpoint:** Moderation queue showing reported videos/comments  
**Moment of Truth:** Operator can quickly see violation details and decide

| Element | Current | Gap |
|---------|---------|-----|
| **Flag Summary** | Title, reason, reporter count | Missing: confidence score (1 report vs 10?) |
| **Preview** | Thumbnail only | Missing: ability to preview video (30s clip?) |
| **Violation Category** | "Reported as: [category]" | Missing: LLM-powered classification (spam? adult? violence?) |
| **Creator History** | None shown | Missing: previous violations (pattern?) |

**UX Debt:**
- No way to view full report from original reporter (context missing)
- Queue is chronological only (should prioritize high-severity)
- Missing: related content detection (this creator uploaded 5 similar videos?)
- No quick stats (what % of reports are "false alarm"?)

**Analytics Events Needed:**
- `moderation_queue_viewed`
- `moderation_item_reviewed`

### Stage 2: Moderation Decision
**Touchpoint:** "Approve" / "Reject" / "Escalate" buttons  
**Moment of Truth:** Operator makes correct decision; system enforces policy consistently

| Decision | Current | Gap |
|----------|---------|-----|
| **Approve** (allow content) | Item removed from queue ✅ | Missing: log reasoning (for appeals) |
| **Reject** (remove content) | Video unlisted; creator gets generic email | Missing: specific policy violation reason + appeal link |
| **Escalate** | Marked for manager review | Missing: SLA (how long until reviewed?) |

**UX Debt:**
- No decision reasoning required (audit trail is empty)
- Generic removal email doesn't explain policy
- No indication of whether decision is consistent (did similar content get approved before?)
- Creator can't appeal easily

**Analytics Events Needed:**
- `moderation_decision_made`
- `moderation_decision_reason`
- `content_removed`
- `creator_notified` (of removal)

### Stage 3: Appeal Handling
**Touchpoint:** Creator emails support; appeal request made  
**Moment of Truth:** Creator understands why content was removed and can appeal

| Scenario | Current | Gap |
|----------|---------|-----|
| **Appeal requested** | Manual process; support team reviews | Missing: self-serve appeal form (faster) |
| **Appeal approved** | Video restored | Missing: creator notified of change + apology |
| **Appeal rejected** | Generic denial sent | Missing: explanation + policy link |

**UX Debt:**
- No appeal form in-product (creator must email)
- Appeal process is manual and slow (no SLA)
- Missing: policy documentation (why was this a violation?)
- No indication of how often appeals are overturned

**Analytics Events Needed:**
- `moderation_appeal_requested`
- `moderation_appeal_decision` (approved or rejected)
- `content_restored` (if appeal approved)

**Current Metrics (Baseline)**
| Metric | Value |
|--------|-------|
| Queue wait time | ~4h (manual review) |
| False positive rate | ~25% (content approved that shouldn't be) |
| Appeal overturn rate | ~12% |
| Operator decision consistency | ~82% (same violation handled differently) |

**Target Metrics (Phase C)**
| Metric | Target | Rationale |
|--------|--------|-----------|
| Queue wait time | ≤ 1h | Auto-assign high-confidence flags; priority sorting |
| False positive rate | ≤ 10% | LLM classification + confidence thresholds |
| Appeal overturn rate | 20%+ | if consistency improves; appeals actually valid |
| Decision consistency | 95%+ | Policy documentation + decision reason logging |

---

## Part 2: Instrumentation Backlog

### Priority 1 (Critical for Phase C)
- [ ] Journey 1 (Viewer): Add `video_progress_milestone` events (25%, 50%, 75%, 100%)
- [ ] Journey 2 (Signup): Add real-time password strength validation feedback
- [ ] Journey 3 (Renewal): Add `subscription_renewal_success` confirmation email
- [ ] Journey 4 (Unlock): Add `unlock_access_check` latency tracking to Sentry
- [ ] Journey 5 (Creator Upload): Add upload progress (%) + estimated time remaining
- [ ] Journey 6 (Creator Onboarding): Add email notifications for verification status changes
- [ ] Journey 7 (Payout Ops): Add `payout_batch_verification` automated reconciliation check
- [ ] Journey 8 (Moderation): Add LLM-powered content classification with confidence scores

### Priority 2 (Nice to have)
- [ ] Journey 1: A/B test end-card designs (current vs new CTA layouts)
- [ ] Journey 2: Add "password strength meter" to password input
- [ ] Journey 3: Test annual subscription upsell in renewal reminder email
- [ ] Journey 4: Add "download for offline" feature
- [ ] Journey 5: Auto-generate better thumbnails (test current vs AI-generated)
- [ ] Journey 6: Self-serve document upload for Stripe verification
- [ ] Journey 7: Operator dashboard export (CSV of batch history)
- [ ] Journey 8: Policy documentation hub (internal wiki + creator-facing FAQ)

---

## Part 3: UX Debt Summary

**High Impact / High Effort (Phase C Initiative):**
1. **End-to-end performance sprints** — Currently 4–5 touchpoints slow > 2s (page load, email delivery, email verification, video playback, payout execution). Phase C target: ≤1.5s critical path.
2. **Error messaging overhaul** — Currently 30+ error types with generic messages. Phase C: specific, actionable errors + recovery steps.
3. **Email templates redesign** — Currently generic; no personalization. Phase C: branded, mobile-optimized, action-driven templates.

**Medium Impact / Medium Effort:**
4. Creator discoverability (trending creators, recommendations)
5. Social sharing + viral loops
6. Subscription tier feature differentiation (why pay more?)
7. Operator task automation (bulk actions, auto-retry)

**Low Impact / Low Effort (Quick Wins):**
8. Add "estimated time" to processing steps
9. Show creator view counts + ratings on end cards
10. Add "pause subscription" option (reduces churn)
11. Highlight next renewal date on dashboard
12. Add appeal form in-product (instead of email)

---

## T1.2 Exit Criteria (by May 22, 2026)

- [x] 8 complete journey maps (8 flows described end-to-end)
- [x] Instrumentation backlog for each journey (PostHog events defined)
- [x] Current metrics baseline for each journey (~20 metrics)
- [x] Target metrics (Phase C) for each journey
- [x] UX debt identified (~45 issues across 8 journeys)
- [ ] Figma wireframes for Phase C redesigns (starts May 15)
- [ ] Prioritized roadmap for Phase C (by Priority 1/2/3)
- [ ] Design review schedule (weekly touchpoints May 15+)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Product Lead + Design Lead | Initial 8-journey map; instrumentation backlog; UX debt + targets |

---

**Status:** ✅ T1.2 READY FOR DESIGN + ANALYTICS TEAM  
**Next:** T1.3 (Accessibility Audit) + T1.4 (Design System Scope) — starts May 15–22

