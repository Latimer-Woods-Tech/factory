---
title: Security Review Checklist
description: Comprehensive security audit checklist for applications before scaling and monetization.
---

# Security Review Checklist

**Last Updated:** April 28, 2026  
**Phase:** Phase D (T5.4)  
**Owner:** Security team + App team leads

## Overview

This checklist is applied to every app before scaling (Phase 4 onwards). Use this to audit videoking, admin-studio, and all Factory apps for security vulnerabilities.

**Scoring:** Each section is scored 0–100%. Target: >90% passing for production.

**Use:** 
1. App team completes self-assessment (honest)
2. Security lead reviews + tests
3. Results documented in `docs/{app}/security-audit-report.md`
4. Action items added to backlog with priority

---

## 1. Authentication & Authorization (15% of score)

### Authentication

- [ ] JWT tokens are validated on every request (not skipped for certain routes)
- [ ] JWT secret is rotated monthly (or on personnel change)
- [ ] JWT expiry is set (default <1 hour; refresh token <7 days)
- [ ] JWT is sent in Authorization header, not in URL or cookies (unless explicitly needed)
- [ ] Token revocation list exists (e.g., logout blacklist in Redis)
- [ ] No JWT values logged or exposed in error messages
- [ ] Token signing uses RS256 or ES256 (not HS256) if possible

**Test:**
```bash
# Expired token should fail
curl -H "Authorization: Bearer {expired_jwt}" https://app/api/admin/users
# Should return 401, not 200

# Invalid signature should fail
curl -H "Authorization: Bearer {tampered_jwt}" https://app/api/admin/users
# Should return 401, not 500 (don't expose tampering)
```

### Authorization (RBAC)

- [ ] Every protected endpoint checks permission (not just authenticated)
- [ ] Roles are defined: admin, moderator, creator, user, etc.
- [ ] Role → permissions mapping is centralized (not scattered across code)
- [ ] No hardcoded permissions (all config-driven)
- [ ] Privilege escalation test: Non-admin cannot promote themselves to admin
- [ ] Privilege escalation test: User cannot access another user's private data via ID tampering
- [ ] Privilege escalation test: Moderator cannot access admin-only endpoints

**Test:**
```bash
# User should not be able to access another user's data
curl -H "Authorization: Bearer {user_token}" https://app/api/users/123/private
# If token is for user 456, should return 403, not user 123 data

# Creator cannot approve their own payout (role mismatch)
curl -X POST -H "Authorization: Bearer {creator_token}" \
  https://app/api/admin/payouts/approve -d '{"id":"999"}'
# Should return 403 (requires admin role)
```

---

## 2. Data Protection (15% of score)

### Encryption

