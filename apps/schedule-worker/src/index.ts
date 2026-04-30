import { Hono } from 'hono';
import type { Context } from 'hono';
import { createDb, sql } from '@adrper79-dot/neon';
import { toErrorResponse, ValidationError, AuthError } from '@adrper79-dot/errors';
import {
  getPendingJobs,
  getVideoJob,
  scheduleVideo,
  updateJobStatus,
  VIDEO_CALENDAR_MIGRATION_STATEMENTS,
} from '@adrper79-dot/schedule';
import type { TriggerSource, RenderJobStatus } from '@adrper79-dot/schedule';
import type { Env } from './env.js';

type RenderType = 'marketing' | 'training' | 'walkthrough';

interface ServiceAuth {
  /** `null` means the internal Factory token may operate across apps. */
  appId: string | null;
}

const app = new Hono<{ Bindings: Env }>();

type ScheduleWorkerContext = Context<{ Bindings: Env }>;

// ---------------------------------------------------------------------------
// Auth helpers: supports one internal token plus optional app-scoped tokens
// ---------------------------------------------------------------------------

function parseScopedTokens(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => (
        typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[0].length > 0 && entry[1].length > 0
      )),
    );
  } catch {
    throw new AuthError('APP_SERVICE_TOKENS must be a JSON object when configured');
  }
}

function requireApiToken(env: Env, authHeader: string | undefined): ServiceAuth {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Bearer token required');
  }
  const bearer = authHeader.slice(7);
  if (bearer === env.WORKER_API_TOKEN) {
    return { appId: null };
  }

  const appId = parseScopedTokens(env.APP_SERVICE_TOKENS)[bearer];
  if (!appId) {
    throw new AuthError('Invalid API token');
  }
  return { appId };
}

function enforceAppScope(auth: ServiceAuth, requestedAppId: string): string {
  const appId = requestedAppId.trim();
  if (!appId) throw new ValidationError('appId is required');
  if (auth.appId && auth.appId !== appId) {
    throw new AuthError('API token is not scoped for this app');
  }
  return appId;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(`${field} is required`);
  return value.trim();
}

function parseRenderType(value: unknown): RenderType {
  const type = requireString(value, 'type');
  if (type !== 'marketing' && type !== 'training' && type !== 'walkthrough') {
    throw new ValidationError('type must be one of: marketing, training, walkthrough');
  }
  return type;
}

function parseTriggerSource(value: unknown): TriggerSource {
  const triggerSource = requireString(value, 'triggerSource');
  if (triggerSource !== 'cron' && triggerSource !== 'git_tag' && triggerSource !== 'feedback_threshold' && triggerSource !== 'manual') {
    throw new ValidationError('triggerSource must be one of: cron, git_tag, feedback_threshold, manual');
  }
  return triggerSource;
}

async function handlePendingJobs(c: ScheduleWorkerContext): Promise<Response> {
  const auth = requireApiToken(c.env, c.req.header('authorization'));
  const limitParam = c.req.query('limit');
  const limit = limitParam ? Number(limitParam) : 10;
  const requestedAppId = c.req.query('appId') ?? auth.appId ?? undefined;

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('limit must be an integer between 1 and 100');
  }
  const appId = requestedAppId ? enforceAppScope(auth, requestedAppId) : undefined;

  const db = createDb(c.env.DB);
  const jobs = await getPendingJobs(db, limit, appId);
  return c.json({ data: jobs });
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get('/health', (c) => c.json({ status: 'ok', worker: 'schedule-worker', ts: new Date().toISOString() }));

// Stripe webhook ingress probe (W360-005 / J08).
app.get('/stripe/health', (c) => c.json({ status: 'ok', service: 'stripe-ingress', worker: 'schedule-worker', ts: new Date().toISOString() }));

// ---------------------------------------------------------------------------
// GET /manifest  — machine-readable function manifest for studio catalog crawlers
// ---------------------------------------------------------------------------

