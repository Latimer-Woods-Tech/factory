import { describe, expect, it, vi } from 'vitest';
import {
  checkTCPA,
  logConsent,
  checkFDCPA,
  recordContact,
  suppressPhone,
  CREATE_COMPLIANCE_CONSENTS_TABLE,
  CREATE_COMPLIANCE_CONTACTS_TABLE,
  CREATE_TCPA_SUPPRESSION_TABLE,
} from './index';
import type { FactoryDb } from '@adrper79-dot/neon';

function makeDb(overrides: { rows?: unknown[]; rowCount?: number } = {}): FactoryDb {
  const rows = overrides.rows ?? [];
  const rowCount = overrides.rowCount ?? rows.length;
  return { execute: vi.fn().mockResolvedValue({ rows, rowCount }) } as unknown as FactoryDb;
}

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------
describe('DDL constants', () => {
  it('CREATE_COMPLIANCE_CONSENTS_TABLE references table name', () => {
    expect(CREATE_COMPLIANCE_CONSENTS_TABLE).toContain('compliance_consents');
  });
  it('CREATE_COMPLIANCE_CONTACTS_TABLE references table name', () => {
    expect(CREATE_COMPLIANCE_CONTACTS_TABLE).toContain('compliance_contacts');
  });
  it('CREATE_TCPA_SUPPRESSION_TABLE references table name', () => {
    expect(CREATE_TCPA_SUPPRESSION_TABLE).toContain('compliance_tcpa_suppression');
  });
});

// ---------------------------------------------------------------------------
// checkTCPA
// ---------------------------------------------------------------------------
describe('checkTCPA', () => {
  it('returns safe:true when phone is not suppressed', async () => {
    const db = makeDb({ rows: [] });
    const result = await checkTCPA({ phone: '+15551234567', db });
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns safe:false with reason when phone is suppressed', async () => {
    const db = makeDb({ rows: [{ phone: '+15551234567', reason: 'opted out' }] });
    const result = await checkTCPA({ phone: '+15551234567', db });
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('opted out');
  });

  it('returns safe:false with default reason when reason is null', async () => {
    const db = makeDb({ rows: [{ phone: '+15551234567', reason: null }] });
    const result = await checkTCPA({ phone: '+15551234567', db });
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('Number on TCPA suppression list');
  });

  it('throws when phone is empty', async () => {
    const db = makeDb();
    await expect(checkTCPA({ phone: '', db })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// logConsent
// ---------------------------------------------------------------------------
describe('logConsent', () => {
  it('resolves on success', async () => {
    const db = makeDb();
    await expect(
      logConsent(db, {
        userId: 'user-1',
        consentType: 'TCPA',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
      }),
    ).resolves.toBeUndefined();
  });

  it('passes null userAgent when omitted', async () => {
    const db = makeDb();
    await expect(
      logConsent(db, { userId: 'user-1', consentType: 'GDPR', ipAddress: '1.2.3.4' }),
    ).resolves.toBeUndefined();
  });

  it('throws when required fields are missing', async () => {
    const db = makeDb();
    await expect(
      logConsent(db, { userId: '', consentType: 'TCPA', ipAddress: '1.2.3.4' }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// checkFDCPA
// ---------------------------------------------------------------------------
describe('checkFDCPA', () => {
  it('allows when there is no prior contact', async () => {
    const db = makeDb({ rows: [] });
    const result = await checkFDCPA(db, { contactId: 'contact-1', callType: 'initial' });
    expect(result.allowed).toBe(true);
  });

  it('allows when last contact was >24 hours ago', async () => {
    const old = new Date(Date.now() - 25 * 3_600_000).toISOString();
    const db = makeDb({ rows: [{ contacted_at: old }] });
    const result = await checkFDCPA(db, { contactId: 'contact-1', callType: 'follow_up' });
    expect(result.allowed).toBe(true);
  });

  it('denies when last contact was <24 hours ago', async () => {
    const recent = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const db = makeDb({ rows: [{ contacted_at: recent }] });
    const result = await checkFDCPA(db, { contactId: 'contact-1', callType: 'follow_up' });
    expect(result.allowed).toBe(false);
    expect(result.nextAllowedAt).toBeInstanceOf(Date);
    expect(result.reason).toBeDefined();
  });

  it('provides initial contact reason message', async () => {
    const recent = new Date(Date.now() - 1 * 3_600_000).toISOString();
    const db = makeDb({ rows: [{ contacted_at: recent }] });
    const result = await checkFDCPA(db, { contactId: 'contact-1', callType: 'initial' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('24-hour');
  });

  it('throws when contactId is missing', async () => {
    const db = makeDb();
    await expect(checkFDCPA(db, { contactId: '', callType: 'initial' })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// recordContact
// ---------------------------------------------------------------------------
describe('recordContact', () => {
  it('resolves on success', async () => {
    const db = makeDb();
    await expect(
      recordContact(db, { contactId: 'contact-1', callType: 'initial' }),
    ).resolves.toBeUndefined();
  });

  it('throws when contactId is missing', async () => {
    const db = makeDb();
    await expect(
      recordContact(db, { contactId: '', callType: 'initial' }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// suppressPhone
// ---------------------------------------------------------------------------
describe('suppressPhone', () => {
  it('resolves on success', async () => {
    const db = makeDb();
    await expect(suppressPhone(db, '+15551234567', 'opted out')).resolves.toBeUndefined();
  });

  it('resolves without reason', async () => {
    const db = makeDb();
    await expect(suppressPhone(db, '+15551234567')).resolves.toBeUndefined();
  });

  it('throws when phone is empty', async () => {
    const db = makeDb();
    await expect(suppressPhone(db, '')).rejects.toThrow();
  });
});