- [ ] Sensitive data (passwords, API keys, PII) encrypted at rest
- [ ] Database column encryption used for PII (name, email, SSN, etc.)
- [ ] Encryption keys rotated quarterly
- [ ] Encryption keys not committed to source code
- [ ] TLS 1.2+ used for all transport (https://, not http://)
- [ ] Certificate pinning (optional; for mobile apps)

**Test:**
```bash
# HTTP should redirect to HTTPS
curl -I http://app.example.com
# Should return 301 with Location: https://

# Cert should be valid
openssl s_client -connect app.example.com:443
# Should show valid cert, no warnings
```

### PII Handling

- [ ] Identify all PII stored: email, phone, SSN, address, payment info, etc.
- [ ] Retention policy documented (how long do we keep each data type?)
- [ ] PII is logged only when necessary (never in request/response logs by default)
- [ ] PII is redacted in error messages (don't show email in "User {email} not found")
- [ ] PII is deleted when user requests deletion (GDPR "right to be forgotten")
- [ ] Sensitive fields are never returned in non-authenticated responses

**Test:**
```sql
-- Check logs for PII
SELECT * FROM query_logs WHERE query LIKE '%user_email%' OR query LIKE '%ssn%';
-- Should return empty or only necessary queries

-- Check error messages
SELECT * FROM error_logs WHERE message LIKE '%@%' OR message LIKE '%555-%';
-- Should return empty (no email/phone in errors)
```

---

## 3. Payments & Finance (15% of score)

### Stripe Integration

- [ ] Stripe API key (secret key) is in environment variable, never in code
- [ ] Stripe webhook signature is validated before processing
- [ ] No card data is stored (PCI compliance)
- [ ] No card data is logged
- [ ] Card data transits only directly to Stripe (not through our server)
- [ ] Test mode / live mode are separate environments (not mixed)
- [ ] Stripe API version is pinned (not auto-upgrading)

**Test:**
```bash
# Webhook signature should fail if tampered
# Generate a fake webhook event and POST without signature validation enabled
# System should return 401, not process event

# Test API should not use live credentials
curl -H "Authorization: Bearer sk_test_..." https://api.stripe.co m/v1/charges
# If any live operations (sk_live_...) in production environment, fail this check
```

### Financial Totals

- [ ] Revenue reconciliation: database total = Stripe total (monthly)
- [ ] Payouts reconciliation: paid creators sum = exported from system (weekly)
- [ ] No stale pending transactions (>7 days investigation trigger)
- [ ] Partial refunds require audit trail (who approved, why)

**Test:**
```sql
-- Revenue check: sum from database should match Stripe export
SELECT SUM(amount) FROM transactions WHERE status='completed' AND created_at > now() - interval '30 days';
-- Compare to Stripe API: list all charges for same period
```

---

## 4. Session & Data Access (10% of score)

### Session Management

- [ ] Sessions expire after inactivity (default <1 hour)
- [ ] Session tokens are renewed periodically (not just when expired)
- [ ] Logout clears session tokens (no persistent login backdoors)
- [ ] Simultaneous sessions limited (or alerting on unusual locations)
- [ ] No session token in URL (GET params), only in headers/cookies

**Test:**
```bash
# Session should expire
curl -H "Authorization: Bearer {valid_token}" https://app/api/admin/users
# Should return 200

# Wait 61 minutes

curl -H "Authorization: Bearer {same_token}" https://app/api/admin/users
# Should return 401 (expired)
```

### Data Access Limits

- [ ] Each API endpoint returns minimal data (principle of least privilege)
- [ ] Bulk export endpoints are rate-limited (1 request per minute)
- [ ] Bulk query operations require audit logging (e.g., "export all users" logged)
- [ ] No infinite loops possible in queries (pagination enforced)

**Test:**
```bash
# GET /api/users should return only first 25 users, not all 1M
curl https://app/api/users?limit=999999
# Should return only 25, with `next_page_token` for pagination

# Exporting 1M users should be rejected or rate-limited
curl https://app/api/users/export
# Should return 429 (too many requests) or 403 if done again within 1 min
```

---

## 5. Abuse Prevention (10% of score)

### Rate Limiting

- [ ] Login endpoint rate-limited: max 5 attempts per IP per minute
- [ ] signup endpoint rate-limited: max 1 per email per hour
- [ ] API endpoints rate-limited: max 100 requests per distinct user per minute
- [ ] Rate limit headers returned (X-RateLimit-Remaining, etc.)
- [ ] No bypasses possible via header spoofing (X-Forwarded-For checked carefully)

**Test:**
```bash
# Login attempts should throttle
for i in {1..10}; do
  curl -X POST https://app/api/auth/login -d '{"email":"test@example.com","password":"wrong"}'
done
# After 5 attempts within 1 min, should return 429
```

### CAPTCHA / Abuse Signals

- [ ] Signup or high-value actions protected by CAPTCHA (if applicable)
- [ ] Suspicious activity detection (e.g., 10 payouts to new bank in 1 hour)
- [ ] Fraud flags are generated + reviewed by ops team
- [ ] Repeat offenders are tracked (3+ fraud flags → account suspension)

**Test:**
```bash
# Attempting 10 withdrawals in 1 minute should trigger fraud flag
for i in {1..10}; do
  curl -X POST https://app/api/payouts -d '{"amount":1000}'
done
# Check fraud_flags table; should see entry with reason "high withdrawal frequency"
```

---

## 6. Secrets & Environment (10% of score)

### Secrets Management

- [ ] No hardcoded secrets in source code (grep for API_KEY, PASSWORD, SECRET in codebase)
- [ ] All secrets in environment variables or GitHub Actions secrets
- [ ] `.env` files used only for local dev, never committed
- [ ] `.gitignore` includes `.env`, `*.key`, `*.pem`, etc.
- [ ] Secrets are injected at runtime, not baked into Docker images

**Test:**
```bash
# Grep for common secret patterns
git log --all --full-history -p | grep -E '(stripe_sk_live|DATABASE_PASSWORD|JWT_SECRET)='
# Should return empty (or only in removed commits)

# Check .gitignore
cat .gitignore | grep -E '\.env|\.key|\.pem|secrets'
# Should include patterns for sensitive files
```

### Third-Party Integrations

- [ ] Each integration has a dedicated API key / service account
- [ ] Integration keys have minimal required permissions (not admin)
- [ ] Integration keys are rotated quarterly
- [ ] Integration failures don't expose sensitive details (e.g., "Stripe API error: invalid_api_key" shouldn't tell attacker which key)

**Test:**
```bash
# Stripe should return 403 if key is invalid, not expose the key
curl -H "Authorization: Bearer sk_invalid" https://api.stripe.com/v1/charges
# Should return auth error, not leak any parts of the key
```

---

## 7. Logging & Audit (10% of score)

### Sensitive Data in Logs

- [ ] PII (email, phone, SSN) not in logs (or fully redacted)
- [ ] Payment info (card numbers, CVV) never in logs
- [ ] API keys not in logs
- [ ] Passwords not in logs (even hashed)
- [ ] Request/response bodies redacted if they contain secrets
- [ ] Logs are searchable but not accessible to unauthorized users

**Test:**
```bash
# Search logs for sensitive patterns
grep -r "email" logs/ | head
grep -r "password" logs/ | head
grep -r "4[0-9]{12}(?:[0-9]{3})?" logs/ | head  # Regex for card number
# Should return empty for all
```

### Audit Trail

- [ ] All state-changing operations logged (create, update, delete, approve, deny)
- [ ] Audit trail includes: who, what, when, why
- [ ] Audit trail is immutable (cannot be modified after creation)
- [ ] Compliance operations (e.g., approval of creator) are audited
- [ ] Sensitive access (e.g., "viewed user's payout history") is logged

---

## 8. Infrastructure & Deployment (10% of score)

### Firewall & Security Groups

- [ ] Database access restricted to app server IP range (not open to 0.0.0.0)
- [ ] No SSH access from anywhere (only from bastion/VPN if needed)
- [ ] API gates behind WAF (CloudFlare or equivalent)
- [ ] WAF rules block known exploit patterns (SQL injection, XSS, etc.)

**Test:**
```bash
# External IP should not be able to connect to database
curl telnet://{db-host}:5432
# Should timeout or refuse (not succeed)
```

### Deployment & CI/CD

- [ ] Production deployments require approval (not automatic on merge)
- [ ] Deployments are tracked: who deployed what when
- [ ] Rollback procedures are tested (not just documented)
- [ ] Database secrets are rotated before each deploy (or have strong rotation policy)
- [ ] No default credentials left in production (db user != "postgres" with password "postgres")

**Test:**
```bash
# Production database should have strong credentials, not defaults
psql -U postgres -d {prod_database}
# Should fail (postgres user doesn't exist or has secure password)

# Test rollback procedure exists and is documented
ls docs/runbooks/rollback-procedure.md
# Should exist and include tested procedures
```

---

## 9. Error Handling & Monitoring (5% of score)

### Error Messages

- [ ] Production error messages are generic ("Something went wrong") not detailed
- [ ] Detailed error messages only in development or when authenticated as admin
- [ ] Stack traces never exposed to users
- [ ] Error messages don't reveal system internals (e.g., "Django version X" or "Postgres error: invalid query")

**Test:**
```bash
# Invalid request should return generic error
curl https://app/api/users/invalid-id
# Should return 400 with message like "Invalid request"
# NOT: "Database error: type casting failed"
```

### Monitoring & Alerting

- [ ] Security monitoring: Failed login attempts tracked
- [ ] Security monitoring: Unusual API access patterns alerted
- [ ] Alerts sent to security team (not just engineering Slack)
- [ ] Alert response SLA: <1 hour for security alerts

---

## 10. Compliance & Testing (5% of score)

### Security Testing

- [ ] Security tests written for critical paths (payment, auth, data access)
- [ ] Regular penetration testing (quarterly or annually)
- [ ] OWASP Top 10 vulnerabilities checked
- [ ] Dependency vulnerability scanner enabled (Dependabot or Snyk)

**Test:**
```bash
# Run vulnerability scanner
npm audit
# Should not have any high-severity vulnerabilities; mediums reviewed
```

### Compliance

- [ ] PII handling complies with applicable laws (GDPR, CCPA, etc.)
- [ ] Terms of Service mention data retention, deletion, export
- [ ] Privacy Policy describes data handling
- [ ] Data deletion request procedure documented and tested

---

## Scoring & Report

| Section | Max Points | Earned | % |
|---------|-----------|--------|---|
| 1. Auth & Authz | 15 | 13 | 87% |
| 2. Data Protection | 15 | 12 | 80% |
| 3. Payments | 15 | 15 | 100% |
| 4. Session & Access | 10 | 8 | 80% |
| 5. Abuse Prevention | 10 | 7 | 70% |
| 6. Secrets | 10 | 10 | 100% |
| 7. Logging | 10 | 9 | 90% |
| 8. Infrastructure | 10 | 8 | 80% |
| 9. Errors & Monitoring | 5 | 5 | 100% |
| 10. Compliance | 5 | 4 | 80% |
| **TOTAL** | **100** | **91** | **91%** |

---

## Action Items

| Issue | Severity | Fix | Timeline |
|-------|----------|-----|----------|
| Rate limit on signup not enforced | Medium | Add rate limiter to signup endpoint | 1 week |
| Login retry limit only 3, increase to 5 | Low | Update constant + test | 1 week |
| PII logged in some audit entries | Medium | Redact email + phone from audit log | 2 weeks |

---

## Related Docs

- [Privacy Audit Report](../videoking/privacy-audit-report.md) — GDPR + data handling compliance
- [SLO Framework](slo-framework.md) — Security incident SLOs (P1 response)
- [Secret Rotation](secret-rotation.md) — How to rotate credentials securely
