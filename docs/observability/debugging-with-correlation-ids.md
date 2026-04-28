# Debugging with Correlation IDs

A practical guide for support, ops, and developers to trace issues from user report to root cause.

---

## Quick Start

**Have a correlationId?** Retrieve full trace:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://api.videoing.io/admin/trace/corr_abc123def"
```

**Don't have one?** Ask the user or find it:

1. Browser DevTools → Network tab → Request headers → `x-correlation-id`
2. Email receipt (from confirmation message) → Click "trace this" link
3. Creator dashboard → Recent errors section → correlationId listed
4. Support ticket → Ask: "What time did it fail? (use server logs to find ID)"

---

## Common Scenarios & Solutions

### Scenario 1: "I can't upload videos"

**User reports:** "Upload button doesn't work, just spins forever"

**Steps:**

1. **Ask for network trace:**
   - Open Chrome DevTools → Network tab → Try upload → Take screenshot
   - Check if request to `/api/upload` appears
   - Copy the `x-correlation-id` header value

2. **Retrieve full trace:**
   ```bash
   curl "https://api.videoing.io/admin/trace/corr_12345" \
     -H "Authorization: Bearer $TOKEN" | jq .trace
   ```

3. **Scan trace for patterns:**

   **Pattern: R2 upload timeout**
   ```json
   {
     "message": "R2 PUT failed: timeout",
     "error": "SOCKET_TIMEOUT",
     "duration_ms": 30000
   }
   ```
   **Fix:** Infrastructure issue. Check R2 status → Retry upload after 5 min.

   **Pattern: Missing Stripe Connect**
   ```json
   {
     "source": "sentry",
     "message": "Error: Stripe account not found",
     "context": { "creatorId": "creator_123" }
   }
   ```
   **Fix:** Creator must complete Stripe Connect onboarding first.

   **Pattern: Quota exceeded**
   ```json
   {
     "message": "Rate limit: 10 uploads per hour exceeded",
     "statusCode": 429
   }
   ```
   **Fix:** User tried >10 uploads in 1 hour. Wait and retry.

4. **If still unsure, escalate trace to engineering.**

---

### Scenario 2: "Payout didn't arrive"

**User reports:** "I'm supposed to get paid today but no money"

**Steps:**

1. **Get payout batch correlationId:**
   - Go to admin dashboard → Payouts → Today's batch
   - Copy batch ID (e.g., `batch_abc123`)
   - Find trace: "trace for batch {batch_id}"

2. **Retrieve trace:**
   ```bash
   curl "https://api.videoing.io/admin/trace/corr_payout_batch_abc123" \
     -H "Authorization: Bearer $TOKEN" | jq '.trace[] | select(.source=="dlq")'
   ```

3. **Check for DLQ events (failures):**

   **If DLQ events present:**
   ```json
   {
     "source": "dlq",
     "message": "DLQ event: transfer_failed",
     "context": {
       "eventId": "dlq_xyz",
       "creatorId": "creator_123",
       "error": "Stripe account disabled"
     }
   }
   ```

   **Fix path:**
   1. Check why Stripe account disabled (creator's bank updated? ID verification?)
   2. Ask creator to re-verify via Stripe Connect
   3. Retry DLQ event:
      ```bash
      curl -X POST "https://api.videoing.io/admin/dlq/dlq_xyz/retry" \
        -H "Authorization: Bearer $TOKEN"
      ```
   4. Full payout should complete
   5. Verify: New trace should show `transfer_succeeded`

   **If no DLQ events (transfer succeeded):**
   - Check creator's bank account (money arrival takes 1–3 business days)
   - If >3 days, check Stripe dashboard → Transfers tab → look for the amount
   - If not in Stripe, ask engineering to investigate

---

### Scenario 3: "Login always fails for this user"

**User reports:** "I enter correct password but get 401"

**Steps:**

1. **Get user's recent login correlationId:**
   - Ask user: "What email did you use?"
   - Check server logs for recent failed logins with that email

2. **Retrieve trace:**
   ```bash
   curl "https://api.videoing.io/admin/trace/corr_login_fail_123" \
     -H "Authorization: Bearer $TOKEN" | jq '.trace'
   ```

3. **Look for auth errors:**

   **Pattern: JWT expired**
   ```json
   {
     "source": "worker_log",
     "message": "JWT validation failed",
     "context": { "error": "token_expired" }
   }
   ```
   **Fix:** Clear browser cookies → Try login again (system will issue new token).

   **Pattern: User not found**
   ```json
   {
     "source": "database",
     "message": "SELECT * FROM creators WHERE email = $1",
     "context": { "rows_returned": 0 }
   }
   ```
   **Fix:** User account doesn't exist. Ask if they entered correct email or need to sign up.

   **Pattern: Password hash mismatch**
   ```json
   {
     "source": "worker_log",
     "message": "Password validation failed",
     "context": { "userId": "user_456" }
   }
   ```
   **Fix:** Wrong password. User can reset via "Forgot Password" link.

   **Pattern: Database locked (concurrent requests)**
   ```json
   {
     "source": "database",
     "message": "Slow query: SELECT * FROM creators...",
     "context": { "duration_ms": 5000, "error": "connection_pool_exhausted" }
   }
   ```
   **Fix:** High server load. Retry in 5 minutes. If persistent, page on-call.

---

### Scenario 4: "Earnings numbers don't match"

**User reports:** "I had 5 subscribers but earnings show $0"

**Steps:**

1. **Retrieve all traces for that creator's recent checkouts:**
   ```bash
   # This requires access to trace search by creator
   # (or trace by individual checkout correlationIds)
   curl "https://api.videoing.io/admin/creator/creator_123/traces" \
     -H "Authorization: Bearer $TOKEN" | jq '.traces | length'
   ```

2. **For each checkout trace, check for:**
   - Payment succeeded?
   - Webhook received?
   - Earnings record created?

   **Expected trace for successful checkout:**
   ```json
   [
     { "message": "POST /api/payment/checkout", "severity": "info" },
     { "message": "Stripe session created", "severity": "info" },
     { "message": "POST /webhooks/stripe", "severity": "info" },
     { "message": "invoice.paid webhook received", "severity": "info" },
     { "message": "Earnings record inserted", "severity": "info" },
     { "message": "Recorded 699 cents earnings", "severity": "info" }
   ]
   ```

   **If earnings record missing:**
   - Check for sentry error event (webhook failed)
   - Check DLQ for queued event
   - Manually verify Stripe invoice was actually paid (check Stripe dashboard)

3. **If earnings found but count is wrong:**
   - Double-check math: $9.99 subscription → 70% payout = $6.99
   - Check if multiple refunds happened (reduce earnings)
   - Query database directly:
     ```sql
     SELECT SUM(amount) FROM earnings_table WHERE creator_id = 'creator_123' AND created_at > '2026-04-01';
     ```

---

### Scenario 5: "Site just went down"

**Alert triggered** "API error rate >50%"

**Steps:**

1. **Get correlationId from error path:**
   - Check recent errors in Sentry dashboard
   - Pick 3–5 different recent errors
   - Collect their correlationIds

2. **Retrieve traces:**
   ```bash
   for id in corr_err1 corr_err2 corr_err3; do
     echo "=== $id ==="
     curl "https://api.videoing.io/admin/trace/$id" \
       -H "Authorization: Bearer $TOKEN" | jq '.trace[-1]'
   done
   ```

3. **Check for common root cause:**

   **All errors show same message?**
   ```json
   {
     "source": "database",
     "message": "Error: connection pool exhausted",
     "severity": "error"
   }
   ```
   **Fix:** Database connection leak. Check Neon dashboard for active connections. If >90% of max pool, page DBA.

   **All errors show authentication failure?**
   ```json
   {
     "source": "sentry",
     "message": "Error: JWT secret verification failed"
   }
   ```
   **Fix:** JWT secret rotated or corrupted. Check GitHub Secrets → `JWT_SECRET`. May need emergency rotation.

   **All errors show 503 from Stripe?**
   ```json
   {
     "source": "worker_log",
     "message": "Stripe API error: Service Unavailable"
   }
   ```
   **Fix:** Stripe is down. Check Stripe status page → Wait for recovery. No action needed.

   **Different errors?** Likely scattered issue, not site-wide.

4. **If infrastructure issue:**
   - Page on-call engineer
   - Provide aggregated trace data
   - Ops can then isolate and escalate

---

## Trace Anatomy

Every trace has these sections:

```
┌─ Frontend Event
│  └─ POST /api/... initiated by user action
│
├─ Worker Log
│  └─ Request received, correlationId attached
│  └─ Request validation
│  └─ Business logic
│
├─ Database
│  └─ SELECT queries (if slow > 200ms)
│  └─ INSERT/UPDATE results
│
├─ Stripe API
│  └─ Payment Intent created
│  └─ Error if failed
│
├─ Webhook (if applicable)
│  └─ Incoming webhook received
│  └─ Processing
│  └─ Errors → DLQ
│
├─ Sentry Event (if error)
│  └─ Error captured
│  └─ Stack trace attached
│
└─ DLQ Event (if failure)
   └─ Event type
   └─ Retry count
   └─ Available for retry
