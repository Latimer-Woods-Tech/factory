#!/usr/bin/env node
/**
 * Creates or retrieves Cloudflare Hyperdrive configs for all Factory apps.
 * Uses the CF REST API directly to avoid wrangler JSON output issues.
 *
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
 *   FACTORY_CORE_CONN, WORDIS_BOND_CONN, CYPHER_HEALING_CONN,
 *   PRIME_SELF_CONN, IJUSTUS_CONN, THE_CALLING_CONN, NEIGHBOR_AID_CONN
 *   GITHUB_OUTPUT (written by GH Actions runner)
 */
import { appendFileSync } from 'fs';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !apiToken) {
  console.error('ERROR: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set');
  process.exit(1);
}

/** @type {Array<{envKey: string, name: string, conn: string | undefined}>} */
const configs = [
  { envKey: 'FACTORY_CORE_ID',    name: 'factory-core-db',    conn: process.env.FACTORY_CORE_CONN },
  { envKey: 'WORDIS_BOND_ID',     name: 'wordis-bond-db',     conn: process.env.WORDIS_BOND_CONN },
  { envKey: 'CYPHER_HEALING_ID',  name: 'cypher-healing-db',  conn: process.env.CYPHER_HEALING_CONN },
  { envKey: 'PRIME_SELF_ID',      name: 'prime-self-db',      conn: process.env.PRIME_SELF_CONN },
  { envKey: 'IJUSTUS_ID',         name: 'ijustus-db',         conn: process.env.IJUSTUS_CONN },
  { envKey: 'THE_CALLING_ID',     name: 'the-calling-db',     conn: process.env.THE_CALLING_CONN },
  { envKey: 'NEIGHBOR_AID_ID',    name: 'neighbor-aid-db',    conn: process.env.NEIGHBOR_AID_CONN },
];

const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/hyperdrive/configs`;
const headers = {
  Authorization: `Bearer ${apiToken}`,
  'Content-Type': 'application/json',
};

// ── List existing Hyperdrive configs ──────────────────────────────────────────
const listRes = await fetch(baseUrl, { headers });
const listData = await listRes.json();
if (!listData.success) {
  console.error('ERROR listing Hyperdrive configs:', JSON.stringify(listData.errors));
  process.exit(1);
}
/** @type {Map<string, string>} name → id */
const existing = new Map((listData.result ?? []).map((h) => [h.name, h.id]));
console.log(`Found ${existing.size} existing Hyperdrive config(s): ${[...existing.keys()].join(', ') || '(none)'}`);

// ── Create or retrieve each config ───────────────────────────────────────────
const outputLines = [];

for (const { envKey, name, conn } of configs) {
  if (!conn) {
    console.error(`WARN: No connection string for ${name} — skipping`);
    continue;
  }

  if (existing.has(name)) {
    const id = existing.get(name);
    console.log(`[exists]  ${name} → ${id}`);
    outputLines.push(`${envKey}=${id}`);
    continue;
  }

  // Parse the postgres connection string
  const url = new URL(conn);
  const payload = {
    name,
    origin: {
      database: url.pathname.slice(1),
      host: url.hostname,
      password: decodeURIComponent(url.password),
      port: parseInt(url.port, 10) || 5432,
      scheme: 'postgresql',
      user: decodeURIComponent(url.username),
    },
  };

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!data.success) {
    console.error(`ERROR creating ${name}:`, JSON.stringify(data.errors));
    process.exit(1);
  }

  const id = data.result.id;
  console.log(`[created] ${name} → ${id}`);
  outputLines.push(`${envKey}=${id}`);
}

// ── Write to GITHUB_OUTPUT ────────────────────────────────────────────────────
if (outputLines.length > 0) {
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    appendFileSync(ghOutput, outputLines.join('\n') + '\n');
    console.log('\nWrote to GITHUB_OUTPUT:');
  } else {
    console.log('\nLocal output (no GITHUB_OUTPUT):');
  }
  for (const line of outputLines) {
    console.log(`  ${line}`);
  }
}

console.log('\nDone.');