app.get('/manifest', (c) => {
  const manifest = {
    manifestVersion: 1,
    app: 'schedule-worker',
    env: c.env.ENVIRONMENT ?? 'production',
    generatedAt: new Date().toISOString(),
    entries: [
      {
        method: 'GET',
        path: '/health',
        auth: 'public',
        summary: 'Liveness probe with deployed env',
        smoke: [{ expectedStatus: 200, expectContains: '"status":"ok"' }],
        slo: { p95Ms: 200, errorRate: 0.001 },
        tags: ['ops'],
      },
      {
        method: 'GET',
        path: '/stripe/health',
        auth: 'public',
        summary: 'Stripe webhook ingress liveness probe',
        smoke: [{ expectedStatus: 200, expectContains: '"service":"stripe-ingress"' }],
        slo: { p95Ms: 200, errorRate: 0.001 },
        tags: ['ops', 'webhook'],
      },
      {
        method: 'GET',
        path: '/manifest',
        auth: 'public',
        summary: 'Machine-readable manifest for studio catalog crawlers',
        smoke: [{ expectedStatus: 200, expectContains: '"manifestVersion"' }],
        tags: ['ops'],
      },
      {
        method: 'GET',
        path: '/jobs/pending',
        auth: 'admin',
        summary: 'List pending render jobs ready for dispatch',
        reversibility: 'reversible',
        slo: { p95Ms: 500, errorRate: 0.01 },
        tags: ['video', 'jobs'],
      },
      {
        method: 'GET',
        path: '/jobs/:id',
        auth: 'admin',
        summary: 'Fetch single render job by ID',
        reversibility: 'reversible',
        slo: { p95Ms: 400, errorRate: 0.01 },
        tags: ['video', 'jobs'],
      },
      {
        method: 'POST',
        path: '/jobs',
        auth: 'admin',
        summary: 'Schedule a new video render job',
        reversibility: 'reversible',
        slo: { p95Ms: 600, errorRate: 0.01 },
        tags: ['video', 'jobs'],
      },
      {
        method: 'PATCH',
        path: '/jobs/:id',
        auth: 'admin',
        summary: 'Update render job status (called by render-video.yml)',
        reversibility: 'reversible',
        slo: { p95Ms: 500, errorRate: 0.01 },
        tags: ['video', 'jobs'],
      },
      {
        method: 'POST',
        path: '/migrate',
        auth: 'admin',
        summary: 'Run DDL migrations — internal Factory token only',
        reversibility: 'irreversible',
        tags: ['ops', 'migrations'],
      },
    ],
  };
  return c.json(manifest);
});



app.get('/jobs/pending', async (c) => {
  return handlePendingJobs(c);
});

// ---------------------------------------------------------------------------
// GET /jobs/:id  — fetch a single job
// ---------------------------------------------------------------------------

app.get('/jobs/:id', async (c) => {
  const auth = requireApiToken(c.env, c.req.header('authorization'));
  const { id } = c.req.param();
  if (id === 'pending') return handlePendingJobs(c);

  const db = createDb(c.env.DB);
  const job = await getVideoJob(db, id, auth.appId ?? undefined);
  return c.json({ data: job });
});

// ---------------------------------------------------------------------------
// POST /jobs  — schedule a new video
// ---------------------------------------------------------------------------

app.post('/jobs', async (c) => {
  const auth = requireApiToken(c.env, c.req.header('authorization'));

  type Body = {
    appId?: unknown;
    type?: unknown;
    topic?: unknown;
    triggerSource?: unknown;
    scheduledAt?: unknown;
    performanceScore?: unknown;
    idempotencyKey?: unknown;
  };

  const body = await c.req.json<Body>();
  const { appId, type, topic, triggerSource, scheduledAt, performanceScore, idempotencyKey } = body;

  const scopedAppId = enforceAppScope(auth, requireString(appId, 'appId'));
  const renderType = parseRenderType(type);
  const videoTopic = requireString(topic, 'topic');
  const source = parseTriggerSource(triggerSource);
  const retryKey = idempotencyKey === undefined ? undefined : requireString(idempotencyKey, 'idempotencyKey');

  const db = createDb(c.env.DB);
  const job = await scheduleVideo(db, {
    appId: scopedAppId,
    type: renderType,
    topic: videoTopic,
    triggerSource: source,
    scheduledAt: scheduledAt ? new Date(scheduledAt as string) : new Date(),
    performanceScore: typeof performanceScore === 'number' ? performanceScore : 50,
    idempotencyKey: retryKey,
  });

  return c.json({ data: job }, 201);
});

// ---------------------------------------------------------------------------
// PATCH /jobs/:id  — update job status (called by render-video.yml + cron)
// ---------------------------------------------------------------------------

app.patch('/jobs/:id', async (c) => {
  const auth = requireApiToken(c.env, c.req.header('authorization'));

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

  const validStatuses: RenderJobStatus[] = ['pending', 'rendering', 'uploading', 'done', 'failed'];
  if (typeof status !== 'string' || !validStatuses.includes(status as RenderJobStatus)) {
    throw new ValidationError(`status must be one of: ${validStatuses.join(', ')}`);
  }

  const db = createDb(c.env.DB);
  const job = await updateJobStatus(db, id, status as RenderJobStatus, {
    streamUid: typeof streamUid === 'string' ? streamUid : undefined,
    videoUrl: typeof videoUrl === 'string' ? videoUrl : undefined,
    narrationUrl: typeof narrationUrl === 'string' ? narrationUrl : undefined,
    script: typeof script === 'string' ? script : undefined,
  }, auth.appId ?? undefined);

  return c.json({ data: job });
});

// ---------------------------------------------------------------------------
// POST /migrate  — run DDL (operator only, call once after deploy)
// ---------------------------------------------------------------------------

app.post('/migrate', async (c) => {
  const auth = requireApiToken(c.env, c.req.header('authorization'));
  if (auth.appId) {
    throw new AuthError('Only the internal Factory token can run migrations');
  }
  const db = createDb(c.env.DB);
  for (const statement of VIDEO_CALENDAR_MIGRATION_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
  return c.json({ data: { migrated: true, statements: VIDEO_CALENDAR_MIGRATION_STATEMENTS.length } });
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
