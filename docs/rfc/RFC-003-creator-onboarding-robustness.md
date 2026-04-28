# RFC-003: Creator Onboarding Robustness

**RFC Number:** RFC-003  
**Title:** Creator Onboarding Robustness & Error Recovery  
**Author:** Videoking Engineering  
**Date Filed:** April 28, 2026  
**Status:** accepted (see T3.1 implementation)  
**Target Ship:** Q2 2026 (June)

---

## 1. Problem Statement

While RFC-002 covered the onboarding UX (3 phases: Quick Start → Try It Out → Get Paid), it did not address production concerns:

1. **Error recovery:** What happens if Stripe Connect OAuth fails mid-flow?
2. **Webhook reliability:** If `account.updated` webhook is lost, how do we catch up?
3. **Rate limiting:** What if many creators connect Stripe simultaneously?
4. **Regional compliance:** GDPR data handling, regional Stripe account restrictions
5. **Operator visibility:** How do operators detect stuck onboarding flows?

This RFC specifies error handling, webhook retry strategies, and operator tooling to make creator onboarding production-grade.

---

## 2. Proposed Solution

### 2.1 Error States & Recovery

#### OAuth Flow Errors

| Error | Root Cause | Recovery |
|-------|-----------|----------|
| Stripe Connect unavailable (5xx) | Stripe API down (rare) | Retry with exponential backoff; show "Try again later" |
| Redirect URL mismatch | Stripe Connect config doesn't match app redirect_uri | Contact support; update Stripe app config |
| Account creation failed | Stripe account couldn't be created (velocity check, etc.) | Retry next day; Stripe may rate limit per email |
| User denies permission | User clicks "Decline" on Stripe OAuth consent | Remind user they must authorize; offer retry |
| State token expired | User took >10 min between start and callback | Regenerate state; start flow over |

**Implementation:**
- Store OAuth state in Redis with 10-min TTL (or Durable Objects on Cloudflare)
- On callback, verify state exists and matches
- Implement `POST /api/creator/onboarding/retry` for manual state recovery
- Log all errors with creator ID + error code + timestamp

#### Account Verification Errors

| Error | Detection | Recovery |
|-------|-----------|----------|
| Incomplete account info | Stripe API: account.charges_enabled = false | Fetch pending requirements; show in settings |
| Tax ID rejected | Stripe API: account.requirements.past_due includes tax docs | Operator reviews; creator resubmits via Stripe |
| Bank account invalid | Stripe API: payouts_enabled = false | Creator updates bank via Stripe dashboard |
| Account restricted | Stripe API: account.restrictions exist | Escalate to Stripe support; creator contacts Stripe |

**Implementation:**
- `PUT /api/creator/onboarding/verify` fetches latest Stripe account and reports status
- If verification fails, suggest specific action (e.g., "Complete tax info in Stripe")
- Track verification attempts; alert operator if >5 consecutive failures

### 2.2 Webhook Reliability

Stripe Connect webhooks (account.updated) may be lost or delayed. Use dual-strategy:

**Strategy 1: Webhooks (fast path)**
- Webhook handler updates creator_connections.onboarding_status immediately
- Useful for real-time feedback in settings page

**Strategy 2: Polling (catch-up path)**
- Operator dashboard: "Verify Stripe Status" button fetches latest from Stripe API
- Creator settings: "Refresh" button polls Stripe for latest account state
- Cron job (daily): For all verified creators, poll Stripe to catch missed account restrictions

**Implementation:**
- Webhook stores event ID to prevent duplicates (idempotency)
- Polling endpoint: `POST /api/admin/creators/:id/verify-stripe` (admin only)
- Creator self-serve: `PUT /api/creator/onboarding/verify` (authenticated)
- Cron: `POST /internal/cron/verify-creator-accounts` (internal only)

### 2.3 Rate Limiting & Load Handling

**Per-creator limits:**
- OAuth flow initiation: 1 per minute (prevent brute force)
- Verification attempts: 5 per hour (prevent stress on Stripe)
- State token generation: 1 per 5 seconds (prevent token spam)

