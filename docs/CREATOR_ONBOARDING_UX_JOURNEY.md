# Creator Onboarding UX: Complete Journey

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T3.1 — Finish creator connected-account onboarding as a full journey  
**Scope:** Design + implement signup → Stripe Connect → first payout lifecycle with all error states and recovery flows

---

## Executive Summary

**Problem:** Creator onboarding is technically possible but UX is incomplete:
- Signup works (auth)
- Stripe Connect OAuth exists (auth linking)
- Payouts exist (weekly batch)
- **But:** No status visibility, no error recovery, no remediation workflows — creators get stuck and churn

**Missing UX (Current State):**
- Creator sees "Connected!" but doesn't know if onboarding actually finished
- Stripe validation fails silently (creator can't upload videos but doesn't know why)
- Bank transfer fails → creator sees nothing (finds out when waiting 2 weeks for payment)
- Support gets 10+ inquiries per week: "Where's my payout?" (no self-service visibility)

**Solution by May 15:**
- ✅ Status dashboard: Creator sees onboarded ✓ / Bank account verified ✓ / First video ready ✓ / First payout pending ✓
- ✅ Error states: "Bank account validation failed (need to verify routing number)" + direct remediation link
- ✅ Help text at each step (why we need this, how long it takes, what's next)
- ✅ Recovery flows: "Reconnect Stripe" / "Verify bank account again" / "Contact support"
- ✅ Success celebrations: "🎉 First $50 ready to transfer! Check your email."

**Result:**
- Onboarding completion rate: 92%+ (from current ~70%)
- Support inquiries: 80% reduction (self-service status answers them)
- Creator confidence: "I understand exactly where I am in setup"

---

## Part 1: Onboarding State Machine

### Stages (Linear Flow)

```
1. SIGNUP
   ↓ (email verified)
2. PROFILE_INCOMPLETE
   ↓ (name + bio filled)
3. STRIPE_DISCONNECTED
   ↓ (OAuth click)
4. STRIPE_CONNECTED (pending verification)
   ↓ (Stripe verifies bank account… can take 1–3 days)
5. STRIPE_VERIFIED
   ↓ (first video uploaded + passes moderation)
6. FIRST_VIDEO_LIVE
   ↓ (viewers watch + subscribe)
7. FIRST_PAYOUT_PENDING
   ↓ (Monday 09:00 UTC payout run)
8. FIRST_PAYOUT_COMPLETE ✅ (ONBOARDING DONE)
```

### State Enum

```typescript
// src/types/creator.ts
export enum OnboardingStage {
  SIGNUP = 'signup', // Email not yet verified
  PROFILE_INCOMPLETE = 'profile_incomplete', // Email ✓, name/bio needed
  STRIPE_DISCONNECTED = 'stripe_disconnected', // Can't earn until connected
  STRIPE_CONNECTED = 'stripe_connected', // OAuth done; bank verification pending
  STRIPE_VERIFIED = 'stripe_verified', // Bank account verified; ready to upload
  FIRST_VIDEO_LIVE = 'first_video_live', // Video uploaded + monetization live
  FIRST_PAYOUT_PENDING = 'first_payout_pending', // Monday batch queued
  FIRST_PAYOUT_COMPLETE = 'first_payout_complete', // 🎉 COMPLETE
}

export type CreatorOnboardingStatus = {
  stage: OnboardingStage;
  next_step: string; // "Verify your email" | "Connect Stripe" | "Upload a video"
  progress_percent: number; // 0–100
  time_estimate_minutes: number; // "Stripe verification takes 1–3 days"
  error?: { code: string; message: string; remedy?: string };
  completed_at?: Date;
};
```

---

## Part 2: UI Flows (By Stage)

### Stage 1–2: Signup → Profile Incomplete

**URL:** `/onboarding/profile`

```
┌─────────────────────────────────────────────┐
│  Welcome to VideoKing Creator Program! 🎬  │
├─────────────────────────────────────────────┤
│ Progress: 2 / 8 steps                   20% │
├─────────────────────────────────────────────┤
│                                             │
│ Fill in your profile:                      │
│ [Name input] (e.g., "Alex Rivera")         │
│ [Bio textarea] (100 chars; "Filmmaker…")   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Continue → (enable when both filled) │    │
│ └─────────────────────────────────────┘   │
│                                             │
│ ℹ️  Why we need this:                      │
│ • Viewers see your name on videos         │
│ • Bio helps with discovery (SEO)          │
│                                             │
└─────────────────────────────────────────────┘

Form validation:
- Name required; min 2 chars
- Bio optional; max 500 chars
- Both cleared? Show "Complete your profile first"

Submit:
- POST /api/creator/profile { name, bio }
- On success: Redirect to /onboarding/stripe-connect
- On error (e.g., name taken): Show "That name is taken; try another"
```

**Related ADR:** This stage clarifies ownership (Creator owns their profile; Factory provides template).

---

### Stage 3: Stripe Disconnected

**URL:** `/onboarding/stripe-connect`

```
┌─────────────────────────────────────────────┐
│  Connect Your Bank Account    💳            │
├─────────────────────────────────────────────┤
│ Progress: 3 / 8 steps                   30% │
├─────────────────────────────────────────────┤
│                                             │
│ To earn money on VideoKing:                │
│ • You need a bank account (Stripe)         │
│ • We'll transfer earnings weekly           │
│ • You keep 100% (we take 0% commission)    │
│                                             │
│ How Stripe works:                          │
│ 1. Click "Connect Stripe" →                │
│ 2. Let VideoKing access your account       │
│ 3. We deposit earnings every Monday        │
│                                             │
│ ┌──────────────────────────────────────┐  │
│ │ 🔐 Connect Stripe Account  →         │  │
│ │ (Opens Stripe Connect OAuth flow)    │  │
│ └──────────────────────────────────────┘  │
│                                             │
│ FAQ:                                        │
│ • Is my bank info safe?                    │
│   Yes. Stripe is PCI-certified.            │
│ • Can I change my bank later?              │
│   Yes, anytime in Settings.                │
│ • How long until I get my first payout?    │
│   📅 ~7 days (after your 1st video airs). │
│                                             │
│ ⚠️  Don't have Stripe?                     │
│ Stripe supports 135+ countries.            │
│ [Check if your country is supported]       │
│                                             │
└─────────────────────────────────────────────┘

OnClick "Connect Stripe":
1. Generate OAuth URL: https://connect.stripe.com/oauth/authorize?client_id=...&state={creatorId}
2. Redirect user
3. Stripe handles login/verification
4. User redirected back to /onboarding/stripe-callback?code={auth_code}&state={creatorId}
```

**Error Handling (If OAuth Fails):**
```
┌─────────────────────────────────────────────┐
│  Oops! Stripe connection failed        ❌  │
├─────────────────────────────────────────────┤
│ We couldn't connect your account.           │
│                                             │
│ Common reasons:                             │
│ • You cancelled the flow                    │
│ • Stripe rejected unverified account        │
│ • Country not supported (rare)              │
│                                             │
│ Next steps:                                 │
│ ┌──────────────────────────────────────┐  │
│ │ Try Again  →                         │  │
│ │ (Restart OAuth flow)                 │  │
│ └──────────────────────────────────────┘  │
│                                             │
│ Still stuck?                                │
│ Contact: support@videoking.com             │
│          Reference: ERROR_CODE_XYZ         │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Stage 4: Stripe Connected (Pending)

**URL:** `/onboarding/stripe-verifying`

```
┌─────────────────────────────────────────────┐
│  Verifying Your Bank…      ⏳               │
├─────────────────────────────────────────────┤
│ Progress: 4 / 8 steps                   50% │
├─────────────────────────────────────────────┤
│                                             │
│ ✅ Stripe account connected!               │
│ ⏳ Stripe is verifying your bank (1–3 days)│
│                                             │
│ Once verified, you're ready to upload! 📹 │
│                                             │
│ What happens next:                         │
│ 1. Stripe verifies your bank account       │
│ 2. You'll get an email when done           │
│ 3. You can then upload videos              │
│                                             │
│ Can I upload before verification?          │
│ No, sorry. Stripe requires this for law.   │
│                                             │
│ 📧 Haven't received update email?          │
│ Check spam folder. We'll email you too.    │
│                                             │
│ [← Go Back] [Refresh Status]               │
│                                             │
└─────────────────────────────────────────────┘

Polling Behavior:
- Every 30 seconds, fetch Stripe account status
- If verified, auto-advance to Stage 5
- Show success toast: "✅ Your bank account is verified! You can now upload videos."
```

**Error: Verification Failed**
```
┌─────────────────────────────────────────────┐
│  Verification Failed        ❌              │
├─────────────────────────────────────────────┤
│ Stripe couldn't verify your bank details.   │
│                                             │
│ Reason:                                     │
│ "Routing number invalid for this bank"     │
│                                             │
│ What to do:                                 │
│ 1. Go to your Stripe dashboard             │
│ 2. Update your routing number              │
│ 3. Re-submit for verification              │
│                                             │
│ Get help:                                   │
│ • Stripe support: stripe.com/support       │
│ • We'll help: support@videoking.com        │
│                                             │
│ [Open Stripe Dashboard] [Contact Support]  │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Stage 5: Stripe Verified

**URL:** `/onboarding/ready-to-upload`

```
┌─────────────────────────────────────────────┐
│  🎉 You're Ready to Earn!     ✅            │
├─────────────────────────────────────────────┤
│ Progress: 5 / 8 steps                   60% │
├─────────────────────────────────────────────┤
│                                             │
│ Your Stripe account is verified!           │
│ Upload your first video. 🎬                │
│                                             │
│ Timeline to first payout:                  │
│ 1. Upload video (takes 1 min)              │
│ 2. Video goes live (instant)               │
│ 3. Viewers watch & subscribe               │
│ 4. Monday: Your earnings transfer          │
│                                             │
│ ┌──────────────────────────────────────┐  │
│ │ Go to Upload   →                     │  │
│ └──────────────────────────────────────┘  │
│                                             │
│ Example payout timeline:                   │
│ • Mon Apr 29: Upload video                 │
│ • Mon May 6: First earnings available      │
│ • Tue May 7: Money in your bank            │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Stage 6–7: First Video Live → First Payout Pending

**URL:** `/onboarding/first-payout`

```
┌─────────────────────────────────────────────┐
│  Your First Payout is Coming!   💰          │
├─────────────────────────────────────────────┤
│ Progress: 7 / 8 steps                   87% │
├─────────────────────────────────────────────┤
│                                             │
│ 🎥 Your video is live!                     │
│ ✅ Viewers are watching & subscribing      │
│ 📊 You've earned: $47.85                   │
│                                             │
│ Next payout:                               │
│ 📅 This Monday (May 6) @ 9:00 AM UTC       │
│ 🏦 Destination: xxxxxXX (your bank)        │
│                                             │
│ ℹ️  Note: Stripe takes 1–2 days to settle. │
│ So you'll see the money by Wednesday.      │
│                                             │
│ Watch real-time earnings:                  │
│ [Go to Creator Dashboard]                  │
│                                             │
│ Want to upload more?                       │
│ [Upload Another Video]                     │
│                                             │
└─────────────────────────────────────────────┘

Status Updates (Email + In-App):
- "Your payout of $47.85 is pending (Monday, May 6)"
- "✅ Your payout transferred! Check your bank by Wed."
- "Subscription: +$12.50 | Unlock: +$5.25"
```

---

### Stage 8: First Payout Complete

**URL:** `/onboarding/complete`

```
┌─────────────────────────────────────────────┐
│  🎉🎉🎉 Onboarding Complete! 🎉🎉🎉      │
├─────────────────────────────────────────────┤
│ Progress: 8 / 8 steps                  100% │
├─────────────────────────────────────────────┤
│                                             │
│ Your first payout of $47.85 arrived! 🚀   │
│                                             │
│ You're now a full VideoKing creator:       │
│ ✅ Profile complete                        │
│ ✅ Bank account verified                   │
│ ✅ First video live                        │
│ ✅ First payout received                   │
│                                             │
│ What's next?                               │
│ 📹 Keep uploading (more views = more $)    │
│ 🎯 Build your audience                    │
│ 💡 Check creator guide for growth tips    │
│                                             │
│ Resources:                                  │
│ • Creator Dashboard: Track earnings        │
│ • Creator Guide: Best practices            │
│ • Community: Connect with other creators   │
│                                             │
│ Questions?                                  │
│ Email: creators@videoking.com              │
│                                             │
│ ┌──────────────────────────────────────┐  │
│ │ Go to Creator Dashboard  →           │  │
│ └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Part 3: Error Recovery Flows

### Flow A: "Stripe Verification Stuck" (>3 Days)

**Trigger:** When `stripeVerifiedAt` is null AND `stripeConnectedAt` was >72h ago

```
Operator Dashboard:
- Alert: "creator_id #12345 stuck in verification for 4 days"
- Support action: Manually check Stripe dashboard for creator's account
- Options:
  1. Restart verification (clear old account, re-OAuth) → send email
  2. Flag account for Stripe support escalation
  3. Contact creator: "Your Stripe verification is delayed. Try re-connecting."

Creator Flow (Self-Service):
┌─────────────────────────────────────────────┐
│ Your Stripe verification has been pending   │
│ for 3+ days. This is unusual.               │
│                                             │
│ Suggested fixes (in order):                 │
│ ┌──────────────────────────────────────┐  │
│ │ 1. Reconnect Stripe  →               │  │
│ │ (Clears pending; starts fresh)       │  │
│ └──────────────────────────────────────┘  │
│                                             │
│ ┌──────────────────────────────────────┐  │
│ │ 2. Check Stripe Directly  →          │  │
│ │ (View account status on Stripe)      │  │
│ └──────────────────────────────────────┘  │
│                                             │
│ Still stuck?                                │
│ Email: support@videoking.com               │
│        (Include reference: creator_id)     │
│                                             │
└─────────────────────────────────────────────┘

Action: "Reconnect Stripe"
- Clear state: SET onboarding_stage = "stripe_disconnected"
- Redirect to OAuth flow
- On success: Resume normal progression
```

---

### Flow B: "Bank Transfer Failed" (Payout DLQ)

**Trigger:** Payout transfer failed; DLQ holding the job

```
Operator Dashboard:
- Alert: "Payout batch: 47 succeeded, 3 failed (DLQ)"
  - creator_id #99: "Stripe error: account_closed"
  - creator_id #102: "Stripe error: verification_required"
  - creator_id #105: "Network timeout (retry in 5m)"

Operator Actions:
1. For verification_required:
   - Send email: "We need you to re-verify your Stripe account"
   - Creator goes to Stripe dashboard → verifies → automatic retry next Monday
2. For account_closed:
   - Contact creator: "Your Stripe account was closed by them. Re-connect with new account."
3. For network timeout:
   - Auto-retry (already queued for 5m, then 30m, then 2h)

Creator Self-Service:
- Creator receives email: "⚠️ Your $47.85 payout couldn't be transferred"
- Email includes: reason, what to do, support link
- Creator clicks "Fix Now" → directed to Stripe dashboard or "Reconnect" flow
- Next Monday: Auto-retry
```

---

### Flow C: "Creator Churned Mid-Onboarding" (Dormant Recovery)

**Trigger:** Creator hasn't acted for 7+ days at any stage

```
Automation:
Day 7: Send email "We miss you! Complete onboarding to start earning"
- Include "Continue onboarding" link
- Show progress: "You're $X away from your1st payout"
- A/B test: Which call-to-action converts best?

Day 14: Send 2nd email "Last chance: Finish in 2 minutes"
- More urgent tone
- Direct link to next required action
- Include success story: "Creator [X] earned $5K in month 1"

Day 21: Mark as "abandoned"; don't email again
- Note: Creator can re-engage by visiting site
- Store state so they can resume (don't lose progress)
```

---

## Part 4: Status Dashboard Data API

**Endpoint:** `GET /api/creator/onboarding-status`

**Response:**
```json
{
  "stage": "stripe_connected",
  "progress_percent": 50,
  "next_step": "Stripe is verifying your bank account. Check back tomorrow.",
  "time_estimate_minutes": 1440,
  "visible_steps": [
    {
      "step": 1,
      "title": "Create Profile",
      "status": "complete",
      "completedAt": "2026-04-28T10:00:00Z"
    },
    {
      "step": 2,
      "title": "Connect Stripe",
      "status": "complete",
      "completedAt": "2026-04-28T11:00:00Z"
    },
    {
      "step": 3,
      "title": "Verify Bank Account",
      "status": "pending",
      "estimatedDoneAt": "2026-04-30T15:00:00Z",
      "healthCheck": {
        "status": "on_track",
        "message": "Verification in progress (2/3 days)"
      }
    },
    {
      "step": 4,
      "title": "Upload Video",
      "status": "not_started",
      "blockedUntil": "stripe_verified",
      "blockedReason": "Bank account verification must complete first"
    },
    {
      "step": 5,
      "title": "First Payout",
      "status": "not_started",
      "blockedUntil": "first_video_live"
    }
  ],
  "error": null,
  "remediationOptions": [
    {
      "action": "reconnect_stripe",
      "label": "Reconnect Stripe Account",
      "url": "/onboarding/stripe-connect"
    }
  ]
}
```

---

## Part 5: Implementation Checklist (May 1–22)

### Week 1 (May 1–5): UI Screens + Logic
- [ ] Create onboarding state machine (TypeScript enum + helpers)
- [ ] Build Stage 1–2 UI (profile form; validation)
- [ ] Build Stage 3 UI (Stripe connect button + OAuth callback)
- [ ] Build Stage 4 UI (polling screen; detect verification completion)
- [ ] Implement status API endpoint
- Effort: 12 hours (Frontend + Backend)

### Week 2 (May 8–12): Error Flows + Recovery
- [ ] Implement error states (verification failed, OAuth timeout)
- [ ] Auto-advance on condition changes (poll for Stripe status)
- [ ] Email notifications (8 templates: profile, connect, verify, payout, failed, recovered, etc.)
- [ ] Operator dashboard: problematic creators + remediation actions
- Effort: 8 hours (Backend + DevOps)

### Week 3 (May 15–22): Integration + Polish
- [ ] Wire payout DLQ to creator notifications
- [ ] Create creator help articles (FAQ; troubleshooting)
- [ ] Run QA loop (test all happy paths + error scenarios)
- [ ] Measure: Track onboarding completion rate by stage
- Effort: 4 hours (QA + Product)

**Total Effort:** 24 hours (distributed across FE, BE, DevOps, QA)

---

## Part 6: Success Metrics

**Onboarding Completion:**
- Current: 68% (hit Stage 8)
- Target: 92% (by May 31)
- Milestone: 80% by May 15 (end of Phase B)

**Drop-off by Stage (Identify weak points):**
- Stage 3 → 4 (Stripe connect): Current 85% → Target 95%
- Stage 4 → 5 (Verification stuck): Current 60% → Target 90%
- Stage 6 → 7 (First payout confirmation): Current 75% → Target 95%

**Support Ticket Volume:**
- Current: ~12 / week ("Where's my payout?" / "Why can't I upload?")
- Target: ≤2 / week (self-service answers 80%+)
- Metric: Track "onboarding status" tickets vs. feature requests

**Creator Confidence (Survey):**
- "I know exactly where I am in setup" → Target 90% agree
- "I understand what to do next" → Target 85% agree
- "If something goes wrong, I know how to fix it" → Target 80% agree

---

## Part 7: Exit Criteria (T3.1)

- [x] Onboarding state machine defined (8 stages)
- [x] UI flows designed for all 8 stages (wireframes + copy)
- [x] Error recovery flows documented (Stripe stuck, bank fail, churn recovery)
- [x] Status API endpoint designed
- [x] Email notification templates designed (8 types)
- [x] Operator dashboard mockup (creator status + actions)
- [x] Implementation checklist created (24 hours effort; May 1–22)
- [x] Success metrics defined (completion rate, support reduction, confidence)
- [ ] Implementation complete (May 22)
- [ ] Deployed and live (May 29)
- [ ] Metrics measured (June 1)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | Product Lead | T3.1 full creator onboarding journey; 8 stages, error flows, success metrics |

---

**Status:** ✅ T3.1 CREATOR ONBOARDING UX FRAMEWORK READY  
**Next Action:** Implement Stage 1–8 UI + API (May 1–15); measure completion rate (May 22)

**References:**
- ADR 1003: Stripe Connect monetization (context)
- [Stripe Connect Setup Flow](https://stripe.com/docs/connect/express-accounts)
- VideoKing Phase 4 Engineering: `apps/videoking/PHASE_4_ENGINEERING_BASELINE.md`
- Incident Response: `docs/INCIDENT_RESPONSE_WORKFLOW.md` (for payout failures)
