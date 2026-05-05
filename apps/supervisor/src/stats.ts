/**
 * Template quality tracking — §5.9 of ARCHITECTURE.md.
 *
 * Manages the `template_stats` D1 table that drives blessing/demotion
 * decisions for the supervisor's template lifecycle.
 *
 * Blessing threshold:  runs_merged >= 3 AND runs_reverted = 0 AND runs_human_overridden = 0
 * Demotion threshold:  runs_reverted / runs_merged > 0.2 (last 20 runs equivalent)
 */

export interface TemplateStats {
  template_id: string;
  template_version: number;
  runs_attempted: number;
  runs_passed_intent_verification: number;
  runs_merged: number;
  runs_reverted: number;
  runs_human_overridden: number;
  last_run_at: number | null;
  blessed_at: number | null;
  demoted_at: number | null;
}

export type StatsField =
  | 'runs_attempted'
  | 'runs_passed_intent_verification'
  | 'runs_merged'
  | 'runs_reverted'
  | 'runs_human_overridden';

/**
 * Safe whitelist mapping from StatsField to the literal column name.
 * Prevents SQL injection even if type-safety is bypassed at runtime.
 */
const FIELD_COLUMN: Record<StatsField, string> = {
  runs_attempted: 'runs_attempted',
  runs_passed_intent_verification: 'runs_passed_intent_verification',
  runs_merged: 'runs_merged',
  runs_reverted: 'runs_reverted',
  runs_human_overridden: 'runs_human_overridden',
};

/** Ensure a stats row exists; no-op if it already does. */
async function ensureRow(
  db: D1Database,
  templateId: string,
  version: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO template_stats
         (template_id, template_version,
          runs_attempted, runs_passed_intent_verification,
          runs_merged, runs_reverted, runs_human_overridden)
       VALUES (?, ?, 0, 0, 0, 0, 0)`,
    )
    .bind(templateId, version)
    .run()
    .catch((err: unknown) => {
      // Only swallow duplicate-key; re-throw on unexpected errors.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('UNIQUE constraint') && !msg.includes('already exists')) {
        throw err;
      }
    });
}

/**
 * Increment a counter field on the stats row for (templateId, version).
 * If the row does not exist it is created first. After incrementing,
 * blessing and demotion thresholds are evaluated and the row updated.
 */
export async function incrementTemplateStats(
  db: D1Database,
  templateId: string,
  version: number,
  field: StatsField,
): Promise<void> {
  await ensureRow(db, templateId, version);

  const col = FIELD_COLUMN[field];
  const now = Date.now();
  await db
    .prepare(
      // col is sourced from the FIELD_COLUMN whitelist — not user input.
      `UPDATE template_stats
          SET ${col} = ${col} + 1,
              last_run_at = ?
        WHERE template_id = ? AND template_version = ?`,
    )
    .bind(now, templateId, version)
    .run()
    .catch(() => {/* swallow — non-blocking audit */});

  // Re-evaluate blessing / demotion after every counter change.
  await evaluateQuality(db, templateId, version, now);
}

/**
 * Read the current stats row. Returns null if no runs have been recorded yet.
 */
export async function getTemplateStats(
  db: D1Database,
  templateId: string,
  version: number,
): Promise<TemplateStats | null> {
  return db
    .prepare(
      `SELECT * FROM template_stats WHERE template_id = ? AND template_version = ?`,
    )
    .bind(templateId, version)
    .first<TemplateStats>()
    .catch(() => null);
}

/**
 * Returns true iff the template meets the blessing threshold:
 *   runs_merged >= 3 AND runs_reverted = 0 AND runs_human_overridden = 0
 * A demoted template is never considered blessed until re-reviewed.
 */
export async function isTemplateBlessed(
  db: D1Database,
  templateId: string,
  version: number,
): Promise<boolean> {
  const stats = await getTemplateStats(db, templateId, version);
  if (!stats) return false;
  if (stats.demoted_at !== null) return false;
  return (
    stats.runs_merged >= 3 &&
    stats.runs_reverted === 0 &&
    stats.runs_human_overridden === 0
  );
}

/**
 * Evaluate blessing and demotion thresholds and persist any state changes.
 * Called automatically by incrementTemplateStats after every counter change.
 */
async function evaluateQuality(
  db: D1Database,
  templateId: string,
  version: number,
  now: number,
): Promise<void> {
  const stats = await getTemplateStats(db, templateId, version);
  if (!stats) return;

  const shouldBless =
    stats.runs_merged >= 3 &&
    stats.runs_reverted === 0 &&
    stats.runs_human_overridden === 0 &&
    stats.blessed_at === null &&
    stats.demoted_at === null;

  const revertRate =
    stats.runs_merged > 0 ? stats.runs_reverted / stats.runs_merged : 0;
  const shouldDemote =
    revertRate > 0.2 &&
    stats.runs_merged >= 1 &&
    stats.demoted_at === null;

  if (shouldBless) {
    await db
      .prepare(
        `UPDATE template_stats SET blessed_at = ?, demoted_at = NULL
          WHERE template_id = ? AND template_version = ?`,
      )
      .bind(now, templateId, version)
      .run()
      .catch(() => {/* swallow */});
  } else if (shouldDemote) {
    await db
      .prepare(
        `UPDATE template_stats SET demoted_at = ?, blessed_at = NULL
          WHERE template_id = ? AND template_version = ?`,
      )
      .bind(now, templateId, version)
      .run()
      .catch(() => {/* swallow */});
  }
}
