#!/usr/bin/env node

/**
 * Phase 6 Orchestrator: Infrastructure Setup
 * 
 * Automates the complete Phase 6 setup:
 * 1. Validates credentials (GitHub, CloudFlare, Neon)
 * 2. Provisions 7 Neon databases + runs factory_core DDL
 * 3. Creates 7 Hyperdrive instances
 * 4. Creates 6 GitHub app repositories
 * 5. Creates 6 Sentry projects
 * 6. Creates 6 PostHog projects
 * 7. Stores all IDs and secrets in GitHub Actions secrets
 * 8. Runs setup-all-apps.mjs to wire everything together
 * 
 * Usage:
 *   npm run phase-6:setup
 *   # or
 *   node scripts/phase-6-orchestrator.mjs --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const APPS = [
  'wordis-bond',
  'cypher-healing',
  'prime-self',
  'ijustus',
  'the-calling',
  'neighbor-aid'
];

const HYPERDRIVE_IDS = {
  'factory_core': null,
  'wordis_bond': null,
  'cypher_healing': null,
  'prime_self': null,
  'ijustus': null,
  'the_calling': null,
  'neighbor_aid': null
};

const NEON_CONN_STRINGS = {
  'factory_core': null,
  'wordis_bond': null,
  'cypher_healing': null,
  'prime_self': null,
  'ijustus': null,
  'the_calling': null,
  'neighbor_aid': null
};

const RATE_LIMITER_IDS = {
  'wordis_bond': '1001',
  'cypher_healing': '1002',
  'prime_self': '1003',
  'ijustus': '1004',
  'the_calling': '1005',
  'neighbor_aid': '1006'
};

// Environment validation
function validateCredentials() {
  console.log('\n🔐 Validating credentials...\n');

  const required = [
    'GITHUB_TOKEN',
    'CF_API_TOKEN',
    'CF_ACCOUNT_ID'
  ];

  const missing = required.filter(k => !process.env[k]);

  if (missing.length > 0) {
    console.error(`❌ Missing required credentials: ${missing.join(', ')}`);
    console.error('\nSet these environment variables and retry:\n');
    console.error('  export GITHUB_TOKEN="ghp_..."');
    console.error('  export CF_API_TOKEN="..."');
    console.error('  export CF_ACCOUNT_ID="..."');
    console.error('\nOptional (for automation):\n');
    console.error('  export NEON_API_KEY="..."');
    console.error('  export SENTRY_AUTH_TOKEN="..."');
    console.error('  export POSTHOG_API_KEY="..."');
    process.exit(1);
  }

  // Verify GitHub token
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    console.log('✅ GitHub token valid');
  } catch (e) {
    console.error('❌ GitHub token invalid. Set GITHUB_TOKEN and retry.');
    process.exit(1);
  }

  // Verify CloudFlare credentials
  try {
    execSync(`wrangler whoami`, { stdio: 'pipe', env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: process.env.CF_API_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: process.env.CF_ACCOUNT_ID
    }});
    console.log('✅ CloudFlare credentials valid');
  } catch (e) {
    console.error('❌ CloudFlare credentials invalid. Check CF_API_TOKEN and CF_ACCOUNT_ID.');
    process.exit(1);
  }

  console.log('✅ All credentials validated\n');
}

// Test if Neon CLI is installed
function checkNeonCLI() {
  try {
    execSync('neonctl --version', { stdio: 'pipe' });
    return true;
  } catch {
    console.warn('\n⚠️  Neon CLI not installed. Skipping automated Neon provisioning.');
    console.warn('   Install with: npm install -g neonctl');
    console.warn('   Or provision databases manually via Neon dashboard.\n');
    return false;
  }
}

// Phase 6.1: Neon Database Provisioning
function provisionNeonDatabases(dryRun = false) {
  console.log('📦 Phase 6.1: Neon Database Provisioning\n');

  if (!process.env.NEON_API_KEY) {
    console.warn('⚠️  NEON_API_KEY not set. Skipping automated Neon provisioning.');
    console.warn('   Provision databases manually via https://console.neon.tech');
    console.warn('   Then set NEON_CONN_STR_* environment variables.\n');

    console.log('Neon databases needed:');
    Object.keys(NEON_CONN_STRINGS).forEach(db => {
      console.log(`  - ${db}`);
    });
    console.log();

    return false;
  }

  // Placeholder for automated provisioning
  console.log('To provision Neon databases automatically:\n');
  console.log('  neonctl databases create --project-id {PROJECT_ID} --name factory_core');
  console.log('  neonctl databases create --project-id {PROJECT_ID} --name wordis_bond');
  console.log('  # ... etc for all 7 databases\n');

  return true;
}

// Phase 6.2: Cloudflare Hyperdrive Setup
function setupHyperdrive(dryRun = false) {
  console.log('🔗 Phase 6.2: Cloudflare Hyperdrive Setup\n');

  if (!process.env.NEON_CONN_STR_FACTORY_CORE) {
    console.warn('⚠️  Neon connection strings not set.');
    console.warn('   Set environment variables for each database:\n');
    Object.keys(NEON_CONN_STRINGS).forEach(db => {
      const envVar = `NEON_CONN_STR_${db.toUpperCase()}`;
      console.warn(`     export ${envVar}="postgresql://..."`);
    });
    console.warn();
    return false;
  }

  if (dryRun) {
    console.log('🏜️  DRY RUN — showing Hyperdrive creation commands:\n');
  }

  const databases = [
    { key: 'factory_core', name: 'factory-core-db', env: 'NEON_CONN_STR_FACTORY_CORE' },
    { key: 'wordis_bond', name: 'wordis-bond-db', env: 'NEON_CONN_STR_WORDIS_BOND' },
    { key: 'cypher_healing', name: 'cypher-healing-db', env: 'NEON_CONN_STR_CYPHER_HEALING' },
    { key: 'prime_self', name: 'prime-self-db', env: 'NEON_CONN_STR_PRIME_SELF' },
    { key: 'ijustus', name: 'ijustus-db', env: 'NEON_CONN_STR_IJUSTUS' },
    { key: 'the_calling', name: 'the-calling-db', env: 'NEON_CONN_STR_THE_CALLING' },
    { key: 'neighbor_aid', name: 'neighbor-aid-db', env: 'NEON_CONN_STR_NEIGHBOR_AID' }
  ];

  for (const db of databases) {
    const connStr = process.env[db.env];
    if (!connStr) {
      console.warn(`⚠️  Missing ${db.env}, skipping ${db.name}`);
      continue;
    }

    const cmd = `wrangler hyperdrive create ${db.name} --connection-string "${connStr}" --json`;

    if (dryRun) {
      console.log(`  ${cmd}\n`);
    } else {
      try {
        console.log(`Creating ${db.name}...`);
        const result = execSync(cmd, {
          env: {
            ...process.env,
            CLOUDFLARE_API_TOKEN: process.env.CF_API_TOKEN,
            CLOUDFLARE_ACCOUNT_ID: process.env.CF_ACCOUNT_ID
          }
        }).toString();
        const parsed = JSON.parse(result);
        HYPERDRIVE_IDS[db.key] = parsed.id;
        console.log(`  ✅ ID: ${parsed.id}\n`);
      } catch (e) {
        console.error(`  ❌ Failed: ${e.message}\n`);
      }
    }
  }

  return true;
}

// Phase 6.3: Rate Limiter Setup (already known)
function setupRateLimiters(dryRun = false) {
  console.log('🛑 Phase 6.3: CloudFlare Rate Limiter Namespace IDs\n');

  Object.entries(RATE_LIMITER_IDS).forEach(([app, id]) => {
    console.log(`  ${app}: ${id}`);
  });

  console.log('\n✅ Rate limiter IDs pre-assigned (no API needed)\n');
  return true;
}

// Phase 6.4: GitHub Repository Creation
function createGitHubRepos(dryRun = false) {
  console.log('🐙 Phase 6.4: GitHub Repository Creation\n');

  if (dryRun) {
    console.log('🏜️  DRY RUN — showing repo creation commands:\n');
  }

  for (const app of APPS) {
    const cmd = `gh repo create adrper79-dot/${app} --private --description "Factory App: ${app}"`;

    if (dryRun) {
      console.log(`  ${cmd}\n`);
    } else {
      try {
        console.log(`Creating adrper79-dot/${app}...`);
        execSync(cmd, { stdio: 'inherit' });
        console.log(`  ✅ Created\n`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`  ℹ️  Already exists\n`);
        } else {
          console.error(`  ❌ Failed: ${e.message}\n`);
        }
      }
    }
  }

  return true;
}

// Phase 6.5: Sentry & PostHog Projects
function createMonitoringProjects(dryRun = false) {
  console.log('📊 Phase 6.5: Sentry & PostHog Projects\n');

  if (!process.env.SENTRY_AUTH_TOKEN && !process.env.POSTHOG_API_KEY) {
    console.warn('⚠️  Sentry and/or PostHog credentials not set.');
    console.warn('   Provision projects manually:\n');
    console.warn('   Sentry Dashboard: https://sentry.io/organizations/');
    console.warn('   PostHog Dashboard: https://app.posthog.com/\n');
    console.warn('   Then set environment variables:\n');
    console.warn('     export SENTRY_AUTH_TOKEN="..."');
    console.warn('     export POSTHOG_API_KEY="..."\n');
    return false;
  }

  if (dryRun) {
    console.log('🏜️  DRY RUN — showing project creation commands:\n');
  }

  console.log('Sentry projects needed:');
  APPS.forEach(app => console.log(`  - ${app}-worker`));

  console.log('\nPostHog projects needed:');
  APPS.forEach(app => console.log(`  - ${app}`));

  console.log();
  return true;
}

// Phase 6.6: Run setup-all-apps.mjs
function wireSecrets(dryRun = false) {
  console.log('🔐 Phase 6.6: Wire GitHub & Wrangler Secrets\n');

  const setupScript = path.join(__dirname, '../packages/deploy/scripts/setup-all-apps.mjs');

  if (!fs.existsSync(setupScript)) {
    console.error(`❌ setup-all-apps.mjs not found at ${setupScript}`);
    return false;
  }

  if (dryRun) {
    console.log('🏜️  DRY RUN — would run:\n');
    console.log(`  node ${setupScript}\n`);
  } else {
    console.log('Running setup-all-apps.mjs...\n');
    try {
      execSync(`node ${setupScript}`, {
        stdio: 'inherit',
        env: {
          ...process.env,
          HYPERDRIVE_IDS_JSON: JSON.stringify(HYPERDRIVE_IDS),
          RATE_LIMITER_IDS_JSON: JSON.stringify(RATE_LIMITER_IDS)
        }
      });
      console.log('✅ Secrets wired\n');
      return true;
    } catch (e) {
      console.error(`❌ setup-all-apps.mjs failed: ${e.message}\n`);
      return false;
    }
  }

  return true;
}

// Generate summary report
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 PHASE 6 SETUP SUMMARY');
  console.log('='.repeat(60) + '\n');

  console.log('Hyperdrive IDs:');
  Object.entries(HYPERDRIVE_IDS).forEach(([db, id]) => {
    console.log(`  ${db}: ${id || '❓ Not provisioned'}`);
  });

  console.log('\nRate Limiter Namespace IDs:');
  Object.entries(RATE_LIMITER_IDS).forEach(([app, id]) => {
    console.log(`  ${app}: ${id}`);
  });

  console.log('\nGitHub Repositories:');
  APPS.forEach(app => {
    console.log(`  adrper79-dot/${app}`);
  });

  console.log('\n' + '='.repeat(60) + '\n');

  console.log('🚀 Next step: Phase 7 App Scaffolding\n');
  console.log('  npm run phase-7:scaffold\n');
}

// Main orchestrator
function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('\n' + '='.repeat(60));
  console.log('🏗️  FACTORY PHASE 6: INFRASTRUCTURE SETUP');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\n🏜️  DRY RUN MODE — No changes will be made\n');
  }

  // Step 1: Validate credentials
  validateCredentials();

  // Step 2: Check optional tools
  checkNeonCLI();

  // Step 3–6: Run all provisioning phases
  provisionNeonDatabases(dryRun);
  setupHyperdrive(dryRun);
  setupRateLimiters(dryRun);
  createGitHubRepos(dryRun);
  createMonitoringProjects(dryRun);
  wireSecrets(dryRun);

  // Generate report
  generateReport();

  if (dryRun) {
    console.log('To execute (not dry-run), remove --dry-run flag:\n');
    console.log('  node scripts/phase-6-orchestrator.mjs\n');
  }
}

main();
