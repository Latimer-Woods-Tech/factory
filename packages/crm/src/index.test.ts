import { describe, expect, it, vi } from 'vitest';
import {
  trackLead,
  trackConversion,
  getCustomerView,
  CREATE_CRM_LEADS_TABLE,
} from './index';
import type { FactoryDb } from '@adrper79-dot/neon';
import type { Analytics } from '@adrper79-dot/analytics';

// ---------------------------------------------------------------------------
// Mock DB factory
// ---------------------------------------------------------------------------
function makeDb(overrides: Partial<{ rows: unknown[]; rowCount: number }> = {}): FactoryDb {
  const rows = overrides.rows ?? [];
  const rowCount = overrides.rowCount ?? rows.length;
  return {
    execute: vi.fn().mockResolvedValue({ rows, rowCount }),
  } as unknown as FactoryDb;
}

const BASE_LEAD_ROW = {
  id: 'lead-uuid',
  user_id: 'user-1',
  app_id: 'app-1',
  source: 'organic',
  status: 'lead',
  mrr: 0,
  created_at: '2026-01-01T00:00:00Z',
  converted_at: null,
};

describe('CREATE_CRM_LEADS_TABLE', () => {
  it('contains the table name', () => {
    expect(CREATE_CRM_LEADS_TABLE).toContain('crm_leads');
  });
});

describe('trackLead', () => {
  it('returns a Lead on success', async () => {
    const db = makeDb({ rows: [BASE_LEAD_ROW] });
    const lead = await trackLead(db, { userId: 'user-1', appId: 'app-1', source: 'organic' });
    expect(lead.userId).toBe('user-1');
    expect(lead.appId).toBe('app-1');
    expect(lead.source).toBe('organic');
    expect(lead.status).toBe('lead');
    expect(lead.mrr).toBe(0);
    expect(lead.createdAt).toBeInstanceOf(Date);
    expect(lead.convertedAt).toBeUndefined();
  });

  it('maps convertedAt when non-null', async () => {
    const row = { ...BASE_LEAD_ROW, converted_at: '2026-03-01T00:00:00Z' };
    const db = makeDb({ rows: [row] });
    const lead = await trackLead(db, { userId: 'user-1', appId: 'app-1', source: 'tiktok' });
    expect(lead.convertedAt).toBeInstanceOf(Date);
  });

  it('throws when required fields are missing', async () => {
    const db = makeDb({ rows: [] });
    await expect(trackLead(db, { userId: '', appId: 'app-1', source: 'x' })).rejects.toThrow();
  });

  it('throws when no row is returned', async () => {
    const db = makeDb({ rows: [] });
    await expect(trackLead(db, { userId: 'u', appId: 'a', source: 's' })).rejects.toThrow();
  });
});

describe('trackConversion', () => {
  it('resolves on success', async () => {
    const db = makeDb({ rows: [], rowCount: 1 });
    await expect(
      trackConversion(db, { userId: 'user-1', plan: 'pro', mrr: 2900 }),
    ).resolves.toBeUndefined();
  });

  it('calls analytics.businessEvent when analytics provided', async () => {
    const db = makeDb({ rows: [], rowCount: 1 });
    const businessEvent = vi.fn().mockResolvedValue(undefined);
    const analytics = { businessEvent } as unknown as Analytics;
    await trackConversion(db, { userId: 'user-1', plan: 'pro', mrr: 2900 }, analytics);
    expect(businessEvent).toHaveBeenCalledWith(
      'subscription.converted',
      { plan: 'pro', mrr: 2900 },
      'user-1',
    );
  });

  it('throws on negative mrr', async () => {
    const db = makeDb({ rows: [], rowCount: 1 });
    await expect(
      trackConversion(db, { userId: 'u', plan: 'pro', mrr: -1 }),
    ).rejects.toThrow();
  });

  it('throws when no lead found (rowCount 0)', async () => {
    const db = makeDb({ rows: [], rowCount: 0 });
    await expect(
      trackConversion(db, { userId: 'missing', plan: 'pro', mrr: 0 }),
    ).rejects.toThrow();
  });

  it('throws when userId or plan are missing', async () => {
    const db = makeDb({ rows: [], rowCount: 0 });
    await expect(
      trackConversion(db, { userId: '', plan: 'pro', mrr: 0 }),
    ).rejects.toThrow();
  });
});

