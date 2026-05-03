import { describe, it, expect } from 'vitest';
import { matchTemplate } from './match.js';
import type { Template } from './load.js';

const TEMPLATES: Template[] = [
  {
    id: 'health-check',
    tier: 'green',
    description: 'Ping health endpoints',
    trigger_keywords: ['health', 'ping', 'status'],
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
