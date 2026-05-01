import { Hono } from 'hono';
import { sql } from '@latimer-woods-tech/neon';
import type { FactoryDb } from '@latimer-woods-tech/neon';
import type { Analytics } from '@latimer-woods-tech/analytics';
import { InternalError, NotFoundError, ErrorCodes, FactoryBaseError } from '@latimer-woods-tech/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for {@link createAdminRouter}.
 */
export interface AdminRouterOpts {
  /** Drizzle / Neon database client. */
  db: FactoryDb;
  /** Analytics instance for event querying. */
  analytics: Analytics;
  /** App identifier — used to scope event queries. */
  appId: string;
}

/** Dashboard summary returned by `GET /admin`. */
export interface DashboardSummary {
  appId: string;
  totalUsers: number;
  activeUsers: number;
  recentEvents: number;
}

/** Row shape from the users table used internally. */
export interface UserRow {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

/** Event row shape from `factory_events` table. */
export interface EventRow {
  event: string;
  user_id: string | null;
  occurred_at: string;
  properties: string | Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// createAdminRouter
// ---------------------------------------------------------------------------

/**
 * Creates a Hono router that an app mounts at `/admin`.
 *
 * Routes:
 * - `GET  /`              → dashboard summary
 * - `GET  /users`         → paginated user list (query: `page`, `limit`)
 * - `GET  /users/:id`     → single user detail
 * - `POST /users/:id/suspend` → suspend a user
 * - `GET  /events`        → recent factory_events for this app
 * - `GET  /health`        → database connectivity check
 *
 * @example
 * ```ts
 * const app = new Hono();
 * app.route('/admin', createAdminRouter({ db, analytics, appId: 'ijustus' }));
 * ```
 */
export function createAdminRouter(opts: AdminRouterOpts): Hono {
  const { db, appId } = opts;
  const router = new Hono();

  // Map FactoryBaseError status codes to HTTP responses
  router.onError((err, c) => {
    if (err instanceof FactoryBaseError) {
      return c.json({ error: err.message, code: err.code }, err.status as 400 | 401 | 403 | 404 | 500);
    }
    return c.json({ error: 'Internal server error' }, 500);
  });

  // -------------------------------------------------------------------------
  // GET / — dashboard summary
  // -------------------------------------------------------------------------
  router.get('/', async (c) => {
    interface CountRow extends Record<string, unknown> { count: string }
    interface ActiveRow extends Record<string, unknown> { count: string }
    interface EventCountRow extends Record<string, unknown> { count: string }

    const [total, active, events] = await Promise.all([
      db.execute<CountRow>(sql`SELECT COUNT(*) AS count FROM users`),
      db.execute<ActiveRow>(sql`SELECT COUNT(*) AS count FROM users WHERE status = 'active'`),
      db.execute<EventCountRow>(
        sql`SELECT COUNT(*) AS count FROM factory_events
            WHERE app_id = ${appId}
              AND occurred_at > NOW() - INTERVAL '24 hours'`,
      ),
    ]);

    const summary: DashboardSummary = {
      appId,
      totalUsers: Number(total.rows[0]?.count ?? 0),
      activeUsers: Number(active.rows[0]?.count ?? 0),
      recentEvents: Number(events.rows[0]?.count ?? 0),
    };

    return c.json(summary);
  });

  // -------------------------------------------------------------------------
  // GET /users — paginated list
  // -------------------------------------------------------------------------
  router.get('/users', async (c) => {
    const page = Math.max(1, Number(c.req.query('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? '20')));
    const offset = (page - 1) * limit;

    interface UsersRow extends Record<string, unknown> {
      id: string; email: string; status: string; created_at: string;
    }

    const rows = await db.execute<UsersRow>(
      sql`SELECT id, email, status, created_at FROM users
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}`,
    );

    return c.json({ page, limit, users: rows.rows });
  });

  // -------------------------------------------------------------------------
  // GET /users/:id — single user detail
  // -------------------------------------------------------------------------
  router.get('/users/:id', async (c) => {
    const id = c.req.param('id');

    interface UserDetailRow extends Record<string, unknown> {
      id: string; email: string; status: string; created_at: string;
    }
    interface SubRow extends Record<string, unknown> {
      plan: string; mrr: string | number; status: string;
    }

    const userRows = await db.execute<UserDetailRow>(
      sql`SELECT id, email, status, created_at FROM users WHERE id = ${id} LIMIT 1`,
    );
    const user = userRows.rows[0];
    if (!user) {
      throw new NotFoundError(`User ${id} not found`);
    }

    const subRows = await db.execute<SubRow>(
      sql`SELECT plan, mrr, status FROM stripe_subscriptions WHERE user_id = ${id}`,
    );

    return c.json({ user, subscriptions: subRows.rows });
  });

  // -------------------------------------------------------------------------
  // POST /users/:id/suspend — suspend a user
  // -------------------------------------------------------------------------
  router.post('/users/:id/suspend', async (c) => {
    const id = c.req.param('id');

    const result = await db.execute(
      sql`UPDATE users SET status = 'suspended' WHERE id = ${id}`,
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundError(`User ${id} not found`);
    }

    return c.json({ success: true, userId: id, status: 'suspended' });
  });

  // -------------------------------------------------------------------------
  // GET /events — recent factory_events
  // -------------------------------------------------------------------------
  router.get('/events', async (c) => {
    interface FactoryEvtRow extends Record<string, unknown> {
      event: string;
      user_id: string | null;
      occurred_at: string;
      properties: string;
    }

    const rows = await db.execute<FactoryEvtRow>(
      sql`SELECT event, user_id, occurred_at, properties
          FROM factory_events
          WHERE app_id = ${appId}
          ORDER BY occurred_at DESC
          LIMIT 100`,
    );

    const events = rows.rows.map((r) => ({
      event: r.event,
      userId: r.user_id,
      occurredAt: r.occurred_at,
      properties: (typeof r.properties === 'string'
        ? JSON.parse(r.properties)
        : r.properties) as Record<string, unknown>,
    }));

    return c.json({ events });
  });

  // -------------------------------------------------------------------------
  // GET /health — DB ping
  // -------------------------------------------------------------------------
  router.get('/health', async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ status: 'ok', db: 'connected', appId });
    } catch (err) {
      throw new InternalError('Database connectivity check failed', {
        code: ErrorCodes.DB_CONNECTION_FAILED,
        cause: (err as Error).message,
      });
    }
  });

  return router;
}
