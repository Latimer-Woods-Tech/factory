# `skills/global/testing` — Factory Global Testing Skill

A composite GitHub Action published by `Latimer-Woods-Tech/factory` that runs
the four standard quality gates for every Factory app in a single step:

| Gate | Tool | Coverage |
|---|---|---|
| Unit / integration tests | [Vitest](https://vitest.dev) | all `*.test.ts` and `*.spec.ts` files |
| E2E browser tests | [Playwright](https://playwright.dev) | `playwright.config.*` test directory |
| Accessibility | [axe via @axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) | WCAG 2.2 AA violations in Playwright tests |
| Security scan | [CodeQL](https://codeql.github.com) | JavaScript / TypeScript static analysis |

---

## Quick start

### Unit tests only (no Playwright, no CodeQL)

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read
    steps:
      - uses: actions/checkout@v4
      - uses: Latimer-Woods-Tech/factory/skills/global/testing@main
        with:
          node_auth_token: ${{ secrets.GITHUB_TOKEN }}
          run_playwright: 'false'
```

### Full suite — unit + E2E/axe + CodeQL

> ⚠️ CodeQL requires `permissions.security-events: write` in the calling workflow.

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read
      security-events: write   # required by CodeQL
    steps:
      - uses: actions/checkout@v4
      - uses: Latimer-Woods-Tech/factory/skills/global/testing@main
        with:
          node_auth_token: ${{ secrets.GITHUB_TOKEN }}
          playwright_base_url: 'https://staging.example.com'
          run_codeql: 'true'
```

### Playwright against a live staging Worker

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: Latimer-Woods-Tech/factory/skills/global/testing@main
    with:
      node_auth_token: ${{ secrets.GITHUB_TOKEN }}
      run_vitest: 'false'          # skip unit tests if handled elsewhere
      playwright_base_url: ${{ vars.STAGING_URL }}
      playwright_browsers: 'chromium,firefox'
```

---

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `node_auth_token` | ✅ | — | GitHub token for `@latimer-woods-tech/*` package auth. Pass `${{ secrets.GITHUB_TOKEN }}`. |
| `node_version` | | `'22'` | Node.js major version. |
| `working_directory` | | `'.'` | Subdir to run commands in (useful in monorepos). |
| `run_vitest` | | `'true'` | Set to `'false'` to skip the vitest step. |
| `run_playwright` | | `'true'` | Set to `'false'` to skip Playwright / axe. |
| `playwright_browsers` | | `'chromium'` | Comma-separated browser names to install (e.g. `'chromium,firefox'`). |
| `playwright_base_url` | | `''` | Injected as `BASE_URL` env var. If empty, Playwright uses the value from `playwright.config.*`. |
| `run_codeql` | | `'false'` | Set to `'true'` to enable CodeQL. Calling workflow must have `security-events: write`. |
| `codeql_languages` | | `'javascript-typescript'` | CodeQL language identifiers (comma-separated). |

---

## How axe integration works

Axe violations surface as Playwright test failures. Your Playwright test files
import `@axe-core/playwright` and call `checkA11y` (or `AxeBuilder`). The
skill does **not** inject axe for you — your tests are responsible. This means
you control which pages and rules are checked, matching the pattern already
used in `apps/prime-self-smoke/tests/accessibility.spec.ts`.

Example test (copy-paste ready):

```typescript
// tests/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage — no critical/serious axe violations', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    // Exclude third-party iframes (e.g. Stripe, YouTube) that you don't control.
    // Remove this exclusion if your iframes are first-party and must be accessible.
    .exclude('iframe')
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(blocking).toHaveLength(0);
});
```

---

## Playwright report artifact

When Playwright tests fail, the action uploads the HTML report as
`playwright-report-<run_id>` (7-day retention). Download it from the
Actions run summary to inspect failure screenshots and traces.

---

## CodeQL notes

- CodeQL `init` runs **before** vitest and Playwright so the tool can observe
  the full execution for dataflow analysis.
- CodeQL `analyze` uploads SARIF results to the **Security → Code scanning**
  tab of the calling repository.
- The `security-extended` query suite is used, which adds higher-signal
  queries on top of the default set.
- For repositories with both JavaScript and Python, pass
  `codeql_languages: 'javascript-typescript,python'`.

---

## Relationship to `_app-ci.yml`

| Concern | `_app-ci.yml` | `skills/global/testing` |
|---|---|---|
| Type | Reusable workflow | Composite action |
| Typecheck | ✅ | — |
| Lint | ✅ | — |
| Build | ✅ | — |
| Vitest | ✅ (via `npm test`) | ✅ (dedicated step) |
| Playwright + axe | — | ✅ |
| CodeQL | — | ✅ (optional) |

Use both together — `_app-ci.yml` for typecheck / lint / build, this skill
for the full test + security suite — or adopt this skill stand-alone in a
dedicated `test.yml` workflow.

---

*Maintained by factory CODEOWNERS — open an issue labeled `area:ci` to propose changes.*
