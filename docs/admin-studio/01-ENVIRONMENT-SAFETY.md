# Factory Admin Studio — Environment Safety Design

**Status:** Authoritative design  
**Owner:** Studio Team  
**Last updated:** 2026-04-28

---

## Why This Exists

Wrong-environment errors are the **highest-cost bugs**. Examples:
- Running migration against prod DB when staging was intended
- Deploying staging code to production worker
- Editing prod content thinking it's a draft
- Copying prod credentials into local `.dev.vars` and committing

Studio MUST prevent every one of these by **design**, not by user discipline.

---

## The Five Safeguards (Authoritative)

### Safeguard 1: Persistent Environment Banner

**Requirement:** A color-coded banner is rendered on **every page** of Studio.  
**Implementation:** `<EnvironmentBanner>` mounted in `<Layout>` root.

| Environment | Background | Border | Text | Animation | Aria |
|-------------|-----------|--------|------|-----------|------|
| local       | gray-700  | gray-500  | "LOCAL DEVELOPMENT" | none | role="banner" |
| staging     | amber-700 | amber-500 | "STAGING — TEST DATA" | none | role="banner" |
| production  | red-700   | red-500   | "PRODUCTION — LIVE CUSTOMERS" | pulse | role="banner" aria-live="assertive" |

**Rules:**
- Banner is **sticky** at top, z-index 50, cannot be hidden
- Banner shows: env, user email, session start time, "switch env" link
- On mobile, banner remains full-width at top
- Production banner has a pulsing red border for additional alarm

### Safeguard 2: Action Scope Confirmation

**Requirement:** Every mutating action validates intent against environment.

**Confirmation tiers:**

| Tier | Trigger | Confirmation Required |
|------|---------|----------------------|
| 0 — None | Read-only ops | No confirmation |
| 1 — Click-confirm | Local writes, staging writes | "Are you sure?" modal |
| 2 — Type-confirm | All production writes | Type "production" to enable button |
| 3 — Two-key | Destructive prod (drop table, delete user) | Two admins must approve within 10 minutes |
| 4 — Cooldown | Mass operations (>100 rows) | Tier 2 + 30-second cooldown timer |

**Frontend Component:**

```tsx
// ConfirmDialog.tsx
interface ConfirmDialogProps {
  tier: 0 | 1 | 2 | 3 | 4;
  action: string;              // "Suspend user alice@example.com"
  env: Environment;
  reversibility: ReversibilityTier;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}
```

**Backend Enforcement:**

```typescript
// Any mutating route MUST:
import { requireConfirmation } from '@/middleware/confirmation';

router.post('/users/:id/suspend',
  requireConfirmation({
    tier: (ctx) => ctx.env === 'production' ? 2 : 1,
    action: 'user.suspend',
  }),
  async (c) => { /* ... */ }
);
```

The `requireConfirmation` middleware validates a `X-Confirm-Token` header that the frontend obtains by completing the dialog. Tokens are single-use, valid for 60 seconds, and bound to the action + envContext.

### Safeguard 3: Environment Lock-In Per Session

**Requirement:** Switching environments invalidates session, forcing re-authentication.

**Flow:**
1. Login page shows env picker after credentials verified
2. Selected env baked into JWT as `env` claim
3. JWT also has `envLockedAt` timestamp
4. To switch environments, user clicks "Switch Environment" (logs out, picks again)
5. Production sessions auto-expire after 4 hours; other envs after 24 hours

**Why:** Prevents the "I thought I was in staging" class of error. Forces deliberate context switch.

**Special rules for production:**
- Cannot select production from a session started in another env
- Production login requires 2FA (TOTP or hardware key)
- Production session is logged to audit log immediately on start
- Slack/Discord webhook notifies team channel on prod login

### Safeguard 4: Dry-Run by Default

**Requirement:** Every operation that changes state MUST have a preview/dry-run mode.

**Patterns:**

| Operation | Preview Output |
|-----------|----------------|
| DB migration | Generated SQL + estimated row impact + lock risk |
| Deploy | Git diff + changed files + version bump |
| Bulk update | Sample of 5 affected rows + total count |
| Schema change | Visual diff (added/removed/modified columns) |
| Email send | Rendered preview + recipient count |
| User suspend | List of affected sessions, subscriptions, leads |

**UI Pattern:**
```
[Cancel]  [Show Preview]
              ↓
       Preview shown
              ↓
[Cancel]  [Apply (after type-confirm if prod)]
```

