import { describe, it, expect, vi } from 'vitest';
import { complete, type LLMEnv } from './index.js';

const ENV: LLMEnv = {
  AI_GATEWAY_BASE_URL: 'https://gateway.test/v1',
  ANTHROPIC_API_KEY: 'ak-test',
  GROQ_API_KEY: 'grq-test',
  VERTEX_ACCESS_TOKEN: 'vertex-test',
  VERTEX_PROJECT: 'factory-495015',
  VERTEX_LOCATION: 'us-central1',
};

function anthropicResponse(text = 'hello', extra: Record<string, number> = {}) {
  return new Response(
    JSON.stringify({
      content: [{ type: 'text', text }],
      usage: {
        input_tokens: 12,
        output_tokens: 7,
        cache_read_input_tokens: extra.cacheRead ?? 0,
        cache_creation_input_tokens: extra.cacheWrite ?? 0,
      },
      model: 'claude-sonnet-4-20250514',
    }),
    { status: 200, headers: { 'cf-aig-request-id': 'aig-xyz' } },
  );
}

function geminiResponse(text = 'gemini-hello') {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 200000, candidatesTokenCount: 9 },
    }),
    { status: 200 },
  );
}

function groqResponse(text = 'verdict') {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: text } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
      model: 'llama-3.3-70b-versatile',
    }),
    { status: 200 },
  );
}

