import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  voiceProfiles,
  registerVoice,
  getVoiceProfile,
  generateCopy,
} from './index.js';
import type { VoiceProfile } from './index.js';

// Mock @latimer-woods-tech/llm so we don't make real network calls
vi.mock('@latimer-woods-tech/llm', () => ({
  complete: vi.fn(),
}));

import { complete } from '@latimer-woods-tech/llm';
const mockComplete = vi.mocked(complete);

const MOCK_ENV = { AI_GATEWAY_BASE_URL: 'https://gw.test', ANTHROPIC_API_KEY: 'ak',
  GROQ_API_KEY: 'gq', VERTEX_ACCESS_TOKEN: 'v', VERTEX_PROJECT: 'p', VERTEX_LOCATION: 'us-central1',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('voiceProfiles', () => {
  it('includes the five built-in profiles', () => {
    expect(voiceProfiles).toHaveProperty('cypher_healing');
    expect(voiceProfiles).toHaveProperty('prime_self');
    expect(voiceProfiles).toHaveProperty('ijustus');
    expect(voiceProfiles).toHaveProperty('the_calling');
    expect(voiceProfiles).toHaveProperty('default');
  });

  it('each profile has required fields', () => {
    for (const profile of Object.values(voiceProfiles)) {
      expect(Array.isArray(profile.tone)).toBe(true);
      expect(Array.isArray(profile.vocabulary)).toBe(true);
      expect(Array.isArray(profile.avoid)).toBe(true);
      expect(typeof profile.register).toBe('string');
      expect(typeof profile.example).toBe('string');
    }
  });
});

describe('registerVoice / getVoiceProfile', () => {
  it('returns the default profile for an unknown appId', () => {
    const profile = getVoiceProfile('nonexistent_app');
    expect(profile).toEqual(voiceProfiles['default']);
  });

  it('returns a built-in profile by name', () => {
    expect(getVoiceProfile('prime_self')).toEqual(voiceProfiles['prime_self']);
  });

  it('registers and retrieves a custom voice', () => {
    const custom: VoiceProfile = {
      tone: ['playful'],
      vocabulary: ['fun', 'bright'],
      avoid: ['boring'],
      register: 'casual',
      example: 'Life is short — make it bright!',
    };
    registerVoice('my_app', custom);
    expect(getVoiceProfile('my_app')).toEqual(custom);
  });
});

describe('generateCopy', () => {
  it('calls complete with a system prompt and returns content', async () => {
    mockComplete.mockResolvedValueOnce({
      data: { content: 'Generated copy', provider: 'anthropic', tokens: { input: 10, output: 5 }, latency: 100, model: 'claude-sonnet-4-20250514', tier: 'balanced', attempts: 1 },
      error: null,
    });

    const result = await generateCopy({
      prompt: 'Write a headline',
      appId: 'default',
      env: MOCK_ENV,
    });

    expect(result).toBe('Generated copy');
    expect(mockComplete).toHaveBeenCalledOnce();
    const [messages, , opts] = mockComplete.mock.calls[0] as Parameters<typeof complete>;
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.content).toContain('Write a headline');
    expect(typeof opts?.system).toBe('string');
    expect(opts?.system).toContain('copywriter');
  });

  it('appends a maxLen hint to the user prompt when provided', async () => {
    mockComplete.mockResolvedValueOnce({
      data: { content: 'Short copy', provider: 'anthropic', tokens: { input: 5, output: 3 }, latency: 50, model: 'claude-sonnet-4-20250514', tier: 'balanced', attempts: 1 },
      error: null,
    });

    await generateCopy({ prompt: 'Headline', appId: 'default', env: MOCK_ENV, maxLen: 80 });

    const [messages] = mockComplete.mock.calls[0] as Parameters<typeof complete>;
    expect(messages[0]?.content).toContain('80 characters');
  });

  it('chooses the correct voice profile for the appId', async () => {
    mockComplete.mockResolvedValueOnce({
      data: { content: 'Healing copy', provider: 'anthropic', tokens: { input: 10, output: 5 }, latency: 100, model: 'claude-sonnet-4-20250514', tier: 'balanced', attempts: 1 },
      error: null,
    });

    await generateCopy({ prompt: 'Headline', appId: 'cypher_healing', env: MOCK_ENV });

    const [, , opts] = mockComplete.mock.calls[0] as Parameters<typeof complete>;
    expect(opts?.system).toContain('healing');
  });

  it('throws InternalError when complete returns no data', async () => {
    mockComplete.mockResolvedValueOnce({ data: null, error: { code: 'LLM_ERROR', message: 'all providers failed', status: 500, retryable: false } });

    const { InternalError } = await import('@latimer-woods-tech/errors');
    await expect(
      generateCopy({ prompt: 'Headline', appId: 'default', env: MOCK_ENV }),
    ).rejects.toBeInstanceOf(InternalError);
  });
});