**Backend:** `?dryRun=true` query param on all mutating endpoints returns plan without executing.

### Safeguard 5: Reversibility Indicators

**Requirement:** Every action's risk is shown to the user **before** they click.

**Visual treatment:**

| Tier | Icon | Color | UX Treatment |
|------|------|-------|--------------|
| 🟢 Trivial | check-circle | green-600 | Normal button |
| 🟡 Reversible | rotate-ccw | yellow-600 | Subtle warning text below button |
| 🟠 Manual rollback | alert-triangle | orange-600 | Yellow card around button, "Manual rollback required" |
| 🔴 Irreversible | shield-alert | red-600 | Red card, "Backup recommended", checkbox: "I have a backup" |

**Examples:**

| Action | Tier | Reasoning |
|--------|------|-----------|
| Toggle dark mode | 🟢 | UI preference |
| Edit content draft | 🟢 | Saved as draft |
| Save code to feature branch | 🟡 | Git revert possible |
| Deploy to staging | 🟡 | Redeploy old version |
| Deploy to production | 🟠 | wrangler rollback required |
| Run DB migration | 🟠 | Reverse migration may not exist |
| Drop table | 🔴 | Data loss without backup |
| Delete user | 🔴 | Cascading data loss |
| Send email campaign | 🔴 | Cannot unsend |

---

## The Audit Log

### Schema

```sql
-- factory_core database
CREATE TABLE studio_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id       TEXT NOT NULL,
  user_email    TEXT NOT NULL,
  user_role     TEXT NOT NULL,
  session_id    TEXT NOT NULL,
  env           TEXT NOT NULL CHECK (env IN ('local','staging','production')),
  action        TEXT NOT NULL,                   -- "deploy.production"
  resource      TEXT,                            -- "wordis-bond"
  resource_id   TEXT,                            -- e.g., user UUID
  reversibility TEXT NOT NULL,                   -- 'trivial' | 'reversible' | ...
  payload       JSONB NOT NULL DEFAULT '{}',     -- full request body (secrets stripped)
  result        TEXT NOT NULL,                   -- 'success' | 'failure' | 'dry-run'
  result_detail JSONB,                           -- error msg, response data
  ip_address    INET,
  user_agent    TEXT,
  request_id    TEXT NOT NULL                    -- correlation with logs
);

CREATE INDEX idx_audit_user ON studio_audit_log (user_id, occurred_at DESC);
CREATE INDEX idx_audit_env ON studio_audit_log (env, occurred_at DESC);
CREATE INDEX idx_audit_action ON studio_audit_log (action, occurred_at DESC);
CREATE INDEX idx_audit_resource ON studio_audit_log (resource, resource_id);
```

### Middleware

```typescript
// apps/admin-studio/src/middleware/audit.ts

export const auditMiddleware = createMiddleware<{
  Variables: { envContext: EnvContext; auditPayload: Record<string, unknown> };
  Bindings: Env;
}>(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.header('X-Request-Id', requestId);

  const start = Date.now();
  const ctx = c.get('envContext');

  // Allow handlers to enrich the audit payload
  c.set('auditPayload', {});

  let result: 'success' | 'failure' = 'success';
  let resultDetail: unknown = null;
  try {
    await next();
    if (c.res.status >= 400) {
      result = 'failure';
      resultDetail = { status: c.res.status };
    }
  } catch (err) {
    result = 'failure';
    resultDetail = { error: (err as Error).message };
    throw err;
  } finally {
    // Skip audit for read-only routes
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method);
    if (isMutation && ctx) {
      const db = createDb(c.env.FACTORY_CORE_DB);
      await db.execute(sql`
        INSERT INTO studio_audit_log
          (user_id, user_email, user_role, session_id, env, action, resource, resource_id,
           reversibility, payload, result, result_detail, ip_address, user_agent, request_id)
        VALUES
          (${ctx.userId}, ${ctx.userEmail ?? ''}, ${ctx.role}, ${ctx.sessionId}, ${ctx.env},
           ${c.req.method + ' ' + c.req.path}, ${c.req.param('app') ?? null},
           ${c.req.param('id') ?? null}, ${c.get('reversibility') ?? 'reversible'},
           ${JSON.stringify(c.get('auditPayload'))}, ${result},
           ${JSON.stringify(resultDetail)}, ${c.req.header('CF-Connecting-IP') ?? null},
           ${c.req.header('User-Agent') ?? null}, ${requestId})
      `).catch(() => { /* never let audit failure block response */ });
    }
  }
});
```