**Per-system limits:**
- Concurrent Stripe API calls: Queue requests; batch in groups of 10
- Webhook processing: Queue (don't block on 3rd-party calls)
- Database writes: Use transactions to prevent race conditions

**Implementation:**
- Use Cloudflare rate limiting: `CF.RATE_LIMIT.limit(key, points, period)`
- Queue async operations in Durable Objects queue
- Add retry-after headers to 429 responses

### 2.4 Regional Compliance

**GDPR (EU creators):**
- Store Stripe account ID (linked to EU customer data)
- Stripe handles PII; we only store Stripe account ID + verification status
- On deletion request: Mark creator_connections as deleted (soft delete)

**Regional Stripe restrictions:**
- Some countries don't support Stripe Connect (e.g., Iran, Syria)
- Before showing "Connect Stripe" button: Check creator's country
- If unsupported: Show "Payment setup not available in your region" + alternatives

**Implementation:**
- Add `country` column to creators table (collected during signup)
- Check `STRIPE_RESTRICTED_COUNTRIES` env var before allowing Connect flow
- Document expected behavior in customer support wiki

### 2.5 Operator Dashboard

**Creator Onboarding Admin Panel:**

```
Filters: Status (pending|submitted|verified|rejected), Last Update (date range)

Table:
- Creator Email, Name
- Stripe Account ID
- Status (with color indicator)
- Last Verified (timestamp)
- Verification Attempts
- Error Message (if any)
- Actions: Verify Now, View Details, Contact Creator

Verification Flow:
1. Operator clicks "Verify Now"
2. System fetches account from Stripe API
3. Status updates in real-time
4. If status changed: audit log entry + notification to creator (optional)

Bulk Operations:
- Select multiple creators
- "Verify All" → batch check via Stripe API
- "Mark Ready for Payout" → bulk include in next batch
```

**Implementation:**
- Admin route: `GET /api/admin/creators/onboarding?status=&page=&sortBy=`
- Verification route: `POST /api/admin/creators/:id/verify-stripe`
- UI: React component in admin-studio-ui

### 2.6 Observability & Alerting

**Metrics:**
- `creator_onboarding_started` — counter
- `creator_onboarding_completed` — counter
- `creator_onboarding_failed` — counter
- `creator_oauth_error_rate` — gauge (% of flows that fail at OAuth step)
- `creator_stripe_account_pending` — gauge (count of "submitted" status)
- `creator_stripe_verification_latency_p99` — histogram (time from submitted to verified)

**Alerts:**
- If `creator_oauth_error_rate` > 10% → Page on-call
- If `creator_stripe_account_pending` > 50 for >24h → Investigate (Stripe issue?)
- If verification latency P99 > 7 days → Stripe may be stricter; investigate

**Implementation:**
- PostHog events: Track all milestone events
- Sentry: Log all errors (OAuth, Stripe API, webhook)
- Custom metrics: Emit to PostHog via analytics.gauge()

---

## 3. Implementation Roadmap

### Phase 1 (Week 1–2): Core Error Handling
- ✅ OAuth state validation
- ✅ Account verification errors + suggestions
- ✅ Retry logic with exponential backoff

### Phase 2 (Week 3): Webhook Reliability
- ✅ Webhook idempotency via event ID
- ✅ Polling endpoints for catch-up
- ✅ Creator self-serve verify button

### Phase 3 (Week 4): Operator Dashboard
- ✅ Admin onboarding list + filters
- ✅ Bulk verify + mark ready for payout
- ✅ Error investigation tools

### Phase 4 (Future): Advanced
- Regional compliance (country check before Connect button)
- Rate limiting via Cloudflare Workers
- Cron-based daily verification
- Support for webhook retries with backoff

---

## 4. Success Criteria

- ✅ Creator OAuth flow succeeds for 95%+ of attempts
- ✅ Account.updated webhook processed within 1 minute of event
- ✅ Operator can recover 10 stuck creators per minute via dashboard
- ✅ Zero GDPR violations (Stripe handles PII; we log minimally)
- ✅ All errors logged with context (creator ID, error code, timestamp)
- ✅ Retry logic prevents email spam and rate limiting
- ✅ Dashboard provides clear guidance on next steps for each error state

---

## 5. Future Enhancements

1. **Webhook retry backoff:** If webhook fails, retry with exponential backoff (1s, 2s, 4s, 8s...)
2. **Operator notifications:** Alert operator if creator account status changes
3. **Creator TFA:** Two-factor authentication for payment account linking
4. **Sandbox testing:** Allow operators to test flows in Stripe sandbox
5. **Multi-currency:** Support creator payouts in their local currency

---

## Appendix: Error Codes

All errors follow `@adrper79-dot/errors` standard:

```typescript
STRIPE_OAUTH_FAILED = 'STRIPE_OAUTH_FAILED' // OAuth exchange failed
STRIPE_ACCOUNT_NOT_CREATED = 'STRIPE_ACCOUNT_NOT_CREATED' // Stripe account creation failed
STRIPE_ACCOUNT_INCOMPLETE = 'STRIPE_ACCOUNT_INCOMPLETE' // Pending requirements exist
STRIPE_ACCOUNT_RESTRICTED = 'STRIPE_ACCOUNT_RESTRICTED' // Account flagged as risky
STATE_TOKEN_EXPIRED = 'STATE_TOKEN_EXPIRED' // OAuth state token invalid
RATE_LIMITED = 'RATE_LIMITED' // Too many requests
```

These map to HTTP status codes + user-friendly messages in the UI.
