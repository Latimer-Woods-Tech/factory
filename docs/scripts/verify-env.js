#!/usr/bin/env node

/**
 * Environment Verification Script
 *
 * Usage: node scripts/verify-env.js [environment]
 *
 * Checks that:
 * - Required files exist (wrangler.jsonc, src/env.ts, .dev.vars for local)
 * - Environment configuration is consistent (worker names, rate limiter IDs)
 * - No obvious misconfigurations detected
 *
 * Examples:
 *   npm run verify:env:local      # Check local development setup
 *   npm run verify:env:staging    # Check staging environment config
 *   npm run verify:env:production # Check production environment config
 */

const fs = require('fs');
const path = require('path');

const targetEnv = process.argv[2] || 'local';
const appDir = process.cwd();

console.log(`\n🔍 Verifying ${targetEnv} environment configuration...\n`);

/**
 * Check collection
 */
const checks = [];

// 1. Files exist
checks.push({
  name: 'wrangler.jsonc exists',
  pass: () => fs.existsSync(path.join(appDir, 'wrangler.jsonc')),
  help: 'Copy wrangler.jsonc.example to wrangler.jsonc'
});

checks.push({
  name: 'src/env.ts exists',
  pass: () => fs.existsSync(path.join(appDir, 'src', 'env.ts')),
  help: 'src/env.ts should define Env interface with all required fields'
});

checks.push({
  name: 'src/index.ts exists',
  pass: () => fs.existsSync(path.join(appDir, 'src', 'index.ts')),
  help: 'src/index.ts should be the app entry point'
});

if (targetEnv === 'local') {
  checks.push({
    name: '.dev.vars exists (required for local)',
    pass: () => fs.existsSync(path.join(appDir, '.dev.vars')),
    help: 'Copy .dev.vars.example to .dev.vars and fill in your values'
  });
}

// 2. Read wrangler.jsonc
let wranglerConfig = {};
try {
  const wranglerContent = fs.readFileSync(path.join(appDir, 'wrangler.jsonc'), 'utf-8');
  // Simple JSONC parsing (remove comments and trailing commas)
  const cleaned = wranglerContent
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
  wranglerConfig = JSON.parse(cleaned);
} catch (e) {
  console.log(`  ⚠️  Could not parse wrangler.jsonc: ${e.message}`);
}

// 3. Verify worker name matches environment
const workerName = wranglerConfig.name || 'unknown';

checks.push({
  name: `Worker name is environment-appropriate (got: ${workerName})`,
  pass: () => {
    if (targetEnv === 'production') {
      return !workerName.includes('-staging');
    } else if (targetEnv === 'staging') {
      return workerName.includes('-staging');
    }
    return true; // local doesn't matter
  },
  help:
    targetEnv === 'production'
      ? `Worker name should NOT contain "-staging" for production. Got: ${workerName}`
      : targetEnv === 'staging'
        ? `Worker name should contain "-staging" for staging. Got: ${workerName}`
        : 'N/A for local'
});

// 4. Verify Hyperdrive is configured
checks.push({
  name: 'Hyperdrive binding exists (DB)',
  pass: () => {
    const hyperdrive = wranglerConfig.hyperdrive || [];
    return Array.isArray(hyperdrive) && hyperdrive.length > 0 && hyperdrive[0].binding === 'DB';
  },
  help: 'wrangler.jsonc should have hyperdrive section with binding "DB"'
});

// 5. Verify rate limiter is configured
checks.push({
  name: 'Rate limiter binding exists (AUTH_RATE_LIMITER)',
  pass: () => {
    const rateLimiters = wranglerConfig.rate_limiters || [];
    return (
      Array.isArray(rateLimiters) &&
      rateLimiters.length > 0 &&
      rateLimiters[0].binding === 'AUTH_RATE_LIMITER'
    );
  },
  help: 'wrangler.jsonc should have rate_limiters section with binding "AUTH_RATE_LIMITER"'
});

// 6. Verify src/index.ts has /health endpoint
let hasHealthEndpoint = false;
try {
  const indexContent = fs.readFileSync(path.join(appDir, 'src', 'index.ts'), 'utf-8');
  hasHealthEndpoint = indexContent.includes("'/health'") || indexContent.includes('"/health"');
} catch (e) {
  // File might not exist
}

checks.push({
  name: 'src/index.ts defines /health endpoint',
  pass: () => hasHealthEndpoint,
  help: 'Add app.get("/health", (c) => c.json({...})) to src/index.ts'
});

// 7. Verify src/env.ts has required fields
let envFileContent = '';
try {
  envFileContent = fs.readFileSync(path.join(appDir, 'src', 'env.ts'), 'utf-8');
} catch (e) {
  // Will fail the checks below
}

const requiredFields = ['DB', 'SENTRY_DSN', 'POSTHOG_KEY', 'JWT_SECRET', 'ENVIRONMENT', 'WORKER_NAME'];

requiredFields.forEach((field) => {
  checks.push({
    name: `src/env.ts declares ${field}`,
    pass: () => envFileContent.includes(field),
    help: `src/env.ts should declare ${field} in Env interface`
  });
});

// 8. Verify .dev.vars has required fields (local only)
if (targetEnv === 'local') {
  let devVarsContent = '';
  try {
    devVarsContent = fs.readFileSync(path.join(appDir, '.dev.vars'), 'utf-8');
  } catch (e) {
    // Will fail below
  }

  const devVarsFields = ['NEON_URL', 'JWT_SECRET', 'SENTRY_DSN', 'POSTHOG_KEY'];

  devVarsFields.forEach((field) => {
    checks.push({
      name: `.dev.vars has ${field} (not empty)`,
      pass: () => {
        const regex = new RegExp(`^${field}=(.+)$`, 'm');
        const match = devVarsContent.match(regex);
        return match && match[1] && match[1].trim() !== '';
      },
      help: `Add ${field}=<value> to .dev.vars (see .dev.vars.example for format)`
    });
  });
}

/**
 * Run checks and report
 */
let passed = 0;
let failed = 0;
const failures = [];

checks.forEach(({ name, pass, help }) => {
  try {
    if (pass()) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
      failures.push(help);
    }
  } catch (e) {
    console.log(`  ⚠️  ${name} (error: ${e.message})`);
    failed++;
    failures.push(help);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('💡 How to fix:\n');
  failures.forEach((help, i) => {
    console.log(`   ${i + 1}. ${help}`);
  });
  console.log('\n');
  process.exit(1);
} else {
  console.log('✨ Everything looks good!\n');
  console.log(`Run: npm run dev\n`);
}
