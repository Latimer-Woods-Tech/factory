import { Hono } from 'hono';
import type { AppEnv } from '../types.js';

const ai = new Hono<AppEnv>();

/**
 * POST /ai/chat — server-sent-events stream of LLM tokens.
 *
 * Body: { prompt: string, mode: 'generate' | 'explain' | 'refactor', context?: string[] }
 *
 * Phase A: simple JSON response. Phase E switches to SSE + tool-use loop.
 */
ai.post('/chat', async (c) => {
  const body = await c.req.json<{
    prompt: string;
    mode: 'generate' | 'explain' | 'refactor';
    context?: string[];
  }>();

  if (!body.prompt || body.prompt.length > 16_000) {
    return c.json({ error: 'Prompt missing or too long' }, 400);
  }

  // TODO Phase E: call @adrper79-dot/llm with proper system prompt + repo context.
  return c.json({
    response: `[stub] Mode=${body.mode}. Real LLM wiring lands in Phase E.`,
    model: 'stub',
    tokensUsed: 0,
  });
});

/**
 * POST /ai/proposals — submit an AI-generated patch as a draft branch + PR.
 * Phase E feature. Stubbed here so the route surface is stable.
 */
ai.post('/proposals', (c) =>
  c.json({ error: 'Not implemented in Phase A — see Phase E' }, 501),
);

export default ai;
