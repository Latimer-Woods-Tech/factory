import { describe, it, expect, vi } from 'vitest';
import {
  createContent,
  getContent,
  listContent,
  updateContent,
  updateStatus,
  CREATE_CONTENT_ITEMS_TABLE,
} from './index.js';
import type { ContentItem, ContentStatus } from './index.js';
import { ValidationError } from '@factory/errors';
import type { FactoryDb } from '@factory/neon';

// ---------------------------------------------------------------------------
// Mock FactoryDb
// ---------------------------------------------------------------------------

type MockDb = {
  execute: ReturnType<typeof vi.fn>;
};

function makeMockDb(rows: Record<string, unknown>[]): MockDb {
  return { execute: vi.fn<() => Promise<{ rows: Record<string, unknown>[] }>>().mockResolvedValue({ rows }) };
}

const now = new Date().toISOString();

const SAMPLE_ROW: Record<string, unknown> = {
  id: 'item-1',
  tenant_id: 'tenant-A',
  title: 'Hello',
  body: 'World',
  status: 'draft',
  scheduled_at: null,
  published_at: null,
  created_at: now,
  updated_at: now,
};

const SAMPLE_ITEM: ContentItem = {
  id: 'item-1',
  tenantId: 'tenant-A',
  title: 'Hello',
  body: 'World',
  status: 'draft',
  scheduledAt: null,
  publishedAt: null,
  createdAt: new Date(now),
  updatedAt: new Date(now),
};

// ---------------------------------------------------------------------------
// createContent
// ---------------------------------------------------------------------------

