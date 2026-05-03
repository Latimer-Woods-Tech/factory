# Stage 5 Complete — Revenue Ops Packages

**Date:** 2026-04-25
**Branch merged:** `stage5/revenue-ops` → `main` (PR #6)

## Packages Shipped

| Package | Version | Tests | Lines | Branches | Funcs |
|---|---|---|---|---|---|
| `@factory/crm` | `crm/v0.1.0` | 18/18 ✅ | 99.64% | 93.02% | 100% |
| `@factory/compliance` | `compliance/v0.1.0` | 20/20 ✅ | 100% | 100% | 100% |
| `@factory/admin` | `admin/v0.1.0` | 14/14 ✅ | 100% | 100% | 100% |

## Tags

```
crm/v0.1.0
compliance/v0.1.0
admin/v0.1.0
stage-5-complete
```

## API Surface

### `@factory/crm`
- `trackLead(db, opts)` — upserts a CRM lead on `(user_id, app_id)` conflict
- `trackConversion(db, opts, analytics?)` — updates status/MRR; fires `subscription.converted` business event
- `getCustomerView(db, userId)` — returns lead + subscriptions + recent events + churn risk (`low | medium | high`)
- `CREATE_CRM_LEADS_TABLE` — DDL constant

### `@factory/compliance`
- `checkTCPA(opts)` — checks TCPA suppression list; returns `{safe, reason?}`
- `logConsent(db, opts)` — immutable append to `compliance_consents`
- `checkFDCPA(db, opts)` — enforces 24-hour FDCPA contact window
- `recordContact(db, opts)` — inserts into `compliance_contacts`
- `suppressPhone(db, phone, reason?)` — adds to TCPA suppression (ON CONFLICT DO NOTHING)
- DDL: `CREATE_COMPLIANCE_CONSENTS_TABLE`, `CREATE_COMPLIANCE_CONTACTS_TABLE`, `CREATE_TCPA_SUPPRESSION_TABLE`

### `@factory/admin`
- `createAdminRouter(opts)` — returns a Hono sub-router for admin operations
  - `GET /` — dashboard summary (totalUsers, activeUsers, recentEvents)
  - `GET /users` — paginated user list
  - `GET /users/:id` — user detail with subscriptions
  - `POST /users/:id/suspend` — suspend a user
  - `GET /events` — recent factory events for the app
  - `GET /health` — DB connectivity ping

## Factory Core Status

All 19 packages are implemented:

| Stage | Packages |
|---|---|
| Stage 1 | errors, monitoring, logger, auth, neon, stripe |
| Stage 2 | llm, telephony |
| Stage 3 | analytics, deploy, testing |
| Stage 4 | email, copy, content, social, seo |
| Stage 5 | crm, compliance, admin |

## Outstanding

- GitHub Packages publishing blocked (see `BLOCKED.md`) — scope `@factory/*` requires a `factory` GitHub org
- Mintlify docs not yet deployed
- FocusBro migration not started
