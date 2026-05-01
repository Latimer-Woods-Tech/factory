# Operator & Support Runbook

**W360-036 · Owner: D14 (Support/Ops), D07 (Revenue), D11 (AI/Content), D13 (Platform)**  
**Status**: Active · Last updated: 2026-04-29  
**Related**: [docs/runbooks/](.) · [packages/neon/src/entitlements/](../../packages/neon/src/entitlements/)

---

## Overview

This runbook covers the 7 highest-risk failure modes for Factory apps. Each section provides:
- **Trigger criteria** — how to identify the failure
- **Procedure** — step-by-step operator actions
- **Tooling** — endpoints, scripts, or admin routes to use
- **Reversal** — how to undo the action if needed
- **Audit trail** — what to log and where

---

## FM-01 · Failed Video Render

**Trigger**: `video_jobs` row stuck in `pending` / `processing` for > 15 minutes, or `status = 'error'`.

### Procedure

1. Find the job in Admin Studio → **Jobs** panel or via SQL:  
   ```sql
   SELECT id, status, error_message, created_at, updated_at
   FROM video_jobs
   WHERE status IN ('error', 'pending')
   ORDER BY created_at DESC
   LIMIT 20;
   ```
2. Check the `error_message` column. Common causes:
   - `LLM timeout` → re-queue (step 3)
   - `ffmpeg exit 1` → inspect GitHub Actions `render-video.yml` run logs
   - `Stream registration failed` → rotate `CF_STREAM_TOKEN` and re-queue
3. Re-queue the job:
   ```bash
   curl -X PATCH https://schedule-worker.adrper79.workers.dev/jobs/{job_id} \
     -H "Authorization: Bearer $WORKER_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"status":"pending","error_message":null}'
   ```
4. Verify the cron worker picks it up within 5 minutes.
5. If the job errors again, escalate to the video platform team with the GitHub Actions run URL.

### Reversal

Set `status = 'failed'` to prevent further retries:
```bash
curl -X PATCH https://schedule-worker.adrper79.workers.dev/jobs/{job_id} \
  -H "Authorization: Bearer $WORKER_API_TOKEN" \
  -d '{"status":"failed","error_message":"Operator: manual hold"}'
```

### Audit trail

Log the operator action and job ID to `factory_events`:
```json
{ "event": "operator.job.requeued", "properties": { "job_id": "...", "operator": "...", "reason": "..." } }
```

---

## FM-02 · Credit Refund Request

**Trigger**: Practitioner requests a credit refund after a failed render or billing dispute.

### Procedure

1. Verify the credit deduction occurred by checking `credit_ledger`:
   ```sql
   SELECT * FROM credit_ledger
   WHERE customer_id = '{customer_id}'
   ORDER BY created_at DESC
   LIMIT 10;
   ```
2. Confirm the corresponding `video_jobs` row shows `status = 'error'` or `'failed'`.
3. Issue a credit reversal via Admin Studio → **Credits** → **Reverse Debit**, or directly:
   ```sql
   INSERT INTO credit_ledger (customer_id, amount, type, reference_id, notes)
   VALUES ('{customer_id}', {credit_amount}, 'refund', '{job_id}', 'Operator: failed render refund');
   ```
4. Notify the practitioner via email (Resend) with the refund confirmation.

### Boundaries

- Maximum refund without manager approval: 500 credits per incident.
- For currency refunds, use the Stripe dashboard → **Refunds** (partial or full).

### Reversal

Credit refunds cannot be reversed without a compensating debit. Escalate to Finance if in error.

### Audit trail

Record in `factory_events`:
```json
{ "event": "revenue.credit.refunded", "properties": { "customer_id": "...", "amount": ..., "job_id": "...", "operator": "..." } }
```

---

## FM-03 · Failed Booking / Duplicate Checkout

**Trigger**: Booking row stuck in `pending_payment`, guest reports double charge, or Stripe webhook fires twice.

### Procedure

1. Check booking state:
   ```sql
   SELECT id, status, stripe_session_id, created_at
   FROM bookings
   WHERE id = '{booking_id}';
   ```
2. Check `processed_events` for duplicate webhook delivery:
   ```sql
   SELECT * FROM processed_events
   WHERE stripe_event_id = '{evt_xxx}';
   ```
   If two rows exist, a duplicate slipped through — see step 4.
3. For a stuck `pending_payment` booking:
   - Check Stripe dashboard for session status.
   - If Stripe shows `paid`, manually trigger the fulfillment:
     ```bash
     curl -X POST https://admin-studio.adrper79.workers.dev/internal/bookings/{booking_id}/fulfill \
       -H "Authorization: Bearer $ADMIN_JWT"
     ```
4. For a duplicate charge: issue a full Stripe refund for the duplicate payment intent via the Stripe dashboard. Log the refund ID.

### Audit trail

```json
{ "event": "revenue.booking.operator_action", "properties": { "booking_id": "...", "action": "manual_fulfill|refund", "operator": "..." } }
```

---

## FM-04 · Auth / Login Failure

**Trigger**: User cannot log in; `POST /auth/login` returns `401` or `500`; JWT decode errors spike in Sentry.

### Procedure

1. Reproduce with the user's email:  
   ```bash
   curl -X POST https://prime-self.adrper79.workers.dev/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"test"}'
   ```
