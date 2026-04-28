# Admin Studio — API Surface

Versioned reference for the `admin-studio` Worker. All routes are JSON unless noted.

> Phase A ships routes marked **✅** with full enforcement; **🔧** routes return stubs but their middleware (auth, audit, confirmation) is fully wired.

| Method | Path              | Auth | Confirmation | Phase A      |
| ------ | ----------------- | :--: | ------------ | ------------ |
| GET    | `/health`         |  ❌  | —            | ✅           |
| POST   | `/auth/login`     |  ❌  | —            | ✅ (stub user) |
| POST   | `/auth/logout`    |  ✅  | —            | ✅           |
| GET    | `/me/`            |  ✅  | —            | ✅           |
| GET    | `/tests/`         |  ✅  | —            | 🔧 (static list) |
| POST   | `/tests/runs`     |  ✅  | tier 1 (rev) | 🔧           |
| GET    | `/tests/runs/:id` |  ✅  | —            | 🔧           |
| GET    | `/deploys/`       |  ✅  | —            | 🔧           |
| POST   | `/deploys/`       |  ✅  | tier 2+ (mr) | 🔧           |
| POST   | `/ai/chat`        |  ✅  | —            | 🔧           |
| POST   | `/ai/proposals`   |  ✅  | tier 2 (rev) | ❌ (501)     |

## Error envelope

All errors share this shape:

```json
{
  "error": "human-readable message",
  "requestId": "uuid",
  "detail": "extra info (non-prod only)"
}
```

## Status codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 200  | OK                                                         |
| 204  | No Content (CORS preflight)                                |
| 400  | Validation failure                                         |
| 401  | Missing/invalid/expired JWT — UI auto-logs-out             |
| 403  | Token env != worker env, or insufficient role              |
| 412  | **Confirmation required** — see `tier` and `action` fields |
| 500  | Server error — `requestId` for log correlation             |

## 412 Confirmation flow

When a route requires confirmation, the first call returns `412` with:

```json
{
  "error": "Confirmation required",
  "tier": 2,
  "reversibility": "manual-rollback",
  "action": "deploy.trigger",
  "expectedTokenHint": "Type the action name \"deploy.trigger\" to confirm"
}
```

UI shows the modal, computes the confirm token, and retries with appropriate headers (`X-Confirmed: true` for tier 1; `X-Confirm-Token: <hex>` for tier 2+).

## Per-route specs

### `POST /auth/login`

```http
POST /auth/login
Content-Type: application/json

{ "email": "...", "password": "...", "env": "staging", "app": "wordis-bond" }
```

Returns:

```json
{ "token": "eyJ...", "expiresAt": 1700014400000 }
```

- `env` must match the worker's `STUDIO_ENV` binding (a staging worker will not issue prod tokens).
- Token TTL = 4h prod / 24h other.
- Phase B replaces the bootstrap stub with real password verification (Argon2 via Workers-safe lib).

### `POST /tests/runs`

```http
POST /tests/runs
Authorization: Bearer ...
X-Confirmed: true
Content-Type: application/json

{ "suites": ["studio-core", "auth"], "filter": "describe-name" }
```

Add `?dryRun=true` (or `X-Dry-Run: true`) to receive the plan instead of dispatching.

### `POST /deploys/`

```http
POST /deploys/
Authorization: Bearer ...
X-Confirm-Token: a1b2c3d4e5f60718

{ "app": "wordis-bond", "ref": "main" }
```

- Production: requires `role=owner` (not just `admin`).
- Local env: 400 (you can't deploy from a local-bound session).
- Always supports dry-run for plan inspection.

## OpenAPI / Hono RPC

A typed client is auto-generated from Hono's `hc()` helper in Phase B and shipped as `@adrper79-dot/admin-studio-client` for use by other Factory apps that need to call Studio APIs (e.g. CI gating).
