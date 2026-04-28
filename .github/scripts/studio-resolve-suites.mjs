#!/usr/bin/env node
/**
 * Resolves the comma-separated `SUITES` input into vitest project paths.
 * Outputs the space-separated list as the `paths` step output.
 *
 * `*` means every package under packages/ that has a vitest config.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const KNOWN = {
  'studio-core': 'packages/studio-core',
  auth: 'packages/auth',
  errors: 'packages/errors',
  llm: 'packages/llm',
  neon: 'packages/neon',
  monitoring: 'packages/monitoring',
};

function discoverAll() {
  const out = [];
  const root = 'packages';
  if (!existsSync(root)) return out;
  for (const dir of readdirSync(root)) {
    const path = join(root, dir);
    if (!statSync(path).isDirectory()) continue;
    if (
      existsSync(join(path, 'vitest.config.ts')) ||
      existsSync(join(path, 'vitest.config.js')) ||
      existsSync(join(path, 'vitest.config.mts'))
    ) {
      out.push(path);
    }
  }
  return out;
}

const raw = (process.env.SUITES ?? '*').trim();
let paths = [];
if (raw === '*' || raw === '') {
  paths = discoverAll();
} else {
  for (const id of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const path = KNOWN[id];
    if (path && existsSync(path)) paths.push(path);
  }
}

if (paths.length === 0) paths = ['packages/studio-core'];

const output = paths.join(' ');
console.log('Resolved suites:', output);

const ghOutput = process.env.GITHUB_OUTPUT;
if (ghOutput) {
  appendFileSync(ghOutput, `paths=${output}\n`);
}
