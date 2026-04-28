import { describe, it, expect } from 'vitest';
import { toAuditEntry, fromAuditEntry, type AuditRow } from './audit.js';
import type { AuditEntry } from './audit.js';

const sampleRow: AuditRow = {
  id: '00000000-0000-0000-0000-000000000001',
  occurred_at: '2026-04-28T12:00:00.000Z',
  user_id: 'u1',
  user_email: 'a@b.co',
  user_role: 'admin',
  session_id: 's1',
  env: 'staging',
  action: 'POST /deploys',
  resource: 'wordis-bond',
  resource_id: null,
  reversibility: 'manual-rollback',
  payload: { branch: 'main' },
  result: 'success',
  result_detail: { status: 200 },
  ip_address: '1.2.3.4',
  user_agent: 'curl/8',
  request_id: 'req-1',
};

describe('audit row mapping', () => {
  it('toAuditEntry converts snake_case to camelCase and drops null', () => {
    const entry = toAuditEntry(sampleRow);
    expect(entry.id).toBe(sampleRow.id);
    expect(entry.occurredAt).toBe(sampleRow.occurred_at);
    expect(entry.userEmail).toBe('a@b.co');
    expect(entry.resource).toBe('wordis-bond');
    expect(entry.resourceId).toBeUndefined();
    expect(entry.resultDetail).toEqual({ status: 200 });
  });

  it('fromAuditEntry returns positional values matching column order', () => {
    const entry: AuditEntry = toAuditEntry(sampleRow);
    const values = fromAuditEntry(entry);
    expect(values[0]).toBe(entry.id);
    expect(values[1]).toBe(entry.occurredAt);
    expect(values[6]).toBe('staging');
    expect(values[7]).toBe('POST /deploys');
    expect(values[9]).toBeNull(); // resourceId was null
    expect(values[10]).toBe('manual-rollback');
    expect(typeof values[11]).toBe('string'); // payload JSON
    expect(JSON.parse(values[11] as string)).toEqual({ branch: 'main' });
  });

  it('fromAuditEntry stringifies missing payload as {}', () => {
    const entry: AuditEntry = { ...toAuditEntry(sampleRow), payload: {}, resultDetail: undefined };
    const values = fromAuditEntry(entry);
    expect(values[11]).toBe('{}');
    expect(values[13]).toBeNull();
  });
});
