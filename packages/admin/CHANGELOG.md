# Changelog

## 0.3.0 — 2026-05-02

Implements **SUP-3.1** per `docs/architecture/FACTORY_V1.md § Supervisor substrate` and factory#104.

### Added (additive, no breaking changes to 0.2.0)

- **`SideEffects`** type — `'none' | 'read-external' | 'write-app' | 'write-external'`. Graded side-effects level used by the supervisor to decide if a plan step needs human approval, an audit trail, or a second verifier pass.
- **`SlotSpec`** — runtime parallel of `capabilities.yml` slot declarations. Supports `string` (regex/minLen/maxLen), `number` (min/max/integer), `enum`, `boolean`, and `referential` (async callback for FK-style checks).
- **`validateSlots(slots, input)`** — fails-fast with `ValidationError` on first slot mismatch.
- **`verifyJwt(token, opts)`** — HS256 verification with issuer / audience / expiry enforcement. RS256 follows in a patch release once a JWKS endpoint exists.
- **`scopeMatches(payload, required)`** — supports exact, namespace-wildcard (`admin:*`), and root-wildcard (`*`) scope claims.
- **`createCapabilityMiddleware(opts)`** — Hono middleware that wraps a route with:
  1. Bearer-token extraction + `verifyJwt` (401 on failure)
  2. `required_scope` check (403)
  3. Slot aggregation from path + query + body, then `validateSlots` (422)
  4. Optional `extra_guard: requires_codeowner_approval` via caller-supplied `checkCodeownerApproval` hook (403)
  5. Audit record emission (`allowed` / `denied` with reason)
  6. Parsed slots + payload attached to `c.get('capability.slots' | 'capability.payload')`
- **`AuditRecord` / `AuditSink`** — interface for persisting route invocations. Production consumers wire this to `llm_ledger`-adjacent D1 tables or a Sentry breadcrumb sink.

### Preserved

- `createAdminRouter(opts)` and all its routes (`GET /`, `GET /users`, `GET /users/:id`, `POST /users/:id/suspend`, `GET /events`, `GET /health`) — unchanged from 0.2.0. Consumers can continue to mount the legacy router or adopt capability middleware incrementally.

### How apps consume it

For every route declared in that app's `capabilities.yml`:

```ts
import { Hono } from 'hono';
import { createCapabilityMiddleware, type RouteCapability } from '@latimer-woods-tech/admin';

const suspendUser: RouteCapability = {
  route: 'POST /admin/users/:id/suspend',
  side_effects: 'write-app',
  required_scope: 'admin:write',
  slots: {
    id: { type: 'string', regex: '^u_' },
    reason: { type: 'enum', values: ['spam','fraud','other'] },
  },
  extra_guard: 'requires_codeowner_approval',
};

const app = new Hono();
app.post('/admin/users/:id/suspend',
  createCapabilityMiddleware({
    capability: suspendUser,
    jwt: { secret: env.JWT_SECRET, issuer: 'supervisor', audience: 'prime-self' },
    audit: { write: async (r) => env.DB.prepare(INSERT_AUDIT).bind(...).run() },
    checkCodeownerApproval: async ({ payload }) => ({
      approved: payload.actor === 'human' || payload.sub === 'adrper79-dot',
    }),
  }),
  async (c) => {
    const slots = c.get('capability.slots');
    // handle with slots.id, slots.reason — guaranteed valid
  },
);
```

### Follow-up (not this PR)

- **RS256 + JWKS support** — patch release once supervisor has a public key endpoint.
- **Multi-error aggregation** in `validateSlots` — 0.3.x once we have a real form UX that benefits from it.
- **Wiring into existing app `/admin` routes** — each app opts in per-route in its own PR; `createAdminRouter` remains the default until migration complete.
