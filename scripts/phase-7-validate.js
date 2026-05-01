#!/usr/bin/env node

/**
 * Phase 7: App Scaffolding Validator
 * 
 * Verifies that app repos are properly scaffolded before agents begin Phase 7 work:
 * - wrangler.jsonc has correct Hyperdrive binding
 * - src/env.ts has all required fields
 * - .dev.vars.example exists and is populated
 * - GitHub workflows are in place
 * - Drizzle config is ready
 * 
 * Usage:
 *   node scripts/phase-7-validate.js --app wordis-bond
 *   node scripts/phase-7-validate.js --all
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APPS = [
  'wordis-bond',
  'cypher-healing',
  'prime-self',
  'ijustus',
  'the-calling',
  'neighbor-aid'
];

class Phase7Validator {
  constructor(appName = null) {
    this.appName = appName;
    this.apps = appName ? [appName] : APPS;
    this.issues = {};
  }

  /**
   * Check if app repo is scaffolded correctly
   */
  validateApp(app) {
    console.log(`\n🔍 Validating ${app}...\n`);

    const checks = [
      this.checkWranglerConfig.bind(this, app),
      this.checkEnvTypes.bind(this, app),
      this.checkDevVarsExample.bind(this, app),
      this.checkGitHubWorkflows.bind(this, app),
      this.checkDrizzleConfig.bind(this, app),
      this.checkTsConfig.bind(this, app),
      this.checkPackageJson.bind(this, app)
    ];

    let passed = 0;
    let failed = 0;
    const appIssues = [];

    checks.forEach(check => {
      const result = check();
      if (result.pass) {
        console.log(`  ✅ ${result.name}`);
        passed++;
      } else {
        console.log(`  ❌ ${result.name}`);
        failed++;
        if (result.help) appIssues.push(result.help);
      }
    });

    if (appIssues.length > 0) {
      this.issues[app] = appIssues;
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    return failed === 0;
  }

  checkWranglerConfig(app) {
    const wranglerPath = path.join(__dirname, `../../${app}/wrangler.jsonc`);
    
    if (!fs.existsSync(wranglerPath)) {
      return {
        name: 'wrangler.jsonc exists',
        pass: false,
        help: `  Create wrangler.jsonc with Hyperdrive binding for ${app}`
      };
    }

    try {
      const content = fs.readFileSync(wranglerPath, 'utf-8');
      
      // Simple check for required sections
      const hasHyperdrive = content.includes('hyperdrive');
      const hasRateLimiter = content.includes('rate_limiters');
      const hasEnv = content.includes('"env"');

      if (!hasHyperdrive || !hasRateLimiter || !hasEnv) {
        return {
          name: 'wrangler.jsonc valid structure',
          pass: false,
          help: `  wrangler.jsonc missing: ${[
            !hasHyperdrive && 'hyperdrive',
            !hasRateLimiter && 'rate_limiters',
            !hasEnv && 'env sections'
          ].filter(Boolean).join(', ')}`
        };
      }

      return { name: 'wrangler.jsonc valid structure', pass: true };
    } catch (e) {
      return {
        name: 'wrangler.jsonc valid structure',
        pass: false,
        help: `  Error reading wrangler.jsonc: ${e.message}`
      };
    }
  }

  checkEnvTypes(app) {
    const envPath = path.join(__dirname, `../../${app}/src/env.ts`);
    
    if (!fs.existsSync(envPath)) {
      return {
        name: 'src/env.ts exists',
        pass: false,
        help: `  Create src/env.ts with Env interface`
      };
    }

    const content = fs.readFileSync(envPath, 'utf-8');
    const required = ['DB', 'JWT_SECRET', 'SENTRY_DSN', 'POSTHOG_KEY'];
    const missing = required.filter(field => !content.includes(field));

    if (missing.length > 0) {
      return {
        name: 'src/env.ts has required fields',
        pass: false,
        help: `  src/env.ts missing: ${missing.join(', ')}`
      };
    }

    return { name: 'src/env.ts has required fields', pass: true };
  }

  checkDevVarsExample(app) {
    const examplePath = path.join(__dirname, `../../${app}/.dev.vars.example`);
    
    if (!fs.existsSync(examplePath)) {
      return {
        name: '.dev.vars.example exists',
        pass: false,
        help: `  Copy .dev.vars.example from Factory docs/`
      };
    }

    const content = fs.readFileSync(examplePath, 'utf-8');
    const required = ['NEON_URL', 'JWT_SECRET', 'SENTRY_DSN'];
    const missing = required.filter(field => !content.includes(field));

    if (missing.length > 0) {
      return {
        name: '.dev.vars.example has templates',
        pass: false,
        help: `  .dev.vars.example missing: ${missing.join(', ')}`
      };
    }

    return { name: '.dev.vars.example has templates', pass: true };
  }

  checkGitHubWorkflows(app) {
    const ciPath = path.join(__dirname, `../../${app}/.github/workflows/ci.yml`);
    const deployPath = path.join(__dirname, `../../${app}/.github/workflows/deploy.yml`);

    if (!fs.existsSync(ciPath) || !fs.existsSync(deployPath)) {
      return {
        name: 'GitHub workflows configured',
        pass: false,
        help: `  Missing: ${[
          !fs.existsSync(ciPath) && 'ci.yml',
          !fs.existsSync(deployPath) && 'deploy.yml'
        ].filter(Boolean).join(', ')}`
      };
    }

    return { name: 'GitHub workflows configured', pass: true };
  }

  checkDrizzleConfig(app) {
    const drizzlePath = path.join(__dirname, `../../${app}/drizzle.config.ts`);
    
    if (!fs.existsSync(drizzlePath)) {
      return {
        name: 'drizzle.config.ts exists',
        pass: false,
        help: `  Create drizzle.config.ts for migrations`
      };
    }

    const content = fs.readFileSync(drizzlePath, 'utf-8');
    if (!content.includes('define') || !content.includes('schema.ts')) {
      return {
        name: 'drizzle.config.ts valid',
        pass: false,
        help: `  drizzle.config.ts missing defineConfig or schema reference`
      };
    }

    return { name: 'drizzle.config.ts valid', pass: true };
  }

  checkTsConfig(app) {
    const tsConfigPath = path.join(__dirname, `../../${app}/tsconfig.json`);
    
    if (!fs.existsSync(tsConfigPath)) {
      return {
        name: 'tsconfig.json exists',
        pass: false,
        help: `  Create tsconfig.json with strict: true`
      };
    }

    const content = JSON.parse(fs.readFileSync(tsConfigPath, 'utf-8'));
    if (content.compilerOptions?.strict !== true) {
      return {
        name: 'TypeScript strict mode',
        pass: false,
        help: `  tsconfig.json must have compilerOptions.strict = true`
      };
    }

    return { name: 'TypeScript strict mode', pass: true };
  }

  checkPackageJson(app) {
    const pkgPath = path.join(__dirname, `../../${app}/package.json`);
    
    if (!fs.existsSync(pkgPath)) {
      return {
        name: 'package.json exists',
        pass: false,
        help: `  Create package.json`
      };
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    
    // Check for Core packages (should be pinned exactly)
    const corePackages = ['@latimer-woods-tech/errors', '@latimer-woods-tech/auth', '@latimer-woods-tech/neon'];
    const hasCorePackages = corePackages.some(pkg => pkg.startsWith('@latimer-woods-tech'));
    
    if (!hasCorePackages) {
      return {
        name: 'package.json has @latimer-woods-tech/* packages',
        pass: false,
        help: `  package.json must include core packages: ${corePackages.join(', ')}`
      };
    }

    // Check versions are pinned (not ^)
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const badRanges = Object.entries(deps)
      .filter(([name, version]) => name.startsWith('@latimer-woods-tech') && version.startsWith('^'))
      .map(([name]) => name);

    if (badRanges.length > 0) {
      return {
        name: 'package.json versions pinned exactly',
        pass: false,
        help: `  ${badRanges.join(', ')} must be pinned exactly (remove ^ from versions)`
      };
    }

    return { name: 'package.json configured', pass: true };
  }

  /**
   * Run validation on all apps
   */
  runAll() {
    console.log('🚀 Factory Phase 7: App Scaffolding Validator\n');
    console.log('=' .repeat(50));

    let allPassed = true;

    for (const app of this.apps) {
      const passed = this.validateApp(app);
      if (!passed) allPassed = false;
    }

    // Summary
    console.log('\n' + '=' .repeat(50));
    
    if (allPassed) {
      console.log('\n✨ All apps ready for Phase 7!\n');
      console.log('Next: npm run scaffold -- {app-name}\n');
    } else {
      console.log('\n⚠️  Some apps need fixes before Phase 7:\n');
      
      for (const [app, issues] of Object.entries(this.issues)) {
        console.log(`${app}:`);
        issues.forEach(issue => console.log(issue));
        console.log();
      }
    }

    process.exit(allPassed ? 0 : 1);
  }
}

// CLI Entry Point
if (require.main === module) {
  const args = process.argv.slice(2);
  let appName = null;
  let validateAll = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--app') appName = args[++i];
    if (args[i] === '--all') validateAll = true;
  }

  const validator = new Phase7Validator(appName);
  validator.runAll();
}

module.exports = Phase7Validator;
