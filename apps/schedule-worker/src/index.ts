import { Hono } from 'hono';
import { toErrorResponse, NotFoundError, ValidationError, AuthError } from '@adrper79-dot/errors';
import {
  getPendingJobs,
  getVideoJob,
  scheduleVideo,
  updateJobStatus,
  VIDEO_CALENDAR_DDL,
} from '@adrper79-dot/schedule';
import type { TriggerSource, RenderJobStatus } from '@adrper79-dot/schedule';
import type { Env } from './env.js';

interface DbLike {
  connectionString: string;
  execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }>;
}

/** Minimal FactoryDb adapter over a Hyperdrive binding. */
function makeDb(env: Env): DbLike {
  return {
    connectionString: env.DB.connectionString,
    execute: async (q: unknown) => {
      const res = await fetch(env.DB.connectionString, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q),
      });
      if (!res.ok) {
        throw new Error(`DB execute failed: ${res.status}`);
      }
      return res.json() as Promise<{ rows: Record<string, unknown>[] }>;
    },
  };
}

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Auth middleware: checks WORKER_API_TOKEN for mutating routes
// ---------------------------------------------------------------------------

function requireApiToken(token: string, authHeader: string | undefined): void {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Bearer token required');
  }
  if (authHeader.slice(7) !== token) {
    throw new AuthError('Invalid API token');
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/health', (c) => c.json({ status: 'ok', worker: 'schedule-worker', ts: new Date().toISOString() }));

// ---------------------------------------------------------------------------
// GET /jobs/pending  — returns jobs ready for rendering (cron Worker calls this)
// ---------------------------------------------------------------------------

app.get('/jobs/pending', async (c) => {
  requireApiToken(c.env.WORKER_API_TOKEN, c.req.header('authorization'));
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Number(limitParam) : 10;

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('limit must be an integer between 1 and 100');
  }

  const db = makeDb(c.env) as unknown as Parameters<typeof getPendingJobs>[0];
  const jobs = await getPendingJobs(db, limit);
  return c.json({ data: jobs });
});

// ---------------------------------------------------------------------------
// GET /jobs/:id  — fetch a single job
// ---------------------------------------------------------------------------

app.get('/jobs/:id', async (c) => {
  requireApiToken(c.env.WORKER_API_TOKEN, c.req.header('authorization'));
  const { id } = c.req.param();
  const db = makeDb(c.env) as unknown as Parameters<typeof getVideoJob>[0];
  const job = await getVideoJob(db, id);
  return c.json({ data: job });
});

// ---------------------------------------------------------------------------
// POST /jobs  — schedule a new video
// ---------------------------------------------------------------------------

app.post('/jobs', async (c) => {
  requireApiToken(c.env.WORKER_API_TOKEN, c.req.header('authorization'));

  type Body = {
    appId?: unknown;
    type?: unknown;
    topic?: unknown;
    triggerSource?: unknown;
    scheduledAt?: unknown;
    performanceScore?: unknown;
  };

  const body = await c.req.json<Body>();
  const { appId, type, topic, triggerSource, scheduledAt, performanceScore } = body;

  if (typeof appId !== 'string' || !appId) throw new ValidationError('appId is required');
  if (typeof type !== 'string' || !type) throw new ValidationError('type is required');
  if (typeof topic !== 'string' || !topic) throw new ValidationError('topic is required');
  if (typeof triggerSource !== 'string') throw new ValidationError('triggerSource is required');

  const db = makeDb(c.env) as unknown as Parameters<typeof scheduleVideo>[0];
  const id = await scheduleVideo(db, {
    appId,
    type: type as 'marketing' | 'training' | 'walkthrough',
    topic,
    triggerSource: triggerSource as TriggerSource,
    scheduledAt: scheduledAt ? new Date(scheduledAt as string) : new Date(),
    performanceScore: typeof performanceScore === 'number' ? performanceScore : 50,
  });

  return c.json({ data: { id } }, 201);
});

// ---------------------------------------------------------------------------
// PATCH /jobs/:id  — update job status (called by render-video.yml + cron)
// ---------------------------------------------------------------------------

app.patch('/jobs/:id', async (c) => {
  requireApiToken(c.env.WORKER_API_TOKEN, c.req.header('authorization'));

  type Body = {
    status?: unknown;
    streamUid?: unknown;
    videoUrl?: unknown;
    narrationUrl?: unknown;
    script?: unknown;
  };

  const { id } = c.req.param();
  const body = await c.req.json<Body>();
  const { status, streamUid, videoUrl, narrationUrl, script } = body;

  const validStatuses: RenderJobStatus[] = ['pending', 'rendering', 'done', 'failed'];
  if (typeof status !== 'string' || !validStatuses.includes(status as RenderJobStatus)) {
    throw new ValidationError(`status must be one of: ${validStatuses.join(', ')}`);
  }

  const db = makeDb(c.env) as unknown as Parameters<typeof updateJobStatus>[0];
  await updateJobStatus(db, id, status as RenderJobStatus, {
    streamUid: typeof streamUid === 'string' ? streamUid : undefined,
    videoUrl: typeof videoUrl === 'string' ? videoUrl : undefined,
    narrationUrl: typeof narrationUrl === 'string' ? narrationUrl : undefined,
    script: typeof script === 'string' ? script : undefined,
  });

  return c.json({ data: { id, status } });
});

// ---------------------------------------------------------------------------
// POST /migrate  — run DDL (operator only, call once after deploy)
// ---------------------------------------------------------------------------

app.post('/migrate', async (c) => {
  requireApiToken(c.env.WORKER_API_TOKEN, c.req.header('authorization'));
  const db = makeDb(c.env) as unknown as Parameters<typeof updateJobStatus>[0];
  await (db as unknown as { execute: (q: unknown) => Promise<unknown> }).execute(VIDEO_CALENDAR_DDL);
  return c.json({ data: { migrated: true } });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  const response = toErrorResponse(err);
  const status = (response.error?.status ?? 500) as 200 | 201 | 400 | 401 | 403 | 404 | 422 | 429 | 500;
  return c.json(response, status);
});

export default app;
