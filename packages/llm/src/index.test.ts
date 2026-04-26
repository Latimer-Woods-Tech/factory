import { describe, expect, it, vi } from 'vitest';

import { complete, stream, withSystem, type LLMMessage } from './index';

type FetchCall = [string, RequestInit];

function getCall(mock: { mock: { calls: unknown[][] } }, index: number): FetchCall {
  const call = mock.mock.calls[index];
  if (!call) {
    throw new Error(`no call at index ${String(index)}`);
  }
  return call as unknown as FetchCall;
}

function getBody(mock: { mock: { calls: unknown[][] } }, index = 0): Record<string, unknown> {
  const init = getCall(mock, index)[1];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

const env = {
  ANTHROPIC_API_KEY: 'sk-ant',
  GROK_API_KEY: 'sk-grok',
  GROQ_API_KEY: 'sk-groq',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(status: number, text: string): Response {
  return new Response(text, { status });
}

const anthropicOk = {
  content: [{ type: 'text', text: 'hello from claude' }],
  usage: { input_tokens: 5, output_tokens: 7 },
};

const openAiOk = (provider: string) => ({
  choices: [{ message: { content: `hello from ${provider}` } }],
  usage: { prompt_tokens: 3, completion_tokens: 4 },
});

const messages: LLMMessage[] = [{ role: 'user', content: 'hi' }];

describe('complete', () => {
  it('returns Anthropic result on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, anthropicOk));
    const now = vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1075);
    const result = await complete(messages, env, {}, { fetch: fetchMock, now });
    expect(result.error).toBeNull();
    expect(result.data?.provider).toBe('anthropic');
    expect(result.data?.content).toBe('hello from claude');
    expect(result.data?.tokens).toEqual({ input: 5, output: 7 });
    expect(result.data?.latency).toBe(75);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = getCall(fetchMock, 0)[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('fails over to Grok when Anthropic returns 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse(429, 'rate limited'))
      .mockResolvedValueOnce(jsonResponse(200, openAiOk('grok')));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };
    const result = await complete(messages, env, {}, { fetch: fetchMock, logger });
    expect(result.error).toBeNull();
    expect(result.data?.provider).toBe('grok');
    expect(logger.warn).toHaveBeenCalledWith(
      'llm.failover',
      expect.objectContaining({ from: 'anthropic', to: 'grok', status: 429 }),
    );
  });

  it('fails over to Groq when Anthropic and Grok both fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse(503, 'svc down'))
      .mockResolvedValueOnce(textResponse(500, 'grok down'))
      .mockResolvedValueOnce(jsonResponse(200, openAiOk('groq')));
    const result = await complete(messages, env, {}, { fetch: fetchMock });
    expect(result.error).toBeNull();
    expect(result.data?.provider).toBe('groq');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns LLM_ALL_PROVIDERS_FAILED error when all three fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse(500, 'a'))
      .mockResolvedValueOnce(textResponse(500, 'b'))
      .mockResolvedValueOnce(textResponse(500, 'c'));
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };
    const result = await complete(messages, env, {}, { fetch: fetchMock, logger });
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('LLM_ALL_PROVIDERS_FAILED');
    expect(result.error?.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      'llm.all_providers_failed',
      undefined,
      expect.objectContaining({ attempts: expect.any(Array) as unknown[] }),
    );
  });

  it('returns rate-limit error when Anthropic returns non-failover 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(textResponse(400, 'bad request'));
    const result = await complete(messages, env, {}, { fetch: fetchMock });
    expect(result.error?.code).toBe('LLM_ALL_PROVIDERS_FAILED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles fetch network errors as non-status failures', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse(200, openAiOk('grok')));
    const result = await complete(messages, env, {}, { fetch: fetchMock });
    expect(result.data?.provider).toBe('grok');
  });

  it('includes system prompt from opts in Anthropic body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, anthropicOk));
    await complete(messages, env, { system: 'you are helpful' }, { fetch: fetchMock });
    const body = getBody(fetchMock);
    expect(body.system).toBe('you are helpful');
  });

  it('extracts system message from messages array when no opts.system', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, anthropicOk));
    await complete(
      [
        { role: 'system', content: 'sys-from-msg' },
        { role: 'user', content: 'hi' },
      ],
      env,
      {},
      { fetch: fetchMock },
    );
    const body = getBody(fetchMock) as {
      system?: string;
      messages: Array<{ role: string }>;
    };
    expect(body.system).toBe('sys-from-msg');
    expect(body.messages).toHaveLength(1);
  });

  it('throws ValidationError for empty messages', async () => {
    await expect(complete([], env)).rejects.toThrow('messages must not be empty');
  });

  it('passes maxTokens, temperature, and model overrides', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, anthropicOk));
    await complete(
      messages,
      env,
      { model: 'claude-custom', maxTokens: 256, temperature: 0.1 },
      { fetch: fetchMock },
    );
    const body = getBody(fetchMock);
    expect(body.model).toBe('claude-custom');
    expect(body.max_tokens).toBe(256);
    expect(body.temperature).toBe(0.1);
  });

  it('handles missing usage fields in Anthropic response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { content: [{ type: 'text', text: 'x' }] }));
    const result = await complete(messages, env, {}, { fetch: fetchMock });
    expect(result.data?.tokens).toEqual({ input: 0, output: 0 });
  });

  it('handles missing content in Anthropic response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const result = await complete(messages, env, {}, { fetch: fetchMock });
    expect(result.data?.content).toBe('');
  });

  it('handles missing choices/usage in OpenAI-shaped response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(textResponse(500, 'a'))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    const result = await complete(messages, env, {}, { fetch: fetchMock });
    expect(result.data?.provider).toBe('grok');
    expect(result.data?.content).toBe('');
    expect(result.data?.tokens).toEqual({ input: 0, output: 0 });
  });

  it('handles non-readable error body', async () => {
    const failing = {
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('boom')),
    } as unknown as Response;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failing)
      .mockResolvedValueOnce(jsonResponse(200, openAiOk('grok')));
    const result = await complete(messages, env, {}, { fetch: fetchMock });
    expect(result.data?.provider).toBe('grok');
  });
});

