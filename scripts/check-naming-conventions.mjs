#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const NAMING_DOC = path.join(ROOT, 'docs', 'NAMING_CONVENTIONS.md');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const HEADER_LINE = '# =============================================================================';

const violations = [];

if (!existsSync(NAMING_DOC)) {
  violations.push('Missing docs/NAMING_CONVENTIONS.md');
}

const workflowFiles = readdirSync(WORKFLOWS_DIR)
  .filter((entry) => entry.startsWith('_') && entry.endsWith('.yml'))
  .sort();

for (const fileName of workflowFiles) {
  const absolutePath = path.join(WORKFLOWS_DIR, fileName);
  const content = readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const expectedName = fileName.replace(/\.yml$/, '');
  const nameLine = lines.find((line) => line.startsWith('name: '));

  if (lines[0] !== HEADER_LINE) {
    violations.push(`${fileName}:1 reusable workflows must start with the standard header banner`);
  }

  if (!nameLine) {
    violations.push(`${fileName}: missing top-level workflow name`);
  } else if (nameLine !== `name: ${expectedName}`) {
    violations.push(`${fileName}: workflow name must be "name: ${expectedName}"`);
  }

  lines.forEach((line, index) => {
    if (line.includes('secrets.CLOUDFLARE_API_TOKEN')) {
      violations.push(`${fileName}:${index + 1} use secrets.CF_API_TOKEN instead of secrets.CLOUDFLARE_API_TOKEN`);
    }
    if (line.includes('secrets.CLOUDFLARE_ACCOUNT_ID')) {
      violations.push(`${fileName}:${index + 1} use secrets.CF_ACCOUNT_ID instead of secrets.CLOUDFLARE_ACCOUNT_ID`);
    }
  });
}

if (violations.length > 0) {
  console.error('Naming convention check failed.');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Naming convention check passed for reusable workflows.');
