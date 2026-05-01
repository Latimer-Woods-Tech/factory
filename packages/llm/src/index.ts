import {
  ErrorCodes,
  FactoryBaseError,
  InternalError,
  RateLimitError,
  ValidationError,
  type FactoryResponse,
} from '@latimer-woods-tech/errors';
import type { Logger } from '@latimer-woods-tech/logger';

/**
 * Single chat message exchanged with an LLM provider.
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Options that influence LLM completion behaviour.
 */
export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

/**
 * Provider that produced an LLM response.
 */
export type LLMProvider = 'anthropic' | 'grok' | 'groq';

/**
 * Result returned by a successful completion.
 */
export interface LLMResult {
  content: string;
  provider: LLMProvider;
  tokens: { input: number; output: number };
  latency: number;
}

/**
 * Environment bindings required by {@link complete}.
 */
export interface LLMEnv {
  ANTHROPIC_API_KEY: string;
  GROK_API_KEY: string;
  GROQ_API_KEY: string;
}

/**
 * Optional dependencies for {@link complete}.
 */
export interface LLMDeps {
  fetch?: typeof fetch;
  logger?: Logger;
  now?: () => number;
}

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_GROK_MODEL = 'grok-3-fast';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

interface ProviderError {
  status: number;
  message: string;
}

function isFailover(status: number): boolean {
  return status === 429 || status >= 500;
}

function buildAnthropicBody(messages: LLMMessage[], opts: LLMOptions, system?: string): string {
  const filtered = messages.filter((m) => m.role !== 'system');
  const sys = system ?? messages.find((m) => m.role === 'system')?.content;
  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    messages: filtered.map((m) => ({ role: m.role, content: m.content })),
  };
  if (sys) {
    body.system = sys;
  }
  return JSON.stringify(body);
}

function buildOpenAIBody(
  model: string,
  messages: LLMMessage[],
  opts: LLMOptions,
  system?: string,
): string {
  const sys = system ?? messages.find((m) => m.role === 'system')?.content;
  const merged: LLMMessage[] = [];
  if (sys) {
    merged.push({ role: 'system', content: sys });
  }
  for (const m of messages) {
    if (m.role !== 'system') {
      merged.push(m);
    }
  }
  return JSON.stringify({
    model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    messages: merged,
  });
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function parseAnthropic(json: unknown): { content: string; input: number; output: number } {
  const r = json as AnthropicResponse;
  const text = r.content?.find((c) => c.type === 'text')?.text ?? '';
  return {
    content: text,
    input: r.usage?.input_tokens ?? 0,
    output: r.usage?.output_tokens ?? 0,
  };
}

function parseOpenAI(json: unknown): { content: string; input: number; output: number } {
  const r = json as OpenAIResponse;
  const text = r.choices?.[0]?.message?.content ?? '';
  return {
    content: text,
    input: r.usage?.prompt_tokens ?? 0,
    output: r.usage?.completion_tokens ?? 0,
  };
}

async function callProvider(
  provider: LLMProvider,
  request: { url: string; headers: Record<string, string>; body: string },
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const response = await fetchImpl(request.url, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err: ProviderError = {
      status: response.status,
      message: `${provider} request failed (${String(response.status)}): ${text.slice(0, 200)}`,
    };
    throw err;
  }
  return (await response.json()) as unknown;
}

function isProviderError(err: unknown): err is ProviderError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { status?: unknown }).status === 'number' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

/**
 * Runs a completion through the Anthropic → Grok → Groq failover chain.
 *
 * @param messages - Ordered chat history.
 * @param env - API key bindings.
 * @param opts - Optional model/parameters override.
 * @param deps - Optional fetch/logger/clock injection (for testing).
 * @returns A {@link FactoryResponse} carrying either an {@link LLMResult} or
 *   an `LLM_ALL_PROVIDERS_FAILED` error.
 */
