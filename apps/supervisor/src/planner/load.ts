/**
 * Template loader. Phase 1: loads from a statically-imported array seeded
 * with all templates shipped via SUP-3.3 + SUP-4
 * (`docs/supervisor/plans/*.yml`).
 *
 * Phase 2 (SUP-3.5): loads from a KV binding populated by a build step that
 * parses YAML at deploy time, so templates can be edited without a redeploy.
 */

export interface Template {
  id: string;
  version?: number;
  tier: 'green' | 'yellow' | 'red';
  description: string;
  trigger_keywords?: string[];
  steps?: Array<{
    tool: string;
    slots?: Record<string, string>;
    side_effects?: 'none' | 'read-external' | 'write-app' | 'write-external';
  }>;
}

// Phase 1 seed — mirrors all templates in `docs/supervisor/plans/*.yml`.
// Keywords are derived from each template's title_pattern and label triggers
// and used by the Phase-1 keyword matcher in planner/match.ts.
// Phase 2 (SUP-3.5) replaces this array with a YAML-parsed KV load.
const SEED: Template[] = [
  // ── Green tier ──────────────────────────────────────────────────────────
  {
    id: 'docs-naming-convention',
    tier: 'green',
    description: 'Docs-only PR adding or updating a naming-convention document',
    trigger_keywords: ['docs', 'naming', 'convention', 'document', 'markdown'],
  },
  {
    id: 'deps-bump-minor-patch',
    tier: 'green',
    description: 'Dependabot/Renovate minor or patch dependency bump; auto-merge on green CI',
    trigger_keywords: ['bump', 'deps', 'dependency', 'dependabot', 'renovate', 'patch', 'minor'],
  },
  {
    id: 'docs-runbook-update',
    tier: 'green',
    description: 'Add or update a runbook document under docs/runbooks/',
    trigger_keywords: ['runbook', 'docs', 'document', 'procedure', 'playbook'],
  },
  // ── Yellow tier ─────────────────────────────────────────────────────────
  {
    id: 'db-migration-gap-fix',
    tier: 'yellow',
    description: 'DatabaseError "column does not exist" — posts a psql apply-runbook comment',
    trigger_keywords: ['migration', 'column', 'database', 'schema', 'sentry', 'does not exist'],
  },
  {
    id: 'sentry-triage-new-issue',
    tier: 'yellow',
    description: 'Investigate a new Sentry error class and optionally propose a small-patch PR',
    trigger_keywords: ['sentry', 'error', 'triage', 'investigation', 'exception'],
  },
  {
    id: 'wrangler-config-drift-fix',
    tier: 'yellow',
    description: 'Stale wrangler.jsonc binding — validates against Cloudflare, opens fix PR',
    trigger_keywords: ['wrangler', 'binding', 'hyperdrive', 'drift', 'cloudflare', 'config'],
  },
  {
    id: 'reusable-workflow-rollout',
    tier: 'yellow',
    description: 'Replace bespoke app workflow with a thin factory reusable caller',
    trigger_keywords: ['workflow', 'reusable', 'caller', 'deploy', 'ci', '_app-ci', '_app-deploy'],
  },
  {
    id: 'syn-package-migration',
    tier: 'yellow',
    description: 'SYN-series package migration — triage checklist + human approval',
    trigger_keywords: ['package', 'migration', 'syn', 'extract', 'workspace', 'composite'],
  },
  {
    id: 'package-version-migration',
    tier: 'yellow',
    description: 'Migrate a worker/app to consume a @latimer-woods-tech/* package',
    trigger_keywords: ['package', 'consume', 'migrate', 'inline', 'latimer-woods-tech'],
  },
  {
    id: 'ux-regression-triage',
    tier: 'yellow',
    description: 'UX regression — posts a structured triage plan comment',
    trigger_keywords: ['ux', 'regression', 'accessibility', 'a11y', 'viewport', 'mobile'],
  },
  {
    id: 'testing-skill-adoption',
    tier: 'yellow',
    description: 'Add the skills/global/testing composite action to an app CI workflow',
    trigger_keywords: ['testing', 'skill', 'vitest', 'playwright', 'composite', 'adopt'],
  },
];

export async function loadTemplates(): Promise<Template[]> {
  // Phase 1: return seed. Phase 2: fetch from KV / D1.
  return Promise.resolve(SEED);
}
