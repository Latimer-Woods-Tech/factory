#!/usr/bin/env node

const DEFAULT_RETRIES = 6;
const DEFAULT_DELAY_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 10_000;

const args = parseArgs(process.argv.slice(2));

if (!args.url) {
  fail('Missing required --url argument');
}

if ((args.service && !args.environment) || (!args.service && args.environment)) {
  fail('--service and --environment must be provided together when using deploy-gate metadata');
}

const expectedStatus = parsePositiveInteger(args.status ?? '200', '--status');
const retries = parsePositiveInteger(args.retries ?? String(DEFAULT_RETRIES), '--retries');
const delayMs = parsePositiveInteger(args.delayMs ?? String(DEFAULT_DELAY_MS), '--delay-ms');
const timeoutMs = parsePositiveInteger(args.timeoutMs ?? String(DEFAULT_TIMEOUT_MS), '--timeout-ms');

let lastFailure = 'not attempted';
let verified = false;
for (let attempt = 1; attempt <= retries; attempt += 1) {
  const result = await checkEndpoint(args.url, timeoutMs);
  if (result.ok && result.status === expectedStatus) {
    const jsonFailure = args.jsonField
      ? validateJsonField(result.body, args.jsonField, args.jsonEquals)
      : null;
    const bodyFailure = args.bodyContains
      ? validateBodyContains(result.body, args.bodyContains)
      : null;
    if (!jsonFailure && !bodyFailure) {
      console.log(JSON.stringify({
        ok: true,
        service: args.service ?? null,
        environment: args.environment ?? null,
        url: args.url,
        status: result.status,
        attempt,
        durationMs: result.durationMs,
        expectedStatus,
        runId: args.runId ?? process.env.GITHUB_RUN_ID ?? null,
        rollbackRef: args.rollbackRef ?? null,
        checkedAt: new Date().toISOString(),
      }));
      verified = true;
      break;
    }
    lastFailure = jsonFailure ?? bodyFailure ?? 'verification failed';
  } else {
    lastFailure = result.error ?? `expected HTTP ${expectedStatus}, got ${result.status}`;
  }

  console.error(`[verify-http-endpoint] attempt ${attempt}/${retries} failed: ${lastFailure}`);
  if (attempt < retries) {
    await delay(delayMs);
  }
}

if (!verified) {
  fail(`Endpoint verification failed for ${args.url}: ${lastFailure}`);
}

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    const token = values[i];
    if (!token?.startsWith('--')) {
      fail(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = values[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${label} must be a positive integer`);
  }
  return parsed;
}

async function checkEndpoint(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'factory-deploy-health-gate/1' },
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      body,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      body: '',
      durationMs: Date.now() - startedAt,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function validateJsonField(body, fieldPath, expectedValue) {
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    return `response body is not JSON; required field ${fieldPath}`;
  }

  const actual = fieldPath.split('.').reduce((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return value[key];
    }
    return undefined;
  }, json);

  if (actual === undefined) {
    return `missing JSON field ${fieldPath}`;
  }
  if (expectedValue !== undefined && String(actual) !== expectedValue) {
    return `JSON field ${fieldPath} expected ${expectedValue}, got ${String(actual)}`;
  }
  return null;
}

function validateBodyContains(body, expectedSubstring) {
  return body.includes(expectedSubstring)
    ? null
    : `response body does not contain required text: ${expectedSubstring}`;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fail(message) {
  console.error(`[verify-http-endpoint] ${message}`);
  process.exit(1);
}
