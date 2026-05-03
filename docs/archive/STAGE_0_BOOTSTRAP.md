# FACTORY CORE — STAGE 0: BOOTSTRAP
# Claude Code Command: claude --allowedTools Bash,Write,Read,WebFetch

## MISSION
Bootstrap the `factory/core` GitHub repository with all scaffolding, 
configuration, and standing orders required for Stages 1–5 to execute 
cleanly. Stage 0 produces no published packages — it produces the 
infrastructure every subsequent stage builds on.

Stage 0 is complete when:
- [ ] GitHub repo `thefactory/core` exists with correct branch protection
- [ ] CLAUDE.md exists at repo root and contains the full standing orders
- [ ] All 19 package directories are scaffolded with correct package.json, 
      tsconfig.json, tsup.config.ts, and empty src/index.ts
- [ ] GitHub Packages auth is configured for @factory scope
- [ ] CI workflow templates are in .github/workflows/
- [ ] Renovate config is at repo root
- [ ] All quality gate ESLint rules are installed and configured
- [ ] Stage 1 prompt is committed to /prompts/STAGE_1.md

---

## STANDING ORDERS (read before any action)

### Stack — no deviations
- Runtime:     Cloudflare Workers only
- Router:      Hono (never Express, Fastify, Next.js)
- Database:    Neon Postgres via Hyperdrive binding (env.DB)
- Auth:        JWT self-managed (Web Crypto API — never jsonwebtoken)
- LLM chain:   Anthropic → Grok → Groq
- Telephony:   Telnyx + Deepgram + ElevenLabs
- Email:       Resend
- Errors:      Sentry (@factory/monitoring)
- Analytics:   PostHog + first-party factory_events table
- Docs:        Mintlify
- Build:       tsup (ESM only)
- Test:        Vitest + @cloudflare/vitest-pool-workers
- Lang:        TypeScript strict — zero `any` in public APIs

### Hard constraints — enforced by ESLint, never bypassed
- NO process.env anywhere — use c.env.VAR or env.VAR (Hono/Worker bindings)
- NO Node.js built-ins — no fs, no path, no crypto (use Web Crypto API)
- NO CommonJS require() — ESM import/export only
- NO Buffer — use Uint8Array, TextEncoder, TextDecoder
- NO raw fetch without error handling
- NO secrets in source code or wrangler.jsonc vars block

### Quality gates — all must pass before any publish
- TypeScript strict: zero errors
- ESLint: zero warnings (--max-warnings 0)
- Unit coverage: >= 90% lines and functions, >= 85% branches
- Build: tsup produces dist/ with no errors
- JSDoc: >= 90% exported symbols documented

### Commit format
`<type>(<scope>): <description>`
Types: feat | fix | docs | test | refactor | chore | perf
Scope: package name without @factory/ prefix
Example: `feat(errors): add ValidationError with field-level context`

### Package dependency order (NEVER violate — causes circular imports)
1. @factory/errors      (no deps)
2. @factory/monitoring  (deps: errors)
3. @factory/logger      (deps: errors, monitoring)
4. @factory/auth        (deps: errors, logger)
5. @factory/neon        (deps: errors, logger)
6. @factory/stripe      (deps: errors, logger, neon)
7. @factory/llm         (deps: errors, logger)
8. @factory/telephony   (deps: errors, logger, llm)
9. @factory/analytics   (deps: errors, neon)
10. @factory/monitoring (already done)
11. @factory/deploy     (no deps — scripts only)
12. @factory/testing    (no deps — mock factories)
13. @factory/email      (deps: errors, logger)
14. @factory/copy       (deps: llm)
15. @factory/content    (deps: neon, copy)
16. @factory/social     (deps: content)
17. @factory/seo        (no deps)
18. @factory/crm        (deps: neon, analytics)
19. @factory/compliance (deps: neon)
20. @factory/admin      (deps: auth, analytics)

---

## EXECUTION PLAN

### Step 1 — Verify GitHub auth
```bash
gh auth status
gh repo view thefactory/core 2>/dev/null || echo "REPO_DOES_NOT_EXIST"
```

### Step 2 — Create repo if needed
```bash
gh repo create thefactory/core \
  --private \
  --description "Factory Core shared infrastructure packages" \
  --clone
cd core
git checkout -b main
```

### Step 3 — Configure GitHub Packages for @factory scope
Create `.npmrc` at repo root:
```
@factory:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Step 4 — Write CLAUDE.md
Write the full standing orders (this file's STANDING ORDERS section) 
to `CLAUDE.md` at repo root. This file is read automatically by every 
subsequent Claude Code session. It must be complete and self-contained.

CLAUDE.md structure:
```
# Factory Core — Standing Orders
## Mission
## Stack
## Hard Constraints  
## Package Dependency Order
## Quality Gates
## Commit Format
## Error Recovery Protocol
## Session Start Checklist
```

Include this SESSION START CHECKLIST in CLAUDE.md:
```
Before writing any code:
1. Read CLAUDE.md (this file) completely
2. Read the package's existing src/index.ts
3. Run: npm run typecheck (note any existing errors)
4. Run: npm test (note current coverage baseline)
5. Check git log --oneline -10 (understand recent changes)
6. Confirm which phase you are building (check /prompts/ directory)
```

Include this ERROR RECOVERY PROTOCOL in CLAUDE.md:
```
If a build fails:
1. Read the full error — do not guess the fix
2. Check the Hard Constraints list first — most errors are violations
3. Fix the root cause — never suppress errors with @ts-ignore or eslint-disable
4. Re-run the full quality gate sequence before continuing
5. If stuck after 2 attempts: write a BLOCKED.md explaining the blocker
   and stop. Do not proceed past a blocker.