---

## Frontend Visual Language

### Color Tokens

```ts
// apps/admin-studio-ui/src/lib/env-colors.ts
export const envColors = {
  local: {
    bg: 'bg-gray-700',
    bgSubtle: 'bg-gray-50',
    border: 'border-gray-500',
    text: 'text-gray-700',
    icon: '🛠️',
    label: 'Local Development',
  },
  staging: {
    bg: 'bg-amber-700',
    bgSubtle: 'bg-amber-50',
    border: 'border-amber-500',
    text: 'text-amber-700',
    icon: '🧪',
    label: 'Staging — Test Data',
  },
  production: {
    bg: 'bg-red-700',
    bgSubtle: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-700',
    icon: '🚨',
    label: 'PRODUCTION — Live Customers',
  },
} as const;
```

### Reversibility Tokens

```ts
export const reversibilityStyles = {
  trivial: { bg: 'bg-green-50', text: 'text-green-700', icon: '✅', label: 'Reversible (UI only)' },
  reversible: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '↩️', label: 'Reversible via git/redeploy' },
  'manual-rollback': { bg: 'bg-orange-50', text: 'text-orange-700', icon: '⚠️', label: 'Manual rollback required' },
  irreversible: { bg: 'bg-red-50', text: 'text-red-700', icon: '🔴', label: 'IRREVERSIBLE — backup required' },
} as const;
```

---

## Production Mode Defaults

When `env === 'production'`, Studio applies:

1. ✅ All mutations require Tier 2 confirmation (type-to-confirm)
2. ✅ All destructive ops require Tier 3 (two-key)
3. ✅ Bulk ops (>100 rows) require Tier 4 (cooldown)
4. ✅ Sessions expire after 4 hours
5. ✅ Slack notification on every action
6. ✅ Auto-screenshot before destructive ops (DOM snapshot to R2)
7. ✅ Read-only mode toggle (one-click "freeze" the env)
8. ✅ Mobile-only operations: notifications and approvals only, no destructive
9. ✅ Audit log entry includes IP address + geolocation
10. ✅ Time-of-day warning ("It's 11pm — defer to tomorrow?")

---

## Testing the Safeguards

Studio's own test suite must include:

```typescript
describe('Environment Safety', () => {
  it('refuses requests without env JWT claim', async () => {
    const res = await app.request('/api/users', {
      headers: { Authorization: 'Bearer ' + jwtWithoutEnv() },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'NO_ENV_CONTEXT' });
  });

  it('blocks production action without Tier 2 confirmation', async () => {
    const res = await app.request('/api/users/u1/suspend', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + jwtProd() },
    });
    expect(res.status).toBe(412);
    expect(await res.json()).toMatchObject({ code: 'CONFIRMATION_REQUIRED', tier: 2 });
  });

  it('expires production session after 4 hours', async () => {
    const oldJwt = jwtProd({ envLockedAt: Date.now() - 5 * 60 * 60 * 1000 });
    const res = await app.request('/api/dashboard', {
      headers: { Authorization: 'Bearer ' + oldJwt },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'ENV_SESSION_EXPIRED' });
  });

  it('writes audit log entry for every mutation', async () => {
    await app.request('/api/users/u1/suspend', { method: 'POST', /* ... */ });
    const log = await db.execute(sql`SELECT * FROM studio_audit_log WHERE action = 'POST /users/:id/suspend' ORDER BY occurred_at DESC LIMIT 1`);
    expect(log.rows[0]).toBeDefined();
  });
});
```

These tests run on every PR and **block merge if they fail**.

---

## Acceptance Criteria

Studio v1.0 cannot ship until:

- [ ] All 5 safeguards implemented and unit-tested
- [ ] Audit log table created and middleware wired
- [ ] Environment Banner visible on all pages (incl. login)
- [ ] Production mode defaults all enforced
- [ ] Safeguard test suite passes 100% on CI
- [ ] Penetration test: attempt to bypass each safeguard, all blocked
- [ ] Manual UAT: 5 users complete prod-mode tasks without confusion
- [ ] Slack/Discord alerts fire on every prod login
- [ ] Documentation reviewed by 2+ engineers