describe('complete', () => {
  it('routes balanced tier to Anthropic and returns parsed result', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(anthropicResponse('ok')));
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'balanced' },
      { fetch: fetchImpl as unknown as typeof fetch, now: () => 1000 },
    );
    expect(res.error).toBeNull();
    expect(res.data).not.toBeNull();
    expect(res.data!.provider).toBe('anthropic');
    expect(res.data!.tier).toBe('balanced');
    expect(res.data!.tokens.input).toBe(12);
    expect(res.data!.gatewayRequestId).toBe('aig-xyz');
    expect(fetchImpl).toHaveBeenCalledOnce();
    const call = fetchImpl.mock.calls[0] as unknown as [string | URL | Request, RequestInit?];
    expect(String(call[0])).toContain('anthropic/v1/messages');
  });

  it('fast tier uses Haiku and no fallback leg', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(anthropicResponse('fast')));
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'fast' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.error).toBeNull();
    expect(res.data!.tier).toBe('fast');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('smart tier with long-context goes to Gemini primary', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request) => {
      if (String(url).includes('google-vertex-ai')) return Promise.resolve(geminiResponse('smart-long'));
      return Promise.resolve(new Response('', { status: 500 }));
    });
    const longText = 'y'.repeat(700_000);
    const res = await complete(
      [{ role: 'user', content: longText }],
      ENV,
      { tier: 'smart' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.data!.provider).toBe('gemini');
    expect(res.data!.tier).toBe('smart');
  });

  it('smart tier short-context uses Opus', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(anthropicResponse('smart')));
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'smart' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.data!.provider).toBe('anthropic');
    expect(res.data!.model).toContain('sonnet');
  });

  it('explicit model override routes to matching provider', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request) => {
      if (String(url).includes('google-vertex-ai')) return Promise.resolve(geminiResponse('override'));
      return Promise.resolve(new Response('', { status: 500 }));
    });
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { model: 'gemini-1.5-flash' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.data!.provider).toBe('gemini');
  });

  it('routes long-context balanced to Gemini primary', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request) => {
      if (String(url).includes('google-vertex-ai')) return Promise.resolve(geminiResponse('long'));
      return Promise.resolve(new Response('', { status: 500 }));
    });
    const longText = 'x'.repeat(700_000);
    const res = await complete(
      [{ role: 'user', content: longText }],
      ENV,
      { tier: 'balanced' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.error).toBeNull();
    expect(res.data!.provider).toBe('gemini');
  });

  it('falls back to Gemini when Anthropic returns 503', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request) => {
      if (String(url).includes('anthropic')) return Promise.resolve(new Response('boom', { status: 503 }));
      if (String(url).includes('google-vertex-ai')) return Promise.resolve(geminiResponse('fallback'));
      return Promise.resolve(new Response('', { status: 500 }));
    });
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'balanced' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.error).toBeNull();
    expect(res.data!.provider).toBe('gemini');
  });

  it('retries on 429 then succeeds', async () => {
    let n = 0;
    const fetchImpl = vi.fn(() => {
      n++;
      if (n === 1) return Promise.resolve(new Response('rate', { status: 429 }));
      return Promise.resolve(anthropicResponse('ok-after-retry'));
    });
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'fast' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.error).toBeNull();
    expect(res.data!.attempts).toBe(2);
  });

  it('returns rate-limit error when no fallback and 429 exhausts', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('rate', { status: 429 })));
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'fast' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.data).toBeNull();
    expect(res.error!.code).toBe('RATE_LIMITED');
  });

  it('verifier tier hits Groq only', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(groqResponse('verdict')));
    const res = await complete(
      [{ role: 'user', content: 'verify' }],
      ENV,
      { tier: 'verifier' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.error).toBeNull();
    expect(res.data!.provider).toBe('groq');
    const call = fetchImpl.mock.calls[0] as unknown as [string | URL | Request, RequestInit?];
    expect(String(call[0])).toContain('groq/openai/v1/chat/completions');
  });

  it('enables prompt caching for long system prompt', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(anthropicResponse('cached', { cacheRead: 100, cacheWrite: 0 })));
    const longSystem = 'you are helpful. '.repeat(400);
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'fast', system: longSystem },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.data!.tokens.cacheRead).toBe(100);
    const call = fetchImpl.mock.calls[0] as unknown as [string | URL | Request, { body: string }];
    const body = JSON.parse(call[1]!.body);
    expect(Array.isArray(body.system)).toBe(true);
  });

  it('stamps ledger fields to logger', async () => {
    const info = vi.fn();
    const fetchImpl = vi.fn(() => Promise.resolve(anthropicResponse()));
    await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'fast', runId: 'r-1', project: 'p-1', actor: 'a-1' },
      { fetch: fetchImpl as unknown as typeof fetch, logger: { info } as unknown as import('@latimer-woods-tech/logger').Logger },
    );
    expect(info).toHaveBeenCalled();
    const args = info.mock.calls[0];
    expect(args[1]).toMatchObject({ runId: 'r-1', project: 'p-1', actor: 'a-1' });
  });

  it('returns LLM_ALL_PROVIDERS_FAILED when both legs fail non-retryably', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('nope', { status: 400 })));
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'balanced' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.data).toBeNull();
    expect(res.error).not.toBeNull();
    expect(res.error!.code).toBe('INTERNAL_ERROR');
    expect(res.error!.message).toContain('LLM_ALL_PROVIDERS_FAILED');
  });

  it('empty anthropic response triggers fallback', async () => {
    const fetchImpl = vi.fn((url: string | URL | Request) => {
      if (String(url).includes('anthropic')) {
        return Promise.resolve(new Response(JSON.stringify({ content: [{ type: 'text', text: '' }], usage: {} }), { status: 200 }));
      }
      return Promise.resolve(geminiResponse('fallback-empty'));
    });
    const res = await complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'balanced' },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    expect(res.data!.provider).toBe('gemini');
  });

  it('throws on missing AI_GATEWAY_BASE_URL', async () => {
    const bad = { ...ENV, AI_GATEWAY_BASE_URL: '' };
    await expect(
      complete([{ role: 'user', content: 'x' }], bad as LLMEnv, { tier: 'fast' }),
    ).rejects.toThrow(/AI_GATEWAY_BASE_URL/);
  });

  it('throws on empty messages', async () => {
    await expect(
      complete([], ENV, { tier: 'fast' }),
    ).rejects.toThrow(/messages must not be empty/);
  });

  it('respects AbortSignal and returns aborted error', async () => {
    const ctl = new AbortController();
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });
    const p = complete(
      [{ role: 'user', content: 'hi' }],
      ENV,
      { tier: 'fast', signal: ctl.signal },
      { fetch: fetchImpl as unknown as typeof fetch },
    );
    ctl.abort();
    const res = await p;
    expect(res.data).toBeNull();
    expect(res.error?.message).toMatch(/aborted/);
  });
});
