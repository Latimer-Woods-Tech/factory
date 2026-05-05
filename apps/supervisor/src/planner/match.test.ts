import { describe, it, expect } from 'vitest';
import { matchTemplate } from './match.js';
import { loadTemplates } from './load.js';
import type { Template } from './load.js';

const TEMPLATES: Template[] = [
  {
    id: 'health-check',
    tier: 'green',
    description: 'Ping health endpoints',
    trigger_keywords: ['health', 'ping', 'status', 'check'],
  },
  {
    id: 'deploy',
    tier: 'red',
    description: 'Deploy to prod',
    trigger_keywords: ['deploy', 'ship', 'release'],
  },
  {
    id: 'empty',
    tier: 'green',
    description: 'no keywords',
    trigger_keywords: [],
  },
];

describe('matchTemplate', () => {
  it('matches when keywords hit', () => {
    const m = matchTemplate('check the health of the api', TEMPLATES);
    expect(m?.id).toBe('health-check');
  });

  it('returns null when below threshold', () => {
    const m = matchTemplate('something completely unrelated', TEMPLATES);
    expect(m).toBeNull();
  });

  it('prefers green over red on ties', () => {
    const bothMatch: Template[] = [
      { id: 'red-one', tier: 'red', description: '', trigger_keywords: ['foo'] },
      { id: 'green-one', tier: 'green', description: '', trigger_keywords: ['foo'] },
    ];
    const m = matchTemplate('foo', bothMatch);
    expect(m?.tier).toBe('green');
  });

  it('skips templates with no keywords', () => {
    const m = matchTemplate('no keywords', [TEMPLATES[2]!]);
    expect(m).toBeNull();
  });
});

describe('matchTemplate — SEED templates', () => {
  it('loadTemplates resolves to an array of at least 11 templates', async () => {
    const templates = await loadTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(11);
  });

  it('SEED contains at least 3 green-tier templates', async () => {
    const templates = await loadTemplates();
    const greens = templates.filter((t) => t.tier === 'green');
    expect(greens.length).toBeGreaterThanOrEqual(3);
  });

  it('matches deps-bump-minor-patch for a Dependabot title', async () => {
    const templates = await loadTemplates();
    const m = matchTemplate('bump dependency renovate patch minor', templates);
    expect(m?.id).toBe('deps-bump-minor-patch');
  });

  it('matches docs-naming-convention for a docs-naming issue', async () => {
    const templates = await loadTemplates();
    const m = matchTemplate('add naming convention document markdown docs', templates);
    expect(m?.id).toBe('docs-naming-convention');
  });

  it('matches docs-runbook-update for a runbook issue', async () => {
    const templates = await loadTemplates();
    const m = matchTemplate('update runbook procedure docs document', templates);
    expect(m?.id).toBe('docs-runbook-update');
  });

  it('matches testing-skill-adoption for a testing skill issue', async () => {
    const templates = await loadTemplates();
    const m = matchTemplate('adopt testing skill vitest playwright composite', templates);
    expect(m?.id).toBe('testing-skill-adoption');
  });

  it('matches sentry-triage for a Sentry error issue', async () => {
    const templates = await loadTemplates();
    const m = matchTemplate('sentry error triage investigation exception', templates);
    expect(m?.id).toBe('sentry-triage-new-issue');
  });

  it('returns null for a completely unmatched description', async () => {
    const templates = await loadTemplates();
    const m = matchTemplate('completely unrelated topic xyz123', templates);
    expect(m).toBeNull();
  });
});
