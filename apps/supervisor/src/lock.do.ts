/**
 * LockDO — single-writer lock primitive per D3 decision.
 *
 * Callers acquire a named lock before mutations; the DO serializes them so
 * two concurrent supervisor runs can't collide on the same resource.
 *
 * Phase 1 (SUP-3.4 scaffold): in-memory map. No durable persistence yet —
 * fine for single-DO use since state lives in the DO instance. D1 audit log
 * of lock acquisitions follows in SUP-3.5.
 */
export class LockDO {
  private locks = new Map<string, { holder: string; acquiredAt: number; ttl: number }>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'POST' && url.pathname === '/acquire') {
      const { key, holder, ttlMs = 60_000 } = (await request.json()) as {
        key: string; holder: string; ttlMs?: number;
      };
      const now = Date.now();
      const existing = this.locks.get(key);
      if (existing && existing.acquiredAt + existing.ttl > now) {
        return Response.json({ acquired: false, heldBy: existing.holder }, { status: 409 });
      }
      this.locks.set(key, { holder, acquiredAt: now, ttl: ttlMs });
      return Response.json({ acquired: true, key, holder, ttlMs });
    }

    if (method === 'POST' && url.pathname === '/release') {
      const { key, holder } = (await request.json()) as { key: string; holder: string };
      const existing = this.locks.get(key);
      if (!existing) return Response.json({ released: true, note: 'not held' });
      if (existing.holder !== holder) {
        return Response.json({ released: false, heldBy: existing.holder }, { status: 409 });
      }
      this.locks.delete(key);
      return Response.json({ released: true });
    }

    if (method === 'GET' && url.pathname === '/status') {
      const now = Date.now();
      const active: Array<{ key: string; holder: string; expiresInMs: number }> = [];
      for (const [key, v] of this.locks) {
        if (v.acquiredAt + v.ttl > now) {
          active.push({ key, holder: v.holder, expiresInMs: v.acquiredAt + v.ttl - now });
        }
      }
      return Response.json({ active });
    }

    return new Response('not found', { status: 404 });
  }
}
