/**
 * D1-backed supervisor memory (default per D3/O2 resolution).
 *
 * Schema (applied via separate migration file once D2 O2 decision lands
 * and we provision the D1 binding):
 *
 *   CREATE TABLE memory (
 *     key TEXT PRIMARY KEY,
 *     value TEXT NOT NULL,
 *     updated_at INTEGER NOT NULL
 *   );
 */

interface MemoryRow {
  key: string;
  value: string;
  updated_at: number;
}

export async function readMemory<T = unknown>(
  db: D1Database,
  key: string,
): Promise<T | null> {
  const row = await db
    .prepare('SELECT value FROM memory WHERE key = ?')
    .bind(key)
    .first<{ value: string }>()
    .catch(() => null);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function writeMemory(
  db: D1Database,
  key: string,
  value: unknown,
): Promise<void> {
  const v = JSON.stringify(value);
  await db
    .prepare(
      `INSERT INTO memory (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, v, Date.now())
    .run()
    .catch(() => {
      /* swallow — memory writes never block the request */
    });
}

export async function listMemoryKeys(db: D1Database, prefix: string): Promise<string[]> {
  const res = await db
    .prepare('SELECT key FROM memory WHERE key LIKE ? ORDER BY updated_at DESC LIMIT 100')
    .bind(`${prefix}%`)
    .all<MemoryRow>()
    .catch(() => ({ results: [] as MemoryRow[] }));
  return res.results.map((r) => r.key);
}