describe('stream', () => {
  it('returns the response body when Anthropic responds 200', async () => {
    const body = new ReadableStream<Uint8Array>();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );
    const result = await stream(messages, { ANTHROPIC_API_KEY: 'sk' }, {}, { fetch: fetchMock });
    expect(result).toBeInstanceOf(ReadableStream);
    const sentBody = getBody(fetchMock);
    expect(sentBody.stream).toBe(true);
  });

  it('throws ValidationError for empty messages', async () => {
    await expect(stream([], { ANTHROPIC_API_KEY: 'sk' })).rejects.toThrow(
      'messages must not be empty',
    );
  });

  it('throws InternalError when Anthropic returns non-OK', async () => {
    const fetchMock = vi.fn().mockResolvedValue(textResponse(500, 'down'));
    await expect(
      stream(messages, { ANTHROPIC_API_KEY: 'sk' }, {}, { fetch: fetchMock }),
    ).rejects.toThrow('Anthropic stream failed');
  });

  it('throws InternalError when response has no body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    await expect(
      stream(messages, { ANTHROPIC_API_KEY: 'sk' }, {}, { fetch: fetchMock }),
    ).rejects.toThrow('Anthropic stream failed');
  });
});

describe('withSystem', () => {
  it('prepends the system prompt to every call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, anthropicOk));
    const ask = withSystem('you are tactical');
    await ask(messages, env, {}, { fetch: fetchMock });
    const body = getBody(fetchMock);
    expect(body.system).toBe('you are tactical');
  });

  it('lets call-site opts override unrelated fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, anthropicOk));
    const ask = withSystem('s');
    await ask(messages, env, { temperature: 0.2 }, { fetch: fetchMock });
    const body = getBody(fetchMock);
    expect(body.temperature).toBe(0.2);
  });
});