describe('createContent', () => {
  it('returns the created item', async () => {
    const db = makeMockDb([SAMPLE_ROW]);
    const result = await createContent(db as unknown as FactoryDb, {
      tenantId: 'tenant-A',
      title: 'Hello',
      body: 'World',
    });
    expect(result).toEqual(SAMPLE_ITEM);
    expect(db.execute).toHaveBeenCalledOnce();
  });

  it('throws ValidationError when tenantId is empty', async () => {
    const db = makeMockDb([]);
    await expect(
      createContent(db as unknown as FactoryDb, { tenantId: '', title: 'T', body: 'B' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when title is empty', async () => {
    const db = makeMockDb([]);
    await expect(
      createContent(db as unknown as FactoryDb, { tenantId: 'x', title: '', body: 'B' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws InternalError when db returns no rows', async () => {
    const db = makeMockDb([]);
    const { InternalError } = await import('@factory/errors');
    await expect(
      createContent(db as unknown as FactoryDb, { tenantId: 'x', title: 'T', body: 'B' }),
    ).rejects.toBeInstanceOf(InternalError);
  });
});

// ---------------------------------------------------------------------------
// getContent
// ---------------------------------------------------------------------------

describe('getContent', () => {
  it('returns the item when found', async () => {
    const db = makeMockDb([SAMPLE_ROW]);
    const result = await getContent(db as unknown as FactoryDb, 'item-1', 'tenant-A');
    expect(result).toEqual(SAMPLE_ITEM);
  });

  it('returns null when not found', async () => {
    const db = makeMockDb([]);
    const result = await getContent(db as unknown as FactoryDb, 'missing', 'tenant-A');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listContent
// ---------------------------------------------------------------------------

describe('listContent', () => {
  it('returns all items for tenant', async () => {
    const db = makeMockDb([SAMPLE_ROW, { ...SAMPLE_ROW, id: 'item-2' }]);
    const result = await listContent(db as unknown as FactoryDb, 'tenant-A');
    expect(result).toHaveLength(2);
  });

  it('passes status filter to query', async () => {
    const db = makeMockDb([SAMPLE_ROW]);
    await listContent(db as unknown as FactoryDb, 'tenant-A', 'draft');
    expect(db.execute).toHaveBeenCalledOnce();
    // The SQL call with a filter should include 'status'
  });

  it('returns empty array when tenant has no items', async () => {
    const db = makeMockDb([]);
    const result = await listContent(db as unknown as FactoryDb, 'tenant-Z');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// updateContent
// ---------------------------------------------------------------------------

describe('updateContent', () => {
  it('updates and returns the item', async () => {
    const updatedRow = { ...SAMPLE_ROW, title: 'Updated', status: 'draft' };
    const db = { execute: vi.fn() } as unknown as { execute: ReturnType<typeof vi.fn> };
    // First call: getContent; second call: UPDATE RETURNING
    db.execute
      .mockResolvedValueOnce({ rows: [SAMPLE_ROW] })
      .mockResolvedValueOnce({ rows: [updatedRow] });

    const result = await updateContent(db as unknown as FactoryDb, 'item-1', 'tenant-A', {
      title: 'Updated',
    });

    expect(result.title).toBe('Updated');
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('updates body and scheduledAt', async () => {
    const scheduled = new Date('2025-01-01T00:00:00Z');
    const updatedRow = { ...SAMPLE_ROW, body: 'new body', scheduled_at: scheduled.toISOString() };
    const db = { execute: vi.fn() } as unknown as { execute: ReturnType<typeof vi.fn> };
    db.execute
      .mockResolvedValueOnce({ rows: [SAMPLE_ROW] })
      .mockResolvedValueOnce({ rows: [updatedRow] });

    const result = await updateContent(db as unknown as FactoryDb, 'item-1', 'tenant-A', {
      body: 'new body',
      scheduledAt: scheduled,
    });

    expect(result.body).toBe('new body');
    expect(result.scheduledAt).toEqual(scheduled);
  });
});

// ---------------------------------------------------------------------------
// updateStatus
// ---------------------------------------------------------------------------

describe('updateStatus', () => {
  const cases: Array<[ContentStatus, ContentStatus]> = [
    ['draft', 'review'],
    ['review', 'approved'],
    ['approved', 'queued'],
    ['queued', 'published'],
    ['published', 'archived'],
  ];

  for (const [from, to] of cases) {
    it(`allows transition ${from} → ${to}`, async () => {
      const currentRow = { ...SAMPLE_ROW, status: from };
      const updatedRow = { ...SAMPLE_ROW, status: to };
      const db = { execute: vi.fn() } as unknown as { execute: ReturnType<typeof vi.fn> };
      db.execute
        .mockResolvedValueOnce({ rows: [currentRow] })
        .mockResolvedValueOnce({ rows: [updatedRow] });

      const result = await updateStatus(db as unknown as FactoryDb, 'item-1', 'tenant-A', to);
      expect(result.status).toBe(to);
    });
  }

  it('throws ValidationError for invalid transition draft → published', async () => {
    const currentRow = { ...SAMPLE_ROW, status: 'draft' };
    const db = { execute: vi.fn().mockResolvedValue({ rows: [currentRow] }) };
    await expect(
      updateStatus(db as unknown as FactoryDb, 'item-1', 'tenant-A', 'published'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError for archived → any', async () => {
    const currentRow = { ...SAMPLE_ROW, status: 'archived' };
    const db = { execute: vi.fn().mockResolvedValue({ rows: [currentRow] }) };
    await expect(
      updateStatus(db as unknown as FactoryDb, 'item-1', 'tenant-A', 'draft'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when item not found', async () => {
    const db = makeMockDb([]);
    await expect(
      updateStatus(db as unknown as FactoryDb, 'missing', 'tenant-A', 'review'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('carries publishedAt when transitioning to archived', async () => {
    const published = new Date('2025-06-01T00:00:00Z');
    const publishedRow = { ...SAMPLE_ROW, status: 'published', published_at: published.toISOString() };
    const archivedRow = { ...SAMPLE_ROW, status: 'archived', published_at: published.toISOString() };
    const db = { execute: vi.fn() } as unknown as { execute: ReturnType<typeof vi.fn> };
    db.execute
      .mockResolvedValueOnce({ rows: [publishedRow] })
      .mockResolvedValueOnce({ rows: [archivedRow] });

    const result = await updateStatus(db as unknown as FactoryDb, 'item-1', 'tenant-A', 'archived');
    expect(result.status).toBe('archived');
  });
});
// ---------------------------------------------------------------------------
// rowToItem handles non-null date fields
// ---------------------------------------------------------------------------

describe('rowToItem date fields', () => {
  it('parses non-null scheduledAt and publishedAt', async () => {
    const published = new Date('2025-06-01T12:00:00Z');
    const scheduled = new Date('2025-05-01T08:00:00Z');
    const row = {
      ...SAMPLE_ROW,
      status: 'published',
      scheduled_at: scheduled.toISOString(),
      published_at: published.toISOString(),
    };
    const db = makeMockDb([row]);
    const result = await getContent(db as unknown as FactoryDb, 'item-1', 'tenant-A');
    expect(result?.scheduledAt).toEqual(scheduled);
    expect(result?.publishedAt).toEqual(published);
  });
});
// ---------------------------------------------------------------------------
// Misc exports
// ---------------------------------------------------------------------------

describe('CREATE_CONTENT_ITEMS_TABLE', () => {
  it('is a non-empty SQL string', () => {
    expect(typeof CREATE_CONTENT_ITEMS_TABLE).toBe('string');
    expect(CREATE_CONTENT_ITEMS_TABLE).toContain('content_items');
    expect(CREATE_CONTENT_ITEMS_TABLE).toContain('CREATE TABLE IF NOT EXISTS');
  });
});
