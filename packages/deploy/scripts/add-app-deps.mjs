#!/usr/bin/env node
/**
 * add-app-deps.mjs — Adds app-specific @adrper79-dot/* dependencies to package.json.
 *
 * Usage:
 *   node add-app-deps.mjs <app-name>
 *
 * Reads <app-name>/package.json, merges in the extra packages for that app,
 * then writes it back.  Called by scaffold-all-apps.yml after write-schema.mjs.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = process.argv[2];
if (!APP) {
  console.error('Usage: node add-app-deps.mjs <app-name>');
  process.exit(1);
}

/** Extra @adrper79-dot/* packages per app, beyond the base set in scaffold.mjs */
const EXTRA_DEPS = {
  'wordis-bond':    ['@adrper79-dot/compliance', '@adrper79-dot/crm', '@adrper79-dot/telephony'],
  'cypher-healing': ['@adrper79-dot/telephony', '@adrper79-dot/llm', '@adrper79-dot/copy'],
  'prime-self':     ['@adrper79-dot/telephony', '@adrper79-dot/llm', '@adrper79-dot/copy'],
  'ijustus':        ['@adrper79-dot/telephony', '@adrper79-dot/llm', '@adrper79-dot/compliance', '@adrper79-dot/crm'],
  'the-calling':    [],
  'neighbor-aid':   [],
};

const extras = EXTRA_DEPS[APP];
if (extras === undefined) {
  console.error(`Unknown app: ${APP}. Valid apps: ${Object.keys(EXTRA_DEPS).join(', ')}`);
  process.exit(1);
}

if (extras.length === 0) {
  console.log(`ℹ️  No extra deps for ${APP} — nothing to add.`);
  process.exit(0);
}

const pkgPath = join(process.cwd(), APP, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

for (const dep of extras) {
  if (!pkg.dependencies[dep]) {
    pkg.dependencies[dep] = '^0.2.0';
    console.log(`  ➕ ${dep}`);
  } else {
    console.log(`  ✅ ${dep} already present`);
  }
}

// Sort dependencies keys for deterministic output
pkg.dependencies = Object.fromEntries(
  Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)),
);

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`✅ Updated package.json for ${APP}`);