export async function complete(
  messages: LLMMessage[],
  env: LLMEnv,
  opts: LLMOptions = {},
  deps: LLMDeps = {},
): Promise<FactoryResponse<LLMResult>> {
  if (messages.length === 0) {
    throw new ValidationError('messages must not be empty');
  }
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const logger = deps.logger;
  const startedAt = now();

  const attempts: Array<{ provider: LLMProvider; status?: number; message: string }> = [];

  // Anthropic
  try {
    const json = await callProvider(
      'anthropic',
      {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: buildAnthropicBody(messages, opts, opts.system),
      },
      fetchImpl,
    );
    const parsed = parseAnthropic(json);
    return {
      data: {
        content: parsed.content,
        provider: 'anthropic',
        tokens: { input: parsed.input, output: parsed.output },
        latency: now() - startedAt,
      },
      error: null,
    };
  } catch (err) {
    const status = isProviderError(err) ? err.status : 0;
    const message = isProviderError(err) ? err.message : (err as Error).message;
    attempts.push({ provider: 'anthropic', status, message });
    if (status !== 0 && !isFailover(status)) {
      return providerErrorResponse(attempts, status === 429);
    }
    logger?.warn('llm.failover', { from: 'anthropic', to: 'grok', status, message });
  }

  // Grok
  try {
    const json = await callProvider(
      'grok',
      {
        url: 'https://api.x.ai/v1/chat/completions',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.GROK_API_KEY}`,
        },
        body: buildOpenAIBody(opts.model ?? DEFAULT_GROK_MODEL, messages, opts, opts.system),
      },
      fetchImpl,
    );
    const parsed = parseOpenAI(json);
    return {
      data: {
        content: parsed.content,
        provider: 'grok',
        tokens: { input: parsed.input, output: parsed.output },
        latency: now() - startedAt,
      },
      error: null,
    };
  } catch (err) {
    const status = isProviderError(err) ? err.status : 0;
    const message = isProviderError(err) ? err.message : (err as Error).message;
    attempts.push({ provider: 'grok', status, message });
    logger?.warn('llm.failover', { from: 'grok', to: 'groq', status, message });
  }

  // Groq
  try {
    const json = await callProvider(
      'groq',
      {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: buildOpenAIBody(opts.model ?? DEFAULT_GROQ_MODEL, messages, opts, opts.system),
      },
      fetchImpl,
    );
    const parsed = parseOpenAI(json);
    return {
      data: {
        content: parsed.content,
        provider: 'groq',
        tokens: { input: parsed.input, output: parsed.output },
        latency: now() - startedAt,
      },
      error: null,
    };
  } catch (err) {
    const status = isProviderError(err) ? err.status : 0;
    const message = isProviderError(err) ? err.message : (err as Error).message;
    attempts.push({ provider: 'groq', status, message });
    logger?.error('llm.all_providers_failed', undefined, { attempts });
  }

  return providerErrorResponse(attempts, false);
}

function providerErrorResponse(
  attempts: Array<{ provider: LLMProvider; status?: number; message: string }>,
  rateLimited: boolean,
): FactoryResponse<LLMResult> {
  const base: FactoryBaseError = rateLimited
    ? new RateLimitError('LLM provider rate limited', { code: ErrorCodes.LLM_RATE_LIMITED, attempts })
    : new InternalError('All LLM providers failed', {
        code: ErrorCodes.LLM_ALL_PROVIDERS_FAILED,
        attempts,
      });
  return {
    data: null,
    error: {
      code: rateLimited ? ErrorCodes.LLM_RATE_LIMITED : ErrorCodes.LLM_ALL_PROVIDERS_FAILED,
      message: base.message,
      status: base.status,
      retryable: base.retryable,
      context: base.context,
    },
  };
}

/**
 * Streams a completion from Anthropic. No failover is performed for streaming
 * responses; callers should fall back to {@link complete} on failure.
 *
 * @param messages - Ordered chat history.
 * @param env - Anthropic API key binding.
 * @param opts - Optional model/parameters override.
 * @param deps - Optional fetch override (for testing).
 * @returns The raw Anthropic streaming response body.
 */
export async function stream(
  messages: LLMMessage[],
  env: { ANTHROPIC_API_KEY: string },
  opts: LLMOptions = {},
  deps: { fetch?: typeof fetch } = {},
): Promise<ReadableStream<Uint8Array>> {
  if (messages.length === 0) {
    throw new ValidationError('messages must not be empty');
  }
  const fetchImpl = deps.fetch ?? fetch;
  const body = JSON.parse(buildAnthropicBody(messages, opts, opts.system)) as Record<string, unknown>;
  body.stream = true;
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    throw new InternalError('Anthropic stream failed', {
      code: ErrorCodes.LLM_ALL_PROVIDERS_FAILED,
      status: response.status,
    });
  }
  return response.body;
}

/**
 * Returns a {@link complete}-compatible function with a system prompt
 * pre-bound, so callers can hand around a domain-specific shortcut.
 *
 * @param system - System prompt to prepend to every call.
 * @returns A function that invokes {@link complete} with `system` injected.
 */
export function withSystem(
  system: string,
): (
  messages: LLMMessage[],
  env: LLMEnv,
  opts?: LLMOptions,
  deps?: LLMDeps,
) => Promise<FactoryResponse<LLMResult>> {
  return (messages, env, opts = {}, deps = {}) =>
    complete(messages, env, { ...opts, system }, deps);
}