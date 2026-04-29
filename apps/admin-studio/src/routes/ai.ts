/**
 * Phase D — AI chat route.
 *
 * `POST /ai/chat` returns a Server-Sent Events stream of `AIChatEvent`s
 * derived from Anthropic's native SSE. The translator lets the browser
 * stay provider-agnostic and lets us swap providers without UI changes.
 *
 * Mode-specific system prompts encode Factory's standing orders so the
 * model never suggests `process.env`, Express, or `node:crypto`.
 *
 * `POST /ai/proposals` is a Phase D.2 placeholder — it will return diff
 * proposals once the editor + commit-to-branch flow lands.
 */
import { Hono } from 'hono';
import { complete, stream as anthropicStream } from '@adrper79-dot/llm';
import type { AIChatEvent, AIChatRequest, AIProposal, AIProposalRequest } from '@adrper79-dot/studio-core';
import type { AppEnv } from '../types.js';

const ai = new Hono<AppEnv>();

const SYSTEM_PROMPTS: Record<AIChatRequest['mode'], string> = {
  generate: [
    'You are a senior staff engineer for Factory, a Cloudflare-Workers-native monorepo.',
    'When generating code:',
    '- Use Hono for HTTP routing (never Express, Fastify, or Next.js).',
    '- Use Drizzle ORM over Hyperdrive (env.DB) for Postgres.',
    '- Use the Web Crypto API for JWT (never jsonwebtoken or node:crypto).',
    '- Read secrets from c.env / env, never from process.env.',
    '- Use ESM imports only; no require, no Buffer, no fs/path.',
    '- Always handle fetch errors explicitly.',
    'Return code in fenced blocks with the language hint.',
  ].join('\n'),
  explain: [
    'You are a code reviewer for Factory.',
    'Walk the user through the supplied code: what it does, why each non-obvious line exists,',
    'and any Factory standing orders it depends on (Workers runtime, Hono, Drizzle, Web Crypto JWT).',
    'Be concise — bullet points over prose.',
  ].join('\n'),
  refactor: [
    'You are a senior staff engineer for Factory.',
    'Refactor the supplied code to better match Factory standards (Workers, Hono, Drizzle, Web Crypto, ESM).',
    'Preserve behaviour. Show the diff inline by emitting the full refactored file in one fenced block,',
    'then a short bullet list explaining each change.',
  ].join('\n'),
};

interface AnthropicStreamPayload {
  type?: string;
  delta?: { type?: string; text?: string };
  usage?: { input_tokens?: number; output_tokens?: number };
  message?: { usage?: { input_tokens?: number } };
  error?: { message?: string };
}

function buildSystem(body: AIChatRequest): string {
  const base = SYSTEM_PROMPTS[body.mode];
  if (!body.context?.snippet) return base;
  const lang = body.context.language ?? 'ts';
  const path = body.context.path ? ` (${body.context.path})` : '';
  return `${base}\n\nThe user has the following file open${path}:\n\n\`\`\`${lang}\n${truncate(body.context.snippet, 8000)}\n\`\`\``;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '\n…[truncated]';
}

/**
 * Translate Anthropic's native SSE into our normalised `AIChatEvent` stream.
 *
 * Anthropic frames look like:
 *   event: content_block_delta
 *   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"…"}}
 *   event: message_delta
 *   data: {"type":"message_delta","usage":{"output_tokens":42}}
 *   event: message_stop
 *   data: {"type":"message_stop"}
 */
function transformAnthropicSse(input: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = input.getReader();
      const emit = (evt: AIChatEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      };

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            const json = dataLine.slice(5).trim();
            if (!json) continue;
            let payload: AnthropicStreamPayload;
            try {
              const parsed: unknown = JSON.parse(json);
              if (!isAnthropicStreamPayload(parsed)) continue;
              payload = parsed;
            } catch {
              continue;
            }
            switch (payload.type) {
              case 'message_start': {
                if (typeof payload.message?.usage?.input_tokens === 'number') {
                  inputTokens = payload.message.usage.input_tokens;
                }
                break;
              }
              case 'content_block_delta': {
                if (payload.delta?.type === 'text_delta' && typeof payload.delta.text === 'string') {
                  emit({ type: 'token', delta: payload.delta.text });
                }
                break;
              }
              case 'message_delta': {
                if (typeof payload.usage?.output_tokens === 'number') {
                  outputTokens = payload.usage.output_tokens;
                }
                break;
              }
              case 'message_stop': {
                emit({ type: 'done', provider: 'anthropic', tokens: { input: inputTokens, output: outputTokens } });
                break;
              }
              case 'error': {
                emit({ type: 'error', message: payload.error?.message ?? 'anthropic error' });
                break;
              }
              default:
                // ignore content_block_start, ping, etc.
                break;
            }
          }
        }
      } catch (err) {
        emit({ type: 'error', message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });
}

function isAnthropicStreamPayload(value: unknown): value is AnthropicStreamPayload {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

ai.post('/chat', async (c) => {
  const body = await c.req.json<AIChatRequest>();
  if (!body.history?.length) {
    return c.json({ error: 'history required' }, 400);
  }
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
  }

  const system = buildSystem(body);
  const messages = body.history.map((t) => ({ role: t.role, content: t.content }));

  const upstream = await anthropicStream(
    messages,
    { ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY },
    {
      system,
      maxTokens: 2048,
      temperature: body.mode === 'refactor' ? 0.2 : 0.5,
    },
  );

  const out = transformAnthropicSse(upstream);

  return new Response(out, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

ai.post('/proposals', async (c) => {
  let body: AIProposalRequest;
  try {
    body = await c.req.json<AIProposalRequest>();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }
  if (!body.path || !body.instruction || typeof body.before !== 'string') {
    return c.json({ error: 'path + instruction + before required' }, 400);
  }
  // Cap user-controlled inputs to keep prompts bounded.
  if (body.instruction.length > 4_000) {
    return c.json({ error: 'instruction too long', maxBytes: 4_000 }, 413);
  }
  if (body.before.length > 256_000) {
    return c.json({ error: 'file too large for proposal', maxBytes: 256_000 }, 413);
  }
  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
  }

  const language = body.language ?? guessLanguage(body.path);
  const system = [
    'You are an automated code-edit assistant for the Factory monorepo.',
    'You will receive a single file and an instruction. Produce the FULL revised file content.',
    'Honour Factory standing orders: Cloudflare Workers, Hono, Drizzle, Web Crypto JWT, ESM-only,',
    'no process.env, no Node built-ins, no Buffer, no jsonwebtoken.',
    '',
    'Output STRICTLY in this format and nothing else:',
    '<<<RATIONALE>>>',
    'one short paragraph explaining what changed and why',
    '<<<AFTER>>>',
    `\`\`\`${language}`,
    'the full updated file content',
    '```',
    '',
    'Do not add prose outside those markers.',
  ].join('\n');

  const userPrompt = [
    `File: ${body.path}`,
    `Instruction: ${body.instruction}`,
    '',
    'Current content:',
    `\`\`\`${language}`,
    truncate(body.before, 16000),
    '```',
  ].join('\n');

  const result = await complete(
    [{ role: 'user', content: userPrompt }],
    {
      ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
      GROK_API_KEY: c.env.XAI_API_KEY ?? '',
      GROQ_API_KEY: c.env.GROQ_API_KEY ?? '',
    },
    { system, maxTokens: 4096, temperature: 0.2 },
  );

  if (result.error || !result.data) {
    return c.json({ error: 'llm failed', detail: result.error?.message }, 502);
  }

  const parsed = parseProposal(result.data.content, body);
  if (!parsed) {
    return c.json(
      { error: 'model returned malformed proposal', raw: result.data.content.slice(0, 500) },
      502,
    );
  }
  const proposal: AIProposal = parsed;
  return c.json({ proposal, provider: result.data.provider, tokens: result.data.tokens });
});

/**
 * Pull the rationale + new file content out of the model's structured reply.
 * Returns null if the markers are missing or we cannot find a fenced block.
 */
function parseProposal(raw: string, req: AIProposalRequest): AIProposal | null {
  const ratIdx = raw.indexOf('<<<RATIONALE>>>');
  const afterIdx = raw.indexOf('<<<AFTER>>>');
  if (ratIdx === -1 || afterIdx === -1 || afterIdx < ratIdx) return null;

  const rationale = raw.slice(ratIdx + '<<<RATIONALE>>>'.length, afterIdx).trim();
  const afterSection = raw.slice(afterIdx + '<<<AFTER>>>'.length);

  const fenceMatch = afterSection.match(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/);
  if (!fenceMatch || !fenceMatch[1]) return null;
  const after = fenceMatch[1].replace(/\n$/, '');

  return { path: req.path, before: req.before, after, rationale };
}

function guessLanguage(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'ts':
    case 'tsx': return 'typescript';
    case 'js':
    case 'jsx': return 'javascript';
    case 'json': return 'json';
    case 'md': return 'markdown';
    case 'sql': return 'sql';
    case 'yml':
    case 'yaml': return 'yaml';
    case 'css': return 'css';
    case 'html': return 'html';
    default: return 'text';
  }
}

export default ai;
