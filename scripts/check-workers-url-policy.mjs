#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const ACCOUNT_SUBDOMAIN = 'adrper79';

// FRH-03 scope: active docs/templates and scaffolding surfaces.
const TARGET_FILES = [
  'docs/APP_README_TEMPLATE.md',
  'docs/runbooks/environment-isolation-and-verification.md',
  'packages/deploy/scripts/scaffold.mjs',
];

const URL_REGEX = /https:\/\/[^\s'"`)>,]+/g;

const violations = [];

for (const relativePath of TARGET_FILES) {
  const absolutePath = path.resolve(relativePath);
  const content = readFileSync(absolutePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const matches = line.match(URL_REGEX);
    if (!matches) {
      return;
    }

    for (const rawUrl of matches) {
      let parsed;
      try {
        parsed = new URL(rawUrl);
      } catch {
        continue;
      }

      const host = parsed.hostname.toLowerCase();
      if (!host.endsWith('.workers.dev')) {
        continue;
      }

      if (host.endsWith(`.${ACCOUNT_SUBDOMAIN}.workers.dev`)) {
        continue;
      }

      violations.push({
        file: relativePath,
        line: index + 1,
        url: rawUrl,
      });
    }
  });
}

if (violations.length > 0) {
  console.error('Found non-canonical workers.dev URLs.');
  console.error(`Expected host suffix: .${ACCOUNT_SUBDOMAIN}.workers.dev`);
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.url}`);
  }
  process.exit(1);
}

console.log('workers.dev URL policy check passed for active docs/templates.');
