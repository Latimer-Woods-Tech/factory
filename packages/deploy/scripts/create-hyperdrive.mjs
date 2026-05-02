#!/usr/bin/env node
/**
 * Creates or retrieves Cloudflare Hyperdrive configs for all Factory apps.
 * Uses wrangler CLI (which inherits CLOUDFLARE_API_TOKEN) and extracts UUIDs
 * from text output via regex.
 *
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
 *   FACTORY_CORE_CONN, WORDIS_BOND_CONN, CYPHER_HEALING_CONN,
 *   PRIME_SELF_CONN, IJUSTUS_CONN, THE_CALLING_CONN, NEIGHBOR_AID_CONN,
 *   VIDEOKING_CONN
 *   GITHUB_OUTPUT (written by GH Actions runner)
 */
import { execSync } from 'child_process';
import { appendFileSync } from 'fs';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32}/i;
const DELAY_MS = 4000;

const configs = [
  { envKey: 'FACTORY_CORE_ID',   name: 'factory-core-db',   conn: process.env.FACTORY_CORE_CONN },
  { envKey: 'WORDIS_BOND_ID',    name: 'wordis-bond-db',    conn: process.env.WORDIS_BOND_CONN },
  { envKey: 'CYPHER_HEALING_ID', name: 'cypher-healing-db', conn: process.env.CYPHER_HEALING_CONN },
  { envKey: 'PRIME_SELF_ID',     name: 'prime-self-db',     conn: process.env.PRIME_SELF_CONN },
  { envKey: 'IJUSTUS_ID',        name: 'ijustus-db',        conn: process.env.IJUSTUS_CONN },
  { envKey: 'THE_CALLING_ID',    name: 'the-calling-db',    conn: process.env.THE_CALLING_CONN },
  { envKey: 'NEIGHBOR_AID_ID',   name: 'neighbor-aid-db',   conn: process.env.NEIGHBOR_AID_CONN },
  { envKey: 'VIDEOKING_ID',      name: 'videoking-hyperdrive', conn: process.env.VIDEOKING_CONN },
  { envKey: 'XPELEVATOR_ID',      name: 'xpelevator-db',     conn: process.env.XPELEVATOR_CONN },
  { envKey: 'XICO_CITY_ID',       name: 'xico-city-db',      conn: process.env.XICO_CITY_CONN },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wrangler(cmd) {
  try {
    return execSync(`wrangler ${cmd}`, { encoding: 'utf8', stdio: 'pipe' });
  } catch (err) {
    return (err.stdout ?? '') + (err.stderr ?? '');
  }
}

function extractFirstUuid(text) {
  return UUID_RE.exec(text)?.[0];
}

function isAuthError(text) {
  return /Authentication error|Invalid access token|code: 10000|code: 9109/i.test(text);
}

// ---- List existing configs ------------------------------------------------
console.log('Listing existing Hyperdrive configs...');
const listOutput = wrangler('hyperdrive list');
console.log(listOutput);

if (isAuthError(listOutput)) {
  console.error('FATAL: Authentication failed on "hyperdrive list". Check CLOUDFLARE_API_TOKEN permissions.');
  process.exit(1);
}

const existing = new Map();
for (const { name } of configs) {
  // Match a line that contains the name AND a UUID
  for (const line of listOutput.split('\n')) {
    if (line.includes(name)) {
      const id = extractFirstUuid(line);
      if (id) { existing.set(name, id); break; }
    }
  }
}
console.log(`Found ${existing.size} existing config(s): ${[...existing.keys()].join(', ') || '(none)'}`);

// ---- Create or collect each config ----------------------------------------
const outputLines = [];
let anyFailed = false;

for (const { envKey, name, conn } of configs) {
  if (existing.has(name)) {
    const id = existing.get(name);
    console.log(`[exists]  ${name} -> ${id}`);
    outputLines.push(`${envKey}=${id}`);
    continue;
  }

  if (!conn) {
    console.error(`WARN: No connection string for ${name} -- skipping`);
    continue;
  }

  console.log(`[create]  ${name} ...`);
  await sleep(DELAY_MS); // throttle to avoid CF rate limiting

  const out = wrangler(`hyperdrive create "${name}" --connection-string "${conn}"`);
  console.log(out);

  if (isAuthError(out)) {
    console.error(`FATAL: Authentication failed creating ${name}`);
    process.exit(1);
  }

  const id = extractFirstUuid(out);
  if (!id) {
    console.error(`ERROR: Could not extract UUID for ${name}`);
    anyFailed = true;
    continue;
  }

  console.log(`[created] ${name} -> ${id}`);
  outputLines.push(`${envKey}=${id}`);
}

if (anyFailed) process.exit(1);

// ---- Emit results ---------------------------------------------------------
if (outputLines.length > 0) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, outputLines.join('\n') + '\n');
  }
  console.log('\n==== IDs written to GITHUB_OUTPUT ====');
  for (const line of outputLines) console.log(`  ${line}`);
}

console.log('\nDone.');
