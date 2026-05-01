import { sql } from '@latimer-woods-tech/neon';
import type { FactoryDb } from '@latimer-woods-tech/neon';
import { NotFoundError, InternalError, ErrorCodes } from '@latimer-woods-tech/errors';
import type { Analytics } from '@latimer-woods-tech/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lifecycle status of a lead in the CRM. */
export type LeadStatus = 'lead' | 'trial' | 'active' | 'churned';

/** Churn risk classification for a customer. */
export type ChurnRisk = 'low' | 'medium' | 'high';

/**
 * A lead or customer record stored in the `crm_leads` table.
 */
export interface Lead {
  /** UUID primary key. */
  id: string;
  /** Authenticated user identifier. */
  userId: string;
  /** App that originated the lead. */
  appId: string;
  /** Acquisition channel (e.g. 'organic', 'tiktok', 'referral'). */
  source: string;
  /** Current lifecycle status. */
  status: LeadStatus;
  /** Monthly recurring revenue in cents. */
  mrr: number;
  /** When the lead record was created. */
  createdAt: Date;
  /** When the lead converted to a paid customer. */
  convertedAt?: Date;
}

/** Minimal subscription record used in {@link CustomerView}. */
export interface SubscriptionStatus {
  plan: string;
  mrr: number;
  status: string;
}

/** Minimal event record used in {@link CustomerView}. */
export interface FactoryEvent {
  event: string;
  properties: Record<string, unknown>;
  occurredAt: Date;
}

/**
 * A full 360-degree view of a customer — lead info, subscriptions, events, churnRisk.
 */
export interface CustomerView {
  lead: Lead;
  subscriptions: SubscriptionStatus[];
  events: FactoryEvent[];
  churnRisk: ChurnRisk;
}

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

/**
 * DDL statement that creates the `crm_leads` table.
 * Run once during provisioning / migration.
 */
export const CREATE_CRM_LEADS_TABLE = `
CREATE TABLE IF NOT EXISTS crm_leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  app_id       TEXT NOT NULL,
  source       TEXT NOT NULL DEFAULT 'organic',
  status       TEXT NOT NULL DEFAULT 'lead',
  mrr          INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ,
  UNIQUE(user_id, app_id)
);
`.trim();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface LeadRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  app_id: string;
  source: string;
  status: string;
  mrr: string | number;
  created_at: string | Date;
  converted_at: string | Date | null;
}

interface SubRow extends Record<string, unknown> {
  plan: string;
  mrr: string | number;
  status: string;
}

interface EventRow extends Record<string, unknown> {
  event: string;
  properties: string;
  occurred_at: string | Date;
}

function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    userId: row.user_id,
    appId: row.app_id,
    source: row.source,
    status: row.status as LeadStatus,
    mrr: Number(row.mrr),
    createdAt: new Date(row.created_at as string),
    convertedAt: row.converted_at != null ? new Date(row.converted_at as string) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Records a new lead, or returns the existing one if (userId, appId) already exists.
 *
 * @param db - Drizzle / Neon database client.
 * @param opts - Lead details.
 */
export async function trackLead(
  db: FactoryDb,
  opts: { userId: string; appId: string; source: string },
): Promise<Lead> {
  const { userId, appId, source } = opts;

  if (!userId || !appId || !source) {
    throw new InternalError('trackLead: userId, appId, and source are required', {
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  const rows = await db.execute<LeadRow>(
    sql`INSERT INTO crm_leads (user_id, app_id, source)
        VALUES (${userId}, ${appId}, ${source})
        ON CONFLICT (user_id, app_id) DO UPDATE
          SET source = EXCLUDED.source
        RETURNING *`,
  );

  const row = rows.rows[0];
  if (!row) {
    throw new InternalError('trackLead: no row returned', { code: ErrorCodes.DB_QUERY_FAILED });
  }
  return rowToLead(row);
}

/**
 * Marks a lead as a paying customer and records the MRR.
 * Updates status to 'active', sets mrr, and stamps convertedAt.
 *
 * @param db - Drizzle / Neon database client.
 * @param opts - Conversion details.
 * @param analytics - Optional Analytics instance for business event tracking.
 */
export async function trackConversion(
  db: FactoryDb,
  opts: { userId: string; plan: string; mrr: number },
  analytics?: Analytics,
): Promise<void> {
  const { userId, plan, mrr } = opts;

  if (!userId || !plan) {
    throw new InternalError('trackConversion: userId and plan are required', {
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }
  if (mrr < 0) {
    throw new InternalError('trackConversion: mrr must not be negative', {
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  const result = await db.execute(
    sql`UPDATE crm_leads
        SET status = 'active', mrr = ${mrr}, converted_at = NOW()
        WHERE user_id = ${userId}`,
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new NotFoundError(`No lead found for userId ${userId}`);
  }

  if (analytics) {
    await analytics.businessEvent('subscription.converted', { plan, mrr }, userId);
  }
}

/**
 * Returns a full 360-degree customer view: lead record, subscriptions,
 * recent events, and a derived churn risk assessment.
 *
 * @param db - Drizzle / Neon database client.
 * @param userId - The user to look up.
 */
export async function getCustomerView(db: FactoryDb, userId: string): Promise<CustomerView> {
  if (!userId) {
    throw new InternalError('getCustomerView: userId is required', {
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  // Lead
  const leadRows = await db.execute<LeadRow>(
    sql`SELECT * FROM crm_leads WHERE user_id = ${userId} LIMIT 1`,
  );
  const leadRow = leadRows.rows[0];
  if (!leadRow) {
    throw new NotFoundError(`No CRM lead found for userId ${userId}`);
  }
  const lead = rowToLead(leadRow);

  // Subscriptions — from stripe_subscriptions if present
  let subscriptions: SubscriptionStatus[] = [];
  try {
    const subRows = await db.execute<SubRow>(
      sql`SELECT plan, mrr, status FROM stripe_subscriptions WHERE user_id = ${userId}`,
    );
    subscriptions = subRows.rows.map((r) => ({
      plan: r.plan,
      mrr: Number(r.mrr),
      status: r.status,
    }));
  } catch {
    // Table may not exist in all apps — treat as empty
    subscriptions = [];
  }

  // Recent events from factory_events
  let events: FactoryEvent[] = [];
  try {
    const evtRows = await db.execute<EventRow>(
      sql`SELECT event, properties, occurred_at
          FROM factory_events
          WHERE user_id = ${userId}
          ORDER BY occurred_at DESC
          LIMIT 50`,
    );
    events = evtRows.rows.map((r) => ({
      event: r.event,
      properties: (typeof r.properties === 'string'
        ? JSON.parse(r.properties)
        : r.properties) as Record<string, unknown>,
      occurredAt: new Date(r.occurred_at as string),
    }));
  } catch {
    events = [];
  }

  // Churn risk heuristic
  const daysSinceActivity =
    events.length > 0
      ? (Date.now() - (events[0]?.occurredAt.getTime() ?? 0)) / 86_400_000
      : Infinity;

  let churnRisk: ChurnRisk;
  if (lead.status === 'churned') {
    churnRisk = 'high';
  } else if (lead.mrr === 0 || daysSinceActivity > 30) {
    churnRisk = 'medium';
  } else {
    churnRisk = 'low';
  }

  return { lead, subscriptions, events, churnRisk };
}