describe('getCustomerView', () => {
  it('returns low churnRisk for active lead with recent events', async () => {
    const recentDate = new Date(Date.now() - 1 * 86_400_000).toISOString();
    const leadRow = { ...BASE_LEAD_ROW, status: 'active', mrr: 2900 };
    const db = {
      execute: vi.fn()
        .mockResolvedValueOnce({ rows: [leadRow] })                        // lead
        .mockResolvedValueOnce({ rows: [{ plan: 'pro', mrr: 2900, status: 'active' }] }) // subs
        .mockResolvedValueOnce({                                            // events
          rows: [{ event: 'page.view', properties: '{}', occurred_at: recentDate }],
        }),
    } as unknown as FactoryDb;

    const view = await getCustomerView(db, 'user-1');
    expect(view.lead.userId).toBe('user-1');
    expect(view.subscriptions).toHaveLength(1);
    expect(view.events).toHaveLength(1);
    expect(view.churnRisk).toBe('low');
  });

  it('returns high churnRisk for churned lead', async () => {
    const churnedRow = { ...BASE_LEAD_ROW, status: 'churned', mrr: 0 };
    const db = {
      execute: vi.fn()
        .mockResolvedValueOnce({ rows: [churnedRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    } as unknown as FactoryDb;

    const view = await getCustomerView(db, 'user-1');
    expect(view.churnRisk).toBe('high');
  });

  it('returns medium churnRisk for lead with mrr=0 and no events', async () => {
    const db = {
      execute: vi.fn()
        .mockResolvedValueOnce({ rows: [BASE_LEAD_ROW] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    } as unknown as FactoryDb;

    const view = await getCustomerView(db, 'user-1');
    expect(view.churnRisk).toBe('medium');
  });

  it('returns medium churnRisk when last event was >30 days ago', async () => {
    const oldDate = new Date(Date.now() - 40 * 86_400_000).toISOString();
    const activeRow = { ...BASE_LEAD_ROW, status: 'active', mrr: 2900 };
    const db = {
      execute: vi.fn()
        .mockResolvedValueOnce({ rows: [activeRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ event: 'page.view', properties: '{}', occurred_at: oldDate }],
        }),
    } as unknown as FactoryDb;

    const view = await getCustomerView(db, 'user-1');
    expect(view.churnRisk).toBe('medium');
  });

  it('handles missing optional tables gracefully', async () => {
    const db = {
      execute: vi.fn()
        .mockResolvedValueOnce({ rows: [BASE_LEAD_ROW] })
        .mockRejectedValueOnce(new Error('relation does not exist'))
        .mockRejectedValueOnce(new Error('relation does not exist')),
    } as unknown as FactoryDb;

    const view = await getCustomerView(db, 'user-1');
    expect(view.subscriptions).toEqual([]);
    expect(view.events).toEqual([]);
  });

  it('throws when userId is empty', async () => {
    const db = makeDb({ rows: [] });
    await expect(getCustomerView(db, '')).rejects.toThrow();
  });

  it('throws when no lead row found', async () => {
    const db = makeDb({ rows: [] });
    await expect(getCustomerView(db, 'user-x')).rejects.toThrow();
  });

  it('parses JSON properties when stored as string', async () => {
    const recentDate = new Date(Date.now() - 1 * 86_400_000).toISOString();
    const activeRow = { ...BASE_LEAD_ROW, status: 'active', mrr: 2900 };
    const db = {
      execute: vi.fn()
        .mockResolvedValueOnce({ rows: [activeRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ event: 'page.view', properties: '{"button":"cta"}', occurred_at: recentDate }],
        }),
    } as unknown as FactoryDb;
    const view = await getCustomerView(db, 'user-1');
    expect(view.events[0]?.properties).toEqual({ button: 'cta' });
  });
});
