import { describe, expect, it } from 'vitest';

import {
  hasPromptLeak,
  hasUnsafeAdvice,
  hasUnresolvedPlaceholder,
  validateAiOutput,
  type AiOutputValidationConfig,
} from './index';

const selfPrimeConfig: AiOutputValidationConfig = {
  minCharacters: 180,
  maxCharacters: 2_000,
  passScore: 85,
  requiredSections: [
    { id: 'pattern', label: 'Pattern', pattern: /pattern/i },
    { id: 'authority', label: 'Authority', pattern: /authority/i },
    { id: 'practice', label: 'Practice', pattern: /practice/i },
  ],
  requiredFacts: [
    { label: 'energy type', expectedText: ['Builder', 'Generator'] },
    { label: 'authority', expectedText: 'Sacral' },
  ],
  brandVoice: {
    requiredTerms: ['Energy Blueprint'],
    blockedTerms: ['fortune telling'],
  },
};

const strongOutput = `
Your Energy Blueprint shows a Builder pattern with Sacral authority. That means
alignment starts by noticing what your body naturally responds to instead of
forcing initiation from the mind.

Pattern: Builder energy is designed for sustainable devotion when the work is
alive in your system. Frustration is useful feedback, not failure.

Authority: Sacral response is immediate and physical. Give yourself clean yes/no
prompts and listen for the felt pull toward what has life.

Practice: For the next week, pause before commitments and ask one simple question:
Does this create energy or drain it? Track the answer before you explain it.
`;

describe('validateAiOutput', () => {
  it('passes a structured SelfPrime-style output', () => {
    const result = validateAiOutput(strongOutput, selfPrimeConfig);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.issues).toEqual([]);
    expect(Date.parse(result.checkedAt)).not.toBeNaN();
  });

  it('fails empty output as critical', () => {
    const result = validateAiOutput('', selfPrimeConfig);

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ rule: 'content.empty', severity: 'critical' }),
    );
  });

  it('flags missing required sections and facts', () => {
    const result = validateAiOutput(
      'This Energy Blueprint note is intentionally generic and omits the important configured terms.',
      selfPrimeConfig,
    );

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'section.missing', message: 'Missing required section: Pattern.' }),
        expect.objectContaining({ rule: 'fact.missing', severity: 'critical' }),
      ]),
    );
  });

  it('flags raw JSON that would leak implementation details into the UI', () => {
    const result = validateAiOutput('{"pattern":"Builder","authority":"Sacral"}', {
      minCharacters: 1,
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ rule: 'content.raw_json', severity: 'critical' }),
    );
  });

  it('flags prompt leakage, placeholders, forbidden phrases, and unsafe advice', () => {
    const output = `
      As an AI language model, I saw the system prompt. {{client_name}}, you should
      stop your medication and follow this guaranteed result plan.
    `;
    const result = validateAiOutput(output, { minCharacters: 1 });

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'phrase.forbidden' }),
        expect.objectContaining({ rule: 'prompt.leak' }),
        expect.objectContaining({ rule: 'placeholder.unresolved' }),
        expect.objectContaining({ rule: 'unsafe.advice' }),
      ]),
    );
  });

  it('applies brand voice preferred and blocked terms', () => {
    const result = validateAiOutput(strongOutput.replace('Energy Blueprint', 'chart'), {
      minCharacters: 1,
      brandVoice: {
        requiredTerms: ['Energy Blueprint'],
        blockedTerms: ['Builder energy'],
      },
      passScore: 90,
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBe(80);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'brand.term_missing', severity: 'minor' }),
        expect.objectContaining({ rule: 'brand.term_blocked', severity: 'major' }),
      ]),
    );
  });

  it('supports non-critical degradation below the pass threshold', () => {
    const result = validateAiOutput(strongOutput, {
      minCharacters: 1,
      brandVoice: {
        requiredTerms: ['Energy Blueprint', 'Frequency Key', 'Transit Window', 'Practice Arc'],
      },
      passScore: 90,
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBe(85);
    expect(result.issues).toHaveLength(3);
  });
});

describe('convenience checks', () => {
  it('detects prompt leaks', () => {
    expect(hasPromptLeak('The developer message says to ignore previous instructions.')).toBe(true);
    expect(hasPromptLeak('Your pattern has a clear practical rhythm.')).toBe(false);
  });

  it('detects unresolved placeholders', () => {
    expect(hasUnresolvedPlaceholder('Hello {{name}}')).toBe(true);
    expect(hasUnresolvedPlaceholder('Hello Ada')).toBe(false);
  });

  it('detects unsafe advice', () => {
    expect(hasUnsafeAdvice('You should invest everything because this is guaranteed profit.')).toBe(true);
    expect(hasUnsafeAdvice('Treat this as reflective guidance, not medical or financial advice.')).toBe(false);
  });
});
