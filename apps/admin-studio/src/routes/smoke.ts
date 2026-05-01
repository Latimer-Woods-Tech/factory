/**
 * Phase F — Smoke test runner route.
 *
 * POST /catalog/:app/smoke/:endpoint
 *   endpoint = base64url("{method}:{path}") e.g. "R0VUOi9oZWFsdGg="
 *
 * Body:
 *   env: 'production' | 'staging'
 *   probeIdx?: number (run single probe; if omitted, run all)
 *
 * Returns smoke test results for a single endpoint's probes.
 */
import { Hono } from 'hono';
import {
  isEnvironment,
  executeSmokeProbes,
  type Environment,
  type SmokeProbe,
} from '@latimer-woods-tech/studio-core';
import type { AppEnv } from '../types.js';
import { FACTORY_APPS, healthUrlFor } from '../lib/app-registry.js';
import { listCatalog } from '../lib/catalog-store.js';

const smoke = new Hono<AppEnv>();

interface SmokeRunRequest {
  env?: unknown;
  probeIdx?: unknown;
}

smoke.post('/:app/:endpoint', async (c) => {
  const appId = c.req.param('app');
  const endpointB64 = c.req.param('endpoint');
  let env: Environment = 'production';
  let probeIdx: number | undefined;

  try {
    const body = await c.req.json<SmokeRunRequest>();
    if (body.env && isEnvironment(body.env)) {
      env = body.env;
    }
    const requestedProbeIdx = body.probeIdx;
    if (typeof requestedProbeIdx === 'number' && Number.isInteger(requestedProbeIdx) && requestedProbeIdx >= 0) {
      probeIdx = requestedProbeIdx;
    }
  } catch {
    // ignore body parse error, use default env
  }

  // Find app in registry
  const app = FACTORY_APPS.find((a) => a.id === appId);
  if (!app) return c.json({ error: 'unknown app' }, 404);

  // Decode endpoint ID (base64url "{method}:{path}")
  let method = '';
  let path = '';
  try {
    const decoded = atob(endpointB64.replace(/-/g, '+').replace(/_/g, '/'));
    const [m, p] = decoded.split(':', 2);
    if (!m || !p) throw new Error('invalid format');
    method = m;
    path = p;
  } catch (err) {
    return c.json(
      { error: 'invalid endpoint encoding', detail: (err as Error).message },
      400,
    );
  }

  // Look up the catalogued endpoint
  const rows = await listCatalog(c.env.DB, appId, env);
  const endpoint = rows.find((r) => r.method === method && r.path === path);
  if (!endpoint) {
    return c.json({ error: 'endpoint not catalogued', app: appId, env, method, path }, 404);
  }

  if (!endpoint.smoke || endpoint.smoke.length === 0) {
    return c.json({ error: 'endpoint has no smoke probes', app: appId, env, method, path }, 400);
  }

  let probes: ReadonlyArray<SmokeProbe> = endpoint.smoke;
  if (probeIdx !== undefined) {
    const selectedProbe = probes[probeIdx];
    if (!selectedProbe) {
      return c.json({ error: 'probeIdx out of range', app: appId, env, method, path, probeIdx }, 400);
    }
    probes = [selectedProbe];
  }

  // Reuse the operator bearer token for session/admin probes. The route is
  // already authenticated by envContextMiddleware, so this preserves the same
  // env-locked identity and avoids unsafe service-token stubs.
  let authToken: string | undefined;
  if (endpoint.auth === 'admin' || endpoint.auth === 'session') {
    const authorization = c.req.header('Authorization');
    authToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : c.req.query('access_token');
  }

  try {
    const healthUrl = healthUrlFor(app, env);
    if (!healthUrl) {
      return c.json({ error: 'health URL not available for local environment' }, 400);
    }
    const baseUrl = healthUrl.replace(/\/health$/, '');
    const result = await executeSmokeProbes(
      baseUrl,
      endpoint.method,
      endpoint.path,
      endpoint.auth,
      probes,
      authToken,
    );

    // Enrich the middleware-generated audit entry with smoke-specific semantics.
    // The auditMiddleware reads these after next() returns and uses them in the
    // single persisted row — no duplicate entries are written.
    c.set('auditAction', 'smoke.run');
    c.set('auditResource', appId);
    c.set('auditReversibility', 'trivial');
    c.set('auditResultDetail', {
      method,
      path,
      env,
      passed: result.passed,
      total: result.total,
      durationMs: result.durationMs,
    });

    return c.json({
      app: appId,
      env,
      ...result,
    });
  } catch (err) {
    return c.json(
      { error: 'smoke test execution failed', detail: (err as Error).message },
      500,
    );
  }
});

export default smoke;
