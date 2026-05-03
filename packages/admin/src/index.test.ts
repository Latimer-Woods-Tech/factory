import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createAdminRouter } from './index';
import type { FactoryDb } from '@latimer-woods-tech/neon';
import type { Analytics } from '@latimer-woods-tech/analytics';

// ---- helpers ---------------------------------------------------------------
const SECRET = 'test-secret-longer-than-32-chars-please';

function b64url(buf: Uint8Array | string): string {
  const bytes = typeof buf === 'string' ? new TextEncoder().encode(buf) : buf;
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mintHs256(payload: Record<string, unknown>, secret = SECRET): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(sig)}`;
}

describe('verifyJwt', () => {
  it('verifies a valid HS256 token', async () => {
    const tok = await mintHs256({ sub: 'alice', scope: 'admin:read', exp: Math.floor(Date.now() / 1000) + 60 });
    const p = await verifyJwt(tok, { secret: SECRET });
    expect(p.sub).toBe('alice');
  });

  it('rejects expired tokens', async () => {
    const tok = await mintHs256({ sub: 'alice', exp: Math.floor(Date.now() / 1000) - 10 });
    await expect(verifyJwt(tok, { secret: SECRET })).rejects.toThrow(/expired/);
  });

  it('rejects bad signature', async () => {
    const tok = await mintHs256({ sub: 'alice' });
    await expect(verifyJwt(tok, { secret: 'wrong-secret' })).rejects.toThrow(/bad signature/);
  });

  it('rejects malformed token', async () => {
    await expect(verifyJwt('not.a.jwt.too.many', { secret: SECRET })).rejects.toThrow(/malformed/);
  });

  it('rejects non-HS256 alg', async () => {
    const h = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const p = b64url(JSON.stringify({ sub: 'a' }));
    await expect(verifyJwt(`${h}.${p}.`, { secret: SECRET })).rejects.toThrow(/unsupported alg/);
  });

  it('enforces audience when requested', async () => {
    const tok = await mintHs256({ sub: 'a', aud: 'other-app' });
    await expect(verifyJwt(tok, { secret: SECRET, audience: 'my-app' })).rejects.toThrow(/audience/);
  });

  it('enforces issuer when requested', async () => {
    const tok = await mintHs256({ sub: 'a', iss: 'other' });
    await expect(verifyJwt(tok, { secret: SECRET, issuer: 'mine' })).rejects.toThrow(/issuer/);
  });
});

describe('scopeMatches', () => {
  it('matches exact scope', () => {
    expect(scopeMatches({ scope: 'admin:read users:list' }, 'admin:read')).toBe(true);
  });
  it('matches wildcard namespace', () => {
    expect(scopeMatches({ scope: 'admin:*' }, 'admin:write')).toBe(true);
  });
  it('matches root wildcard', () => {
    expect(scopeMatches({ scope: '*' }, 'admin:anything')).toBe(true);
  });
  it('handles array form', () => {
    expect(scopeMatches({ scopes: ['admin:read'] } as JwtPayload, 'admin:read')).toBe(true);
  });
  it('denies missing', () => {
    expect(scopeMatches({ scope: 'users:read' }, 'admin:write')).toBe(false);
  });
});

describe('validateSlots', () => {
  it('validates strings with regex', async () => {
    await expect(validateSlots({ id: { type: 'string', regex: '^u_' } }, { id: 'u_123' })).resolves.toBeUndefined();
    await expect(validateSlots({ id: { type: 'string', regex: '^u_' } }, { id: 'bad' })).rejects.toThrow(/regex/);
  });
  it('validates numbers with bounds', async () => {
    await expect(validateSlots({ n: { type: 'number', min: 1, max: 10 } }, { n: 5 })).resolves.toBeUndefined();
    await expect(validateSlots({ n: { type: 'number', min: 1 } }, { n: 0 })).rejects.toThrow(/below min/);
    await expect(validateSlots({ n: { type: 'number', integer: true } }, { n: 1.5 })).rejects.toThrow(/integer/);
  });
  it('validates enums', async () => {
    await expect(validateSlots({ s: { type: 'enum', values: ['a','b'] } }, { s: 'a' })).resolves.toBeUndefined();
    await expect(validateSlots({ s: { type: 'enum', values: ['a','b'] } }, { s: 'c' })).rejects.toThrow(/enum/);
  });
  it('validates booleans', async () => {
    await expect(validateSlots({ b: { type: 'boolean' } }, { b: true })).resolves.toBeUndefined();
    await expect(validateSlots({ b: { type: 'boolean' } }, { b: 'yes' })).rejects.toThrow(/boolean/);
  });
  it('referential_check via async callback', async () => {
    const check = vi.fn((v: string) => Promise.resolve(v === 'known'));
    await expect(validateSlots({ r: { type: 'referential', check, kind: 'user' } }, { r: 'known' })).resolves.toBeUndefined();
    await expect(validateSlots({ r: { type: 'referential', check, kind: 'user' } }, { r: 'unknown' })).rejects.toThrow(/not found/);
  });
  it('throws on missing slot', async () => {
    await expect(validateSlots({ x: { type: 'string' } }, {})).rejects.toThrow(/missing slot/);
  });
});

describe('createCapabilityMiddleware', () => {
  function makeAudit(): { sink: AuditSink; records: AuditRecord[] } {
    const records: AuditRecord[] = [];
    return { sink: { write: (r) => { records.push(r); } }, records };
  }

  const cap: RouteCapability = {
    route: 'POST /admin/users/:id/suspend',
    side_effects: 'write-app',
    required_scope: 'admin:write',
    slots: {
      id: { type: 'string', regex: '^u_' },
      reason: { type: 'enum', values: ['spam','fraud','other'] },
    },
    extra_guard: 'requires_codeowner_approval',
  };

  async function request(app: Hono, path: string, init: RequestInit): Promise<Response> {
    return app.request(`http://test${path}`, init);
  }

  it('allows when token + scope + slots + approval all pass', async () => {
    const audit = makeAudit();
    const tok = await mintHs256({ sub: 'admin', scope: 'admin:write', exp: Math.floor(Date.now()/1000) + 60 });
    const app = new Hono();
    app.post('/admin/users/:id/suspend', createCapabilityMiddleware({
      capability: cap, jwt: { secret: SECRET }, audit: audit.sink,
      checkCodeownerApproval: () => Promise.resolve({ approved: true }),
    }), (c) => c.json({ ok: true }));
    const r = await request(app, '/admin/users/u_123/suspend', {
      method: 'POST',
      headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'spam' }),
    });
    expect(r.status).toBe(200);
    expect(audit.records[0]!.status).toBe('allowed');
    expect(audit.records[0]!.slots).toMatchObject({ id: 'u_123', reason: 'spam' });
  });

  it('denies when scope is missing', async () => {
    const audit = makeAudit();
    const tok = await mintHs256({ sub: 'reader', scope: 'admin:read' });
    const app = new Hono();
    app.post('/admin/users/:id/suspend', createCapabilityMiddleware({
      capability: cap, jwt: { secret: SECRET }, audit: audit.sink,
      checkCodeownerApproval: () => Promise.resolve({ approved: true }),
    }), (c) => c.json({ ok: true }));
    app.onError((err, c) => c.json({ error: err.message }, 'status' in err ? ((err as { status: number }).status as 403) : 500));
    const r = await request(app, '/admin/users/u_1/suspend', {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'spam' }),
    });
    expect(r.status).toBe(403);
    expect(audit.records[0]!.status).toBe('denied');
  });

  it('denies when codeowner approval rejected', async () => {
    const audit = makeAudit();
    const tok = await mintHs256({ sub: 'bot', scope: 'admin:write' });
    const app = new Hono();
    app.post('/admin/users/:id/suspend', createCapabilityMiddleware({
      capability: cap, jwt: { secret: SECRET }, audit: audit.sink,
      checkCodeownerApproval: () => Promise.resolve({ approved: false, reason: 'agent, not codeowner' }),
    }), (c) => c.json({ ok: true }));
    app.onError((err, c) => c.json({ error: err.message }, 403));
    const r = await request(app, '/admin/users/u_1/suspend', {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'spam' }),
    });
    expect(r.status).toBe(403);
    expect(audit.records[0]!.reason).toContain('codeowner');
  });

  it('denies when slot validation fails', async () => {
    const audit = makeAudit();
    const tok = await mintHs256({ sub: 'admin', scope: 'admin:write' });
    const app = new Hono();
    app.post('/admin/users/:id/suspend', createCapabilityMiddleware({
      capability: cap, jwt: { secret: SECRET }, audit: audit.sink,
      checkCodeownerApproval: () => Promise.resolve({ approved: true }),
    }), (c) => c.json({ ok: true }));
    app.onError((err, c) => c.json({ error: err.message }, 422));
    const r = await request(app, '/admin/users/bad-id/suspend', {
      method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'spam' }),
    });
    expect(r.status).toBe(422);
    expect(audit.records[0]!.reason).toMatch(/regex/);
  });

  it('denies when bearer token missing', async () => {
    const audit = makeAudit();
    const app = new Hono();
    app.post('/admin/users/:id/suspend', createCapabilityMiddleware({
      capability: cap, jwt: { secret: SECRET }, audit: audit.sink,
    }), (c) => c.json({ ok: true }));
    app.onError((err, c) => c.json({ error: err.message }, 401));
    const r = await request(app, '/admin/users/u_1/suspend', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'spam' }),
    });
    expect(r.status).toBe(401);
    expect(audit.records[0]!.status).toBe('denied');
  });
});