2. Classify the error:
   - `401 INVALID_CREDENTIALS` → user's password is wrong or account is blocked. Reset password flow.
   - `500 INTERNAL_ERROR` → Neon/Hyperdrive connectivity issue. Check `env.DB` binding health.
   - `401 TOKEN_EXPIRED` → client-side bug (token not refreshed). Advise client-side fix.
3. If `JWT_SECRET` was rotated without a session invalidation pass, all active tokens will fail. Follow the [Secret Rotation runbook](secret-rotation.md).
4. For account lockout by policy, unlock via Admin Studio → **Users** → **Unlock**.

### Audit trail

All auth events are captured in Sentry automatically. For operator unlocks:
```json
{ "event": "auth.account.operator_unlock", "properties": { "user_id": "...", "operator": "..." } }
```

---

## FM-05 · Data Deletion / GDPR Request

**Trigger**: User submits a verified deletion request (email-verified or via support ticket).

### Procedure

1. Verify identity: confirm the user email matches the account. Do not process unverified requests.
2. Export the user's data first (GDPR right to portability):
   ```sql
   SELECT * FROM users WHERE id = '{user_id}';
   SELECT * FROM bookings WHERE user_id = '{user_id}';
   SELECT * FROM factory_events WHERE user_id = '{user_id}';
   SELECT * FROM credit_ledger WHERE customer_id = '{customer_id}';
   ```
3. Send export to the user via email before deletion.
4. Execute deletion in transaction:
   ```sql
   BEGIN;
   UPDATE users SET email = 'deleted_{user_id}@factory.deleted', name = 'Deleted User', deleted_at = NOW() WHERE id = '{user_id}';
   DELETE FROM factory_events WHERE user_id = '{user_id}' AND event NOT LIKE 'revenue.%';
   -- Retain revenue events for 7-year financial compliance
   COMMIT;
   ```
5. Cancel active Stripe subscription if any (Stripe dashboard → Customer → Cancel subscription).
6. Purge R2 video assets: use the R2 dashboard or `wrangler r2 object delete`.

### Audit trail

Retain a deletion record outside the user's data (operator compliance log):
```json
{ "event": "compliance.gdpr.deletion_executed", "properties": { "user_id_hash": "sha256(...)", "operator": "...", "completion_date": "..." } }
```

---

## FM-06 · Content Moderation Action

**Trigger**: Community report, automated flag, or legal takedown request for user-generated content (listings, reviews, videos).

### Procedure

1. Review the reported content in Admin Studio → **Moderation queue**.
2. Classify severity:
   - **Low** (spam, misleading): issue a warning, hide content, notify user.
   - **Medium** (policy violation): suspend content + 7-day account suspension.
   - **High** (illegal content, doxxing, CSAM): immediate account suspension + preserve evidence + escalate to Legal.
3. For a listing takedown:
   ```sql
   UPDATE experiences SET status = 'suspended', moderation_reason = '{reason}', moderated_at = NOW(), moderated_by = '{operator_id}'
   WHERE id = '{listing_id}';
   ```
4. Notify the host:
   - Use Resend to send the moderation decision template email.
   - Include the appeals process URL.
5. For DMCA takedown: acknowledge within 24 hours, forward to Legal within 2 business hours.

### Reversal

To restore suspended content after appeal:
```sql
UPDATE experiences SET status = 'active', moderation_reason = NULL, moderated_at = NULL WHERE id = '{listing_id}';
```

### Audit trail

```json
{ "event": "compliance.moderation.action", "properties": { "content_id": "...", "content_type": "listing|review|video", "action": "warn|suspend|takedown", "severity": "low|medium|high", "operator": "..." } }
```

---

## FM-07 · Worker Rollback

**Trigger**: A deployment breaks a live Worker (health check fails, error rate spikes, regression detected by synthetic monitor).

### Procedure

1. Confirm the failure:
   ```bash
   curl https://{worker-name}.adrper79.workers.dev/health
   ```
   Expected: `200 {"status":"ok"}`. Any other response confirms failure.
2. Identify the last known-good deployment in the Cloudflare dashboard (Workers → Deployments).
3. Execute rollback — do **not** use `--force` or skip `wrangler deploy` verification:
   ```bash
   wrangler rollback --env production
   ```
   Or via the Cloudflare dashboard: Workers → Deployments → ⋯ → Roll back to this version.
4. Re-confirm health:
   ```bash
   curl https://{worker-name}.adrper79.workers.dev/health
   ```
5. Open a postmortem issue using the `docs/templates/` postmortem template. Assign to the on-call team.
6. Do not re-deploy the broken version until root cause is identified and the fix is reviewed.

### Consumer impact

Before rollback, check `docs/service-registry.yml` for consumer workers — they may need cache invalidation or a compatible version deployed simultaneously.

### Audit trail

Record the rollback in the deployment log:
```json
{ "event": "operator.deployment.rollback", "properties": { "worker": "...", "trigger": "health_check_fail|error_spike|manual", "operator": "...", "previous_version": "...", "restored_version": "..." } }
```

---

## Quick-reference decision tree

```
User reports a problem
│
├─ Video not rendered ────────────────────────────────────────────── FM-01
├─ Credit missing or wrong ──────────────────────────────────────── FM-02
├─ Booking stuck / double charge ────────────────────────────────── FM-03
├─ Cannot log in ────────────────────────────────────────────────── FM-04
├─ Request to delete account or data ────────────────────────────── FM-05
├─ Report about harmful content ─────────────────────────────────── FM-06
└─ Live service down after recent deploy ────────────────────────── FM-07
```
