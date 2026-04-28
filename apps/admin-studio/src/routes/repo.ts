/**
 * Phase D — Repository browser routes (read-only in this pass).
 *
 *   GET /repo/branches              → list branches (default flagged)
 *   GET /repo/tree?ref=:ref         → full recursive tree at ref
 *   GET /repo/file?path=…&ref=…     → single-file content (text or binary flag)
 *
 * The Worker proxies all GitHub calls so the browser never sees the PAT.
 * Rate limiting / caching beyond GitHub's own ETag handling is a Phase D.2
 * follow-up.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../types.js';
import {
  GitHubApiError,
  fetchBranches,
  fetchFile,
  fetchTree,
} from '../lib/github-api.js';

const repo = new Hono<AppEnv>();

repo.get('/branches', async (c) => {
  if (!c.env.GITHUB_TOKEN) return c.json({ error: 'GITHUB_TOKEN not configured' }, 503);
  try {
    const branches = await fetchBranches(c.env.GITHUB_TOKEN);
    return c.json({ branches });
  } catch (err) {
    return mapError(c, err);
  }
});

repo.get('/tree', async (c) => {
  if (!c.env.GITHUB_TOKEN) return c.json({ error: 'GITHUB_TOKEN not configured' }, 503);
  const ref = c.req.query('ref') || 'main';
  try {
    const tree = await fetchTree(c.env.GITHUB_TOKEN, ref);
    return c.json(tree);
  } catch (err) {
    return mapError(c, err);
  }
});

repo.get('/file', async (c) => {
  if (!c.env.GITHUB_TOKEN) return c.json({ error: 'GITHUB_TOKEN not configured' }, 503);
  const path = c.req.query('path');
  const ref = c.req.query('ref') || 'main';
  if (!path) return c.json({ error: 'path query is required' }, 400);
  if (path.includes('..')) return c.json({ error: 'invalid path' }, 400);
  try {
    const file = await fetchFile(c.env.GITHUB_TOKEN, path, ref);
    return c.json({ file });
  } catch (err) {
    return mapError(c, err);
  }
});

function mapError(c: Context<AppEnv>, err: unknown) {
  if (err instanceof GitHubApiError) {
    if (err.status === 404) return c.json({ error: 'github', status: 404, detail: err.body.slice(0, 500) }, 404);
    if (err.status === 403) return c.json({ error: 'github', status: 403, detail: err.body.slice(0, 500) }, 403);
    return c.json({ error: 'github', status: err.status, detail: err.body.slice(0, 500) }, 502);
  }
  console.error('[repo] unexpected error:', (err as Error).message);
  return c.json({ error: 'internal' }, 500);
}

export default repo;
