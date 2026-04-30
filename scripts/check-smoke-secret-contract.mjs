#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const REQUIRED_SECRETS = [
  'SMOKE_USER_EMAIL',
  'SMOKE_USER_PASSWORD',
  'SMOKE_PRACTITIONER_EMAIL',
  'SMOKE_PRACTITIONER_PASSWORD',
];

const LEGACY_ALIASES = ['SMOKE_EMAIL', 'SMOKE_PASSWORD'];

const WORKFLOW_FILE = '.github/workflows/smoke-prime-self.yml';
const CODE_FILES = [
  'apps/prime-self-smoke/tests/public-funnel.spec.ts',
  'apps/prime-self-smoke/tests/workspace-contract.spec.ts',
];
const DOC_FILE = 'docs/runbooks/github-secrets-and-tokens.md';

const violations = [];

function read(relativePath) {
  return readFileSync(path.resolve(relativePath), 'utf8');
}

const workflowContent = read(WORKFLOW_FILE);
for (const secret of REQUIRED_SECRETS) {
  if (!workflowContent.includes(secret)) {
    violations.push(`${WORKFLOW_FILE}: missing required canonical secret reference ${secret}`);
  }

  if (!workflowContent.includes(`secrets.${secret}`)) {
    violations.push(`${WORKFLOW_FILE}: missing required GitHub secrets mapping for ${secret}`);
  }
}

for (const alias of LEGACY_ALIASES) {
  if (workflowContent.includes(alias)) {
    violations.push(`${WORKFLOW_FILE}: found forbidden legacy alias ${alias}`);
  }
}

for (const file of CODE_FILES) {
  const content = read(file);
  for (const alias of LEGACY_ALIASES) {
    if (content.includes(alias)) {
      violations.push(`${file}: found forbidden legacy alias ${alias}`);
    }
  }
}

const docsContent = read(DOC_FILE);
for (const secret of REQUIRED_SECRETS) {
  if (!docsContent.includes(secret)) {
    violations.push(`${DOC_FILE}: missing canonical contract documentation for ${secret}`);
  }
}

if (!docsContent.includes('Legacy `SMOKE_EMAIL` / `SMOKE_PASSWORD` aliases are no longer used by CI workflows.')) {
  violations.push(`${DOC_FILE}: missing legacy alias deprecation note`);
}

if (violations.length > 0) {
  console.error('Smoke secret contract check failed.');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Smoke secret contract check passed.');
