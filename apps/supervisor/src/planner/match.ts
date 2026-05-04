import type { Template } from './load';

/**
 * Deterministic template matcher. Scores each template against a user
 * description, returns the best match above the threshold, or null.
 *
 * Phase 1 (SUP-3.4 scaffold): simple keyword-hit scoring. Replace with
 * embedding similarity once `@latimer-woods-tech/llm` supports embeddings
 * (0.4.x).
 */
export interface MatchScore {
  template: Template;
  score: number;
  matchedKeywords: string[];
}

const MIN_SCORE = 0.35;

export function matchTemplate(
  description: string,
  templates: Template[],
): Template | null {
  const normalized = description.toLowerCase();
  const scores: MatchScore[] = [];

  for (const t of templates) {
    const keywords = t.trigger_keywords ?? [];
    if (keywords.length === 0) continue;
    const hits = keywords.filter((k) => normalized.includes(k.toLowerCase()));
    const score = hits.length / keywords.length;
    if (score >= MIN_SCORE) {
      scores.push({ template: t, score, matchedKeywords: hits });
    }
  }

  if (scores.length === 0) return null;
  scores.sort((a, b) => {
    // Primary: highest score
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: lower tier (green before yellow before red) — safer default
    const tierOrder = { green: 0, yellow: 1, red: 2 } as const;
    return (tierOrder[a.template.tier] ?? 99) - (tierOrder[b.template.tier] ?? 99);
  });
  return scores[0]!.template;
}
