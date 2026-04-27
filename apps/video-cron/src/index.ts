import { InternalError } from '@adrper79-dot/errors';
import type { RenderJob } from '@adrper79-dot/schedule';
import type { Env } from './env.js';

const MAX_CONCURRENT_JOBS = 3;
const PENDING_LIMIT = 10;

// ---------------------------------------------------------------------------
// Schedule-worker API helpers
// ---------------------------------------------------------------------------

/**
 * Fetches pending render jobs from the schedule-worker.
 */
async function fetchPendingJobs(env: Env): Promise<RenderJob[]> {
  const url = `${env.SCHEDULE_WORKER_URL}/jobs/pending?limit=${PENDING_LIMIT}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.WORKER_API_TOKEN}` },
  });

  if (!res.ok) {
    throw new InternalError(`Failed to fetch pending jobs: ${res.status}`);
  }

  const body = await res.json() as { data: RenderJob[] };
  return body.data;
}

/**
 * Marks a job as `rendering` in the schedule-worker before dispatching it.
 * This prevents double-dispatch if the cron fires again before the workflow completes.
 */
async function markRendering(env: Env, jobId: string): Promise<void> {
  const res = await fetch(`${env.SCHEDULE_WORKER_URL}/jobs/${jobId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.WORKER_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'rendering' }),
  });

  if (!res.ok) {
    throw new InternalError(`Failed to mark job ${jobId} as rendering: ${res.status}`);
  }
}

/**
 * Marks a job as `failed` in the schedule-worker (used when dispatch itself errors).
 */
async function markFailed(env: Env, jobId: string, reason: string): Promise<void> {
  await fetch(`${env.SCHEDULE_WORKER_URL}/jobs/${jobId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.WORKER_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'failed', script: `dispatch error: ${reason}` }),
  });
}

// ---------------------------------------------------------------------------
// GitHub Actions workflow dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatches the `render-video.yml` workflow for a single job.
 */
async function dispatchRenderWorkflow(env: Env, job: RenderJob): Promise<void> {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/render-video.yml/dispatches`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'factory-video-cron/1.0',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        job_id: job.id,
        composition_id: job.type === 'marketing'
          ? 'MarketingVideo'
          : job.type === 'training'
            ? 'TrainingVideo'
            : 'WalkthroughVideo',
        app_id: job.appId,
        topic: job.topic,
        brand_color: '#6366f1',
        brand_accent: '#a5b4fc',
        logo_url: '',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new InternalError(`GitHub dispatch failed (${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Cron handler
// ---------------------------------------------------------------------------

/**
 * Processes up to MAX_CONCURRENT_JOBS pending video jobs per cron tick.
 */
async function processPendingJobs(env: Env): Promise<{ dispatched: number; failed: number }> {
  const jobs = await fetchPendingJobs(env);
  const batch = jobs.slice(0, MAX_CONCURRENT_JOBS);

  let dispatched = 0;
  let failed = 0;

  for (const job of batch) {
    try {
      await markRendering(env, job.id);
      await dispatchRenderWorkflow(env, job);
      dispatched++;
    } catch (err) {
      failed++;
      const reason = err instanceof Error ? err.message : String(err);
      await markFailed(env, job.id, reason).catch(() => undefined);
      console.error(JSON.stringify({
        level: 'error',
        msg: 'Failed to dispatch render job',
        jobId: job.id,
        error: reason,
      }));
    }
  }

  return { dispatched, failed };
}

// ---------------------------------------------------------------------------
// Worker export
// ---------------------------------------------------------------------------

export default {
  /**
   * Scheduled handler — fires every hour per wrangler.jsonc cron config.
   * Fetches pending video jobs and dispatches render-video.yml for each.
   */
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    console.log(JSON.stringify({
      level: 'info',
      msg: 'video-cron tick',
      ts: new Date().toISOString(),
      environment: env.ENVIRONMENT,
    }));

    try {
      const { dispatched, failed } = await processPendingJobs(env);
      console.log(JSON.stringify({
        level: 'info',
        msg: 'video-cron complete',
        dispatched,
        failed,
      }));
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error',
        msg: 'video-cron fatal error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  },

  /**
   * HTTP handler — exposes /health for Verification Requirement curl checks.
   */
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        worker: 'video-cron',
        environment: env.ENVIRONMENT,
        ts: new Date().toISOString(),
      });
    }

    if (url.pathname === '/trigger' && request.method === 'POST') {
      // Manual trigger endpoint — protected by WORKER_API_TOKEN
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== env.WORKER_API_TOKEN) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        const { dispatched, failed } = await processPendingJobs(env);
        return Response.json({ data: { dispatched, failed } });
      } catch (err) {
        return Response.json(
          { error: { message: err instanceof Error ? err.message : 'Unknown error' } },
          { status: 500 },
        );
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
