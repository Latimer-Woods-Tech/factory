#!/usr/bin/env node
/**
 * Creates or retrieves Cloudflare Hyperdrive configs for all Factory apps.
 * Uses wrangler CLI (which inherits CLOUDFLARE_API_TOKEN) and extracts UUIDs
 * from text output via regex -- avoids relying on --json which is unreliable.
 *
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
 *   FACTORY_CORE_CONN, WORDIS_BOND_CONN, CYPHER_HEALING_CONN,
 *   PRIME_SELF_CONN, IJUSTUS_CONN, THE_CALLING_CONN, NEIGHBOR_AID_CONN
 *   GITHUB_OUTPUT (written by GH Actions runner)
 */
import { execSync } from 'child_process';
import { appendFileSync } from 'fs';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const configs = [
  { envKey: 'FACTORY_CORE_ID',    name: 'factory-core-db',    conn: process.env.FACTORY_CORE_CONN },
  { envKey: 'WORDIS_BOND_ID',     name: 'wordis-bond-db',     conn: process.env.WORDIS_BOND_CONN },
  { envKey: 'CYPHER_HEALING_ID',  name: 'cypher-healing-db',  conn: process.env.CYPHER_HEALING_CONN },
  { envKey: 'PRIME_SELF_ID',      name: 'prime-self-db',      conn: process.env.PRIME_SELF_CONN },
  { envKey: 'IJUSTUS_ID',         name: 'ijustus-db',         conn: process.env.IJUSTUS_CONN },
  { envKey: 'THE_CALLING_ID',     name: 'the-calling-db',     conn: process.env.THE_CALLING_CONN },
  { envKey: 'NEIGHBOR_AID_ID',    name: 'neighbor-aid-db',    conn: process.env.NEIGHBOR_AID_CONN },
];

function wrangler(cmd) {
  try {
    return execSync(`wrangler ${cmd}`, { encoding: 'utf8', stdio: 'pipe' });
  } catch (err) {
    return (err.stdout ?? '') + (err.stderr ?? '');
  }
}

function extractId(text, name) {
  for (const line of text.split('\n')) {
    if (line.includes(name)) {
      const m = UUID_RE.exec(line);
      if (m) return m[0];
    }
  }
  return undefined;
}

console.log('Listing existing Hyperdrive configs...');
const listOutput = wrangler('hyperdrive list');
console.log(listOutput);

const existing = new Map();
for (const { name } of configs) {
  const id = extractId(listOutput, name);
  if (id) existing.set(name, id);
}
console.log(`Found ${existing.size} existing config(s): ${[...existing.keys()].join(', ') || '(none)'}`);

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

  console.log(`Creating ${name}...`);
  const createOutput = wrangler(`hyperdrive create "${name}" --connection-string "${conn}"`);
  console.log(createOutput);

  const id = UUID_RE.exec(createOutput)?.[0];
  if (!id) {
    console.error(`ERROR: Could not extract UUID for ${name} from create output above`);
    anyFailed = true;
    continue;
  }

  console.log(`[created] ${name} -> ${id}`);
  outputLines.push(`${envKey}=${id}`);
}

if (anyFailed) {
  process.exit(1);
}

if (outputLines.length > 0) {
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    appendFileSync(ghOutput, outputLines.join('\n') + '\n');
  }
  console.log('\n==== IDs written to GITHUB_OUTPUT ====');
  for (const line of outputLines) console.log(`  ${line}`);
}

console.log('\nDone.');
