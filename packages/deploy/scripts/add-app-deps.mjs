#!/usr/bin/env node
/**
 * add-app-deps.mjs — Adds app-specific @latimer-woods-tech/* dependencies to package.json.
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

/** Extra @latimer-woods-tech/* packages per app, beyond the base set in scaffold.mjs */
const EXTRA_DEPS = {
  'wordis-bond':    ['@latimer-woods-tech/compliance', '@latimer-woods-tech/crm', '@latimer-woods-tech/telephony'],
  'cypher-healing': ['@latimer-woods-tech/telephony', '@latimer-woods-tech/llm', '@latimer-woods-tech/copy'],
  'prime-self':     ['@latimer-woods-tech/telephony', '@latimer-woods-tech/llm', '@latimer-woods-tech/copy'],
  'ijustus':        ['@latimer-woods-tech/telephony', '@latimer-woods-tech/llm', '@latimer-woods-tech/compliance', '@latimer-woods-tech/crm'],
  'the-calling':    [],
  'neighbor-aid':   [],
  'xpelevator':     ['@latimer-woods-tech/stripe'],
  'xico-city':      ['@latimer-woods-tech/stripe'],
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
