import { sql } from '@adrper79-dot/neon';
import type { FactoryDb } from '@adrper79-dot/neon';
import { ValidationError, InternalError } from '@adrper79-dot/errors';

// ---------------------------------------------------------------------------
// Status state machine
// ---------------------------------------------------------------------------

/**
 * Lifecycle statuses for a content item.
 * Progression: draft → review → approved → queued → published → archived
 */
export type ContentStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'queued'
  | 'published'
  | 'archived';

/**
 * Valid transitions from each status.
 * @internal
 */
const STATUS_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  draft: ['review'],
  review: ['approved', 'draft'],
  approved: ['queued', 'review'],
  queued: ['published', 'approved'],
  published: ['archived'],
  archived: [],
};

function assertValidTransition(from: ContentStatus, to: ContentStatus): void {
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new ValidationError(
      `Cannot transition content from '${from}' to '${to}'. Allowed: [${allowed.join(', ')}]`,
    );
  }
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * A single content item stored in the `content_items` table.
 */
export interface ContentItem {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  status: ContentStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fields required when creating a new content item.
 */
export interface CreateContentOpts {
  tenantId: string;
  title: string;
  body: string;
  scheduledAt?: Date;
}

/**
 * Fields that can be updated on an existing content item.
 */
export interface UpdateContentOpts {
  title?: string;
  body?: string;
  scheduledAt?: Date | null;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Creates a new content item with `draft` status.
 *
 * @example
 * ```ts
 * const item = await createContent(db, {
 *   tenantId: 'tenant_abc',
 *   title: 'Launch Post',
 *   body: 'We are live!',
 * });
 * ```
 */
export async function createContent(
  db: FactoryDb,
  opts: CreateContentOpts,
): Promise<ContentItem> {
  if (!opts.tenantId.trim()) throw new ValidationError('tenantId is required');
  if (!opts.title.trim()) throw new ValidationError('title is required');

  const rows = await db.execute(
    sql`
      INSERT INTO content_items (tenant_id, title, body, status, scheduled_at)
      VALUES (
        ${opts.tenantId},
        ${opts.title},
        ${opts.body},
        'draft',
        ${opts.scheduledAt ?? null}
      )
      RETURNING
        id,
        tenant_id,
        title,
        body,
        status,
        scheduled_at,
        published_at,
        created_at,
        updated_at
    `,
  );

  const row = rows.rows[0];
  if (!row) throw new InternalError('createContent returned no rows');
  return rowToItem(row);
}

/**
 * Retrieves a content item by ID and tenant.
 * Returns `null` if not found or does not belong to the tenant.
 */
export async function getContent(
  db: FactoryDb,
  id: string,
  tenantId: string,
): Promise<ContentItem | null> {
  const rows = await db.execute(
    sql`
      SELECT id, tenant_id, title, body, status, scheduled_at, published_at, created_at, updated_at
      FROM content_items
      WHERE id = ${id} AND tenant_id = ${tenantId}
      LIMIT 1
    `,
  );

  const row = rows.rows[0];
  return row ? rowToItem(row) : null;
}

/**
 * Lists all content items for a tenant, newest first.
 *
 * @param statusFilter - Optionally filter by status.
 */
export async function listContent(
  db: FactoryDb,
  tenantId: string,
  statusFilter?: ContentStatus,
): Promise<ContentItem[]> {
  const rows = await db.execute(
    statusFilter
      ? sql`
          SELECT id, tenant_id, title, body, status, scheduled_at, published_at, created_at, updated_at
          FROM content_items
          WHERE tenant_id = ${tenantId} AND status = ${statusFilter}
          ORDER BY created_at DESC
        `
      : sql`
          SELECT id, tenant_id, title, body, status, scheduled_at, published_at, created_at, updated_at
          FROM content_items
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC
        `,
  );

  return rows.rows.map(rowToItem);
}

/**
 * Updates mutable fields on a content item.
 */
export async function updateContent(
  db: FactoryDb,
  id: string,
  tenantId: string,
  opts: UpdateContentOpts,
): Promise<ContentItem> {
  const current = await getContent(db, id, tenantId);
  if (!current) throw new ValidationError(`Content item '${id}' not found`);

  const rows = await db.execute(
    sql`
      UPDATE content_items
      SET
        title       = COALESCE(${opts.title ?? null}, title),
        body        = COALESCE(${opts.body ?? null}, body),
        scheduled_at = CASE
          WHEN ${opts.scheduledAt !== undefined ? 'true' : 'false'} = 'true'
          THEN ${opts.scheduledAt ?? null}
          ELSE scheduled_at
        END,
        updated_at  = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING
        id, tenant_id, title, body, status, scheduled_at, published_at, created_at, updated_at
    `,
  );

  const row = rows.rows[0];
  if (!row) throw new InternalError('updateContent returned no rows');
  return rowToItem(row);
}

/**
 * Transitions a content item to a new status.
 * Enforces the `draft → review → approved → queued → published → archived` state machine.
 *
 * @throws {@link ValidationError} when the transition is not permitted.
 */
export async function updateStatus(
  db: FactoryDb,
  id: string,
  tenantId: string,
  newStatus: ContentStatus,
): Promise<ContentItem> {
  const current = await getContent(db, id, tenantId);
  if (!current) throw new ValidationError(`Content item '${id}' not found`);

  assertValidTransition(current.status, newStatus);

  const publishedAt =
    newStatus === 'published' ? sql`NOW()` : sql`${current.publishedAt ?? null}`;

  const rows = await db.execute(
    sql`
      UPDATE content_items
      SET status       = ${newStatus},
          published_at = ${publishedAt},
          updated_at   = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING
        id, tenant_id, title, body, status, scheduled_at, published_at, created_at, updated_at
    `,
  );

  const row = rows.rows[0];
  if (!row) throw new InternalError('updateStatus returned no rows');
  return rowToItem(row);
}

// ---------------------------------------------------------------------------
// SQL Migration helper
// ---------------------------------------------------------------------------

/**
 * DDL statement to create the `content_items` table.
 * Run this once during initial database provisioning.
 */
export const CREATE_CONTENT_ITEMS_TABLE = `
CREATE TABLE IF NOT EXISTS content_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','review','approved','queued','published','archived')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_items_tenant ON content_items (tenant_id);
`;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type DbRow = Record<string, unknown>;

function rowToItem(row: DbRow): ContentItem {
  return {
    id: String(row['id']),
    tenantId: String(row['tenant_id']),
    title: String(row['title']),
    body: String(row['body']),
    status: row['status'] as ContentStatus,
    scheduledAt: row['scheduled_at'] ? new Date(row['scheduled_at'] as string) : null,
    publishedAt: row['published_at'] ? new Date(row['published_at'] as string) : null,
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
  };
}
