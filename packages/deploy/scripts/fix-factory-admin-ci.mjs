#!/usr/bin/env node
/**
 * fix-factory-admin-ci.mjs
 *
 * One-time fixup for factory-admin:
 *   1. Replaces npm ci → npm install in CI/deploy workflows
 *   2. Runs npm install to generate package-lock.json
 *   3. Commits both changes
 *
 * Usage (in GH Actions):
 *   node packages/deploy/scripts/fix-factory-admin-ci.mjs
 *
 * Env vars required:
 *   GH_TOKEN or GITHUB_TOKEN
 *   NODE_AUTH_TOKEN  (for npm install @latimer-woods-tech/* from GitHub Packages)
 */

import { execSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';

const TOKEN = process.env['GH_TOKEN'] ?? process.env['GITHUB_TOKEN'] ?? '';
if (!TOKEN) throw new Error('GH_TOKEN or GITHUB_TOKEN must be set');

const REPO = 'Latimer-Woods-Tech/factory-admin';
const TMP  = 'factory-admin-fixup-tmp';

// ---------- helpers ----------
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

// ---------- clone ----------
if (existsSync(TMP)) run(`rm -rf ${TMP}`);
run(`git clone "https://x-access-token:${TOKEN}@github.com/${REPO}.git" ${TMP}`);
process.chdir(TMP);
run('git config user.email "ci@factory.dev"');
run('git config user.name "Factory CI"');

// ---------- fixed CI workflow ----------
writeFileSync('.github/workflows/ci.yml', `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@adrper79-dot'
      - name: Install
        run: npm install
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GH_PAT }}
      - run: npm run typecheck
`);

// ---------- fixed deploy workflow ----------
writeFileSync('.github/workflows/deploy.yml', `name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@adrper79-dot'
      - name: Install
        run: npm install
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GH_PAT }}
      - name: Deploy to Cloudflare
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CF_ACCOUNT_ID }}
`);

// ---------- generate package-lock.json ----------
console.log('\n📦 Running npm install to generate package-lock.json...');
run('npm install', { env: { ...process.env } });

// ---------- commit & push ----------
run('git add .github/workflows/ package-lock.json');
run('git diff --staged --stat');
run('git commit -m "fix(ci): use npm install + add package-lock.json"');
run(`git push "https://x-access-token:${TOKEN}@github.com/${REPO}.git" main`);

console.log('\n✅ factory-admin CI fixed and lock file committed!');