```

**To interpret:** Read from top to bottom. If you see "ERROR" at position 3/10, the first 2 steps succeeded, 3rd step failed → something after that is skipped.

---

## Trace Retrieval Performance

- **Typical trace:** 50–200 entries, retrieves in <500ms
- **Complex flow (payout):** 300–500 entries, retrieves in <2s
- **Very complex (multi-webhook retry):** 1000+ entries, retrieves in <5s

If retrieval is slow, check if Sentry/database is under high load.

---

## Common Patterns in Traces

| Pattern | Meaning | Action |
|---------|---------|--------|
| Ends with `worker_log: error captured` | Request failed, logged to Sentry | Check Sentry dashboard for error details |
| Ends with `database: INSERT successful` | Request completed, data saved | Issue resolved, user should see changes |
| Contains `dlq` event | Something failed, queued for retry | Can retry via `/admin/dlq/{id}/retry` |
| Database entry with `duration_ms > 1000` | Slow query, potential bottleneck | Report to DB team if consistent |
| Multiple entries with same webhook `id` | Duplicate webhook (idempotency working) | Normal, no action needed |
| No `webhook received` after `Stripe session created` | Webhook never arrived | Check Stripe webhook logs, may retry |
| `Sentry: Error` immediately after `worker_log: request start` | Early validation failure (auth, params) | User error, check request payload |

---

## Actionable Checklists

### Checklist 1: Diagnose Payment Issue

- [ ] Get correlationId from user/logs
- [ ] Retrieve trace
- [ ] Check for Stripe errors (failed charge?)
- [ ] Check for webhook failures (DLQ events?)
- [ ] Check creator's Stripe Connect status
- [ ] If DLQ event: retry via `/admin/dlq/{id}/retry`
- [ ] Re-retrieve trace to verify fix
- [ ] Confirm user sees expected outcome (earnings, access, etc.)

**Time:** 5–10 min

### Checklist 2: Diagnose Upload Issue

- [ ] Get correlationId from DevTools
- [ ] Retrieve trace
- [ ] Check for R2 timeout (infrastructure?)
- [ ] Check for Stripe Connect requirement (creator setup?)
- [ ] Check for rate limit (quota exceeded?)
- [ ] If infrastructure: wait 5 min and retry
- [ ] If creator setup: direct to onboarding page
- [ ] If quota: inform user of limit, offer retry in 1 hour

**Time:** 5 min

### Checklist 3: Diagnose Auth Issue

- [ ] Get correlationId from login attempt
- [ ] Retrieve trace
- [ ] Check for user not found (signup needed?)
- [ ] Check for password mismatch (password reset?)
- [ ] Check for JWT token issue (clear cookies?)
- [ ] Check for database connection issue (wait 5 min?)
- [ ] Verify user can login after fix

**Time:** 3–5 min

---

## Escalation to Engineering

If trace doesn't reveal obvious cause, provide:

1. **Correlation ID(s)** (3–5 for pattern matching)
2. **Screenshot of trace summary** (entry count, error count, dlq events)
3. **Your hypothesis** ("Looks like database connection pool issue")
4. **Reproducer if available** ("Happens every time I click upload button")

Engineering can then:
- Deep-dive into code
- Check infrastructure metrics
- Review recent deployments
- Query raw logs for more context

---

## Tips for Users Reporting Issues

**As support person, ask user for:**

```
"When your issue happened, what time was it (include timezone)?"

You can then:
1. Query logs for correlationId from that time
2. Even without correlationId, timeframe helps find it
```

**Provide trace link to user (optional):**

```
"I found the issue. Here's a technical trace:
https://api.videoing.io/admin/trace/corr_abc123
(Engineering can use this to investigate further)"
```

---

## See Also

- [Full-Stack Tracing Architecture](./full-stack-tracing.md)
- [SLO & Observability](../runbooks/slo.md)
- [Incident Response](../runbooks/incident-response.md)