```

### Step 5 — Scaffold all 19 package directories

For each package in the dependency order list, create:

```
packages/<package-name>/
├── src/
│   └── index.ts          # Empty: export {} (placeholder)
├── docs/
│   ├── mint.json
│   ├── overview.mdx
│   ├── quickstart.mdx
│   ├── api-reference.mdx
│   └── changelog.mdx
├── package.json          # See template below
├── tsconfig.json         # See template below
├── tsup.config.ts        # See template below
├── vitest.config.ts      # See template below
├── .eslintrc.json        # See template below
├── README.md             # Package name + one-line description
└── CHANGELOG.md          # ## [Unreleased]
```

**package.json template** (substitute <package-name>):
```json
{
  "name": "@factory/<package-name>",
  "version": "0.1.0",
  "private": false,
  "publishConfig": { "registry": "https://npm.pkg.github.com" },
  "main":    "./dist/index.js",
  "module":  "./dist/index.js",
  "types":   "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types":  "./dist/index.d.ts"
    }
  },
  "files": ["dist", "README.md", "CHANGELOG.md"],
  "scripts": {
    "build":      "tsup src/index.ts --format esm --dts",
    "test":       "vitest run --coverage",
    "lint":       "eslint src --max-warnings 0",
    "typecheck":  "tsc --noEmit",
    "prepublish": "npm run lint && npm run typecheck && npm run test && npm run build"
  },
  "devDependencies": {
    "typescript":  "^5.4.0",
    "tsup":        "^8.1.0",
    "vitest":      "^1.6.0",
    "@vitest/coverage-v8": "^1.6.0",
    "eslint":      "^8.57.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
  }
}
```

**tsconfig.json** (same for all packages):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**tsup.config.ts**:
```typescript
import { defineConfig } from 'tsup';
export default defineConfig({
  entry:    ['src/index.ts'],
  format:   ['esm'],
  dts:      true,
  sourcemap: true,
  clean:    true,
  target:   'es2022',
  platform: 'neutral',
});
```

**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 90, functions: 90, branches: 85 },
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/types.ts'],
    },
  },
});
```

**ESLint config** (.eslintrc.json):
```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parserOptions": { "project": "./tsconfig.json" },
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "no-restricted-globals": ["error",
      { "name": "process", "message": "Use Cloudflare Worker bindings (env.VAR), not process.env" },
      { "name": "Buffer",  "message": "Use Uint8Array or TextEncoder/TextDecoder instead" }
    ],
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["fs", "path", "crypto", "os", "child_process"],
        "message": "Node.js built-ins are not available in Cloudflare Workers"
      }]
    }]
  }
}
```

### Step 6 — Write GitHub Actions workflow templates

**.github/workflows/ci.yml**:
```yaml
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [errors, monitoring, logger, auth, neon, stripe, llm,
                  telephony, analytics, deploy, testing, email, copy,
                  content, social, seo, crm, compliance, admin]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd packages/${{ matrix.package }} && npm ci
      - run: cd packages/${{ matrix.package }} && npm run lint
      - run: cd packages/${{ matrix.package }} && npm run typecheck
      - run: cd packages/${{ matrix.package }} && npm run test
```

**.github/workflows/publish.yml**:
```yaml
name: Publish Package
on:
  push:
    tags: ['*/v*']   # e.g. errors/v1.0.0
permissions:
  contents: read
  packages: write
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@factory'
      - name: Detect package from tag
        run: echo "PACKAGE=$(echo $GITHUB_REF_NAME | cut -d'/' -f1)" >> $GITHUB_ENV
      - run: cd packages/${{ env.PACKAGE }} && npm ci
      - run: cd packages/${{ env.PACKAGE }} && npm run prepublish
      - run: cd packages/${{ env.PACKAGE }} && npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Step 7 — Write Renovate config

**renovate.json** at repo root:
```json
{
  "extends": ["config:base"],
  "packageRules": [{
    "matchPackagePatterns": ["@factory/*"],
    "pinVersions": true,
    "automerge": false,
    "labels": ["factory-core-upgrade"],
    "reviewers": ["adrper79-dot"]
  }],
  "prConcurrentLimit": 3,
  "commitMessagePrefix": "chore(deps):"
}
```

### Step 8 — Commit and push

```bash
git add -A
git commit -m "chore(bootstrap): scaffold factory/core repo with all 19 package stubs"
git push -u origin main
```

### Step 9 — Set branch protection

```bash
gh api repos/thefactory/core/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["validate"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews=null \
  --field restrictions=null
```

### Step 10 — Verify and report

Run the following and confirm all green before declaring Stage 0 complete:
```bash
ls packages/ | wc -l          # should be 19
cat CLAUDE.md | wc -l         # should be > 80 lines
ls .github/workflows/          # should show ci.yml, publish.yml
gh repo view thefactory/core   # confirm repo is accessible
```

Write a STAGE_0_COMPLETE.md to repo root:
```markdown
# Stage 0 Complete
Date: <today>
Packages scaffolded: 19
CLAUDE.md: ✅
CI workflows: ✅
Renovate: ✅
GitHub Packages auth: ✅

## Next Step
Run Stage 1 prompt: /prompts/STAGE_1_FOUNDATION.md
Command: claude --continue --allowedTools Bash,Write,Read
```

---

## COMPLETION SIGNAL
Stage 0 is done when STAGE_0_COMPLETE.md is committed to main.
Do not start building package implementations. That is Stage 1.
