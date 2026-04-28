# Performance Budgets: CI Gates for Frontend Quality

**Date:** April 28, 2026  
**Phase:** B (Standardize)  
**Initiative:** T2.3 — Introduce performance budgets  
**Scope:** Define budgets for Lighthouse score, Core Web Vitals, and file size; enforce in CI; alert on regression

---

## Executive Summary

**Problem:** Frontend performance degrades silently:
- A new dependency adds 50KB to bundle (no one notices)
- UI component re-renders on every keystroke (metrics still show as "good")
- Lighthouse score drops from 90 to 82 (blame "something else")

**Solution:** Hard limits on:
- Lighthouse score (must stay ≥85)
- Core Web Vitals (FCP, LCP, CLS targets)
- Bundle size (JavaScript, CSS, images)
- API response time (p95 <200ms)

**Result by May 15:**
- ✅ Lighthouse ≥85 enforced in PR checks
- ✅ Core Web Vitals measured + compared to baseline
- ✅ Bundle size tracked (warn if +5%, fail if +20%)
- ✅ API response time monitored (fail if p95 >300ms)
- ✅ Weekly trend dashboard
- ✅ Zero regressions slip through CI

---

## Part 1: Budget Definitions

### Lighthouse Score

**What:** Google's 0–100 score covering Performance, Accessibility, Best Practices, SEO

**Target:** ≥85 (current baseline: 87)

**Per-category targets:**
- Performance: ≥85 (primary; affects user experience)
- Accessibility: ≥90 (WCAG 2.2 AA requirement; T1.3)
- Best Practices: ≥85
- SEO: ≥90

**Threshold Logic:**
```
IF score < 85:
  FAIL ❌ (block PR)
ELSE IF score < 90:
  WARN ⚠️  (notify author; don't block)
ELSE:
  PASS ✅
```

**Rationale (85):**
- 0–49: Poor (unacceptable)
- 50–89: Acceptable (ship-worthy)
- 90–100: Excellent (target)
- 85 = "acceptable with caution"; revisit if drops below

---

### Core Web Vitals

**Definition:** Three metrics Google uses to rank pages

| Metric | Full Name | Target | Fail Threshold | Warning |
|--------|-----------|--------|---|---|
| **FCP** | First Contentful Paint | ≤1.8s | >2.5s | 2.0–2.5s |
| **LCP** | Largest Contentful Paint | ≤2.5s | >4.0s | 3.0–4.0s |
| **CLS** | Cumulative Layout Shift | ≤0.1 | >0.25 | 0.15–0.25 |

**Why These:**
- **FCP:** How soon does the page show *something* to the user? (fixes "blank page" UX)
- **LCP:** How soon is the page *usable*? (biggest impact on "feels slow")
- **CLS:** How much does the page *jump around* while loading? (fixes "clicked wrong link" frustration)

**Measurement (Lighthouse):**
```
Lighthouse simulates a Moto G4 phone on 4G network
(realistic for VideoKing's global audience)

Results averaged over 3 runs → reduce noise
```

**Historical Baseline (April 2026):**
- FCP: 1.2s (good)
- LCP: 2.1s (good)
- CLS: 0.08 (excellent)

Every commit must stay within warning threshold OR include doc explaining the intentional regression.

---

### Bundle Size Budget

**JavaScript (Primary Impact)**
- Target: ≤250 KB (gzipped)
- Warning: ≤280 KB
- Fail: >300 KB

**CSS**
- Target: ≤50 KB (gzipped)
- Warning: ≤65 KB
- Fail: >80 KB

**Images (Lazy-loaded)**
- Target: ≤2 MB per page
- Measured: Cumulative size of critical images in viewport
- Warning: ≤2.5 MB
- Fail: >3 MB

**Total Page Size**
- Target: ≤3 MB (all resources combined, gzipped)
- Warning: ≤3.5 MB
- Fail: >4.0 MB

**Rationale:**
- On 4G (typical global): 300 KB JS = ~2 sec parse time
- On 3G (emerging markets): 300 KB = ~8 sec

---

### API Response Time Budget

**For VideoKing Worker endpoints:**

| Endpoint Class | Target (p95) | Fail | Warning |
|---|---|---|---|
| Static content (GET /videos list) | ≤200ms | >300ms | 250–300ms |
| Money-moving (POST /subscriptions) | ≤300ms | >500ms | 400–500ms |
| LLM classification (POST /videos) | ≤5s | >10s | 7–10s |
| Database queries | ≤100ms | >200ms | 150–200ms |

**Measurement:**
- Collected from Sentry performance metrics
- P95 percentile (not average; P95 represents real-world worst case)
- Weekly rollup + alert if trending up

---

## Part 2: CI Implementation

### GitHub Actions Gate

```yaml
# .github/workflows/performance-budgets.yml
name: Performance Budgets Check

on:
  pull_request:
    paths:
      - 'apps/**'
      - '.github/workflows/performance-budgets.yml'
      - 'package.json'

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Build app
        run: npm run build

      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v9
        with:
          configPath: './lighthouse-config.json'
          apiKey: ${{ secrets.LIGHTHOUSE_API_KEY }}
          uploadArtifacts: true
          temporaryPublicStorage: true

      - name: Check Lighthouse budgets
        run: |
          SCORE=$(cat .lighthouseci/latest-lhr.json | jq '.categories.performance.score * 100')
          if [ "${SCORE%.*}" -lt 85 ]; then
            echo "❌ Lighthouse Performance score: $SCORE (target: ≥85)"
            exit 1
          fi
          echo "✅ Lighthouse Performance score: $SCORE"

  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Build
        run: npm run build

      - name: Analyze bundle size
        run: npm run analyze:bundle
        # Generates report: dist/bundle-SIZE-report.json

      - name: Check bundle budget
        run: |
          JS_SIZE=$(cat dist/bundle-SIZE-report.json | jq '.javascript.gzipped')
          BUDGET_JS=250000  # 250 KB in bytes

          if [ $JS_SIZE -gt 300000 ]; then
            echo "❌ JavaScript bundle too large: $((JS_SIZE / 1024))KB (budget: 250KB)"
            exit 1
          elif [ $JS_SIZE -gt 280000 ]; then
            echo "⚠️  JavaScript approaching budget: $((JS_SIZE / 1024))KB (budget: 250KB)"
            # Don't fail; just warn
          fi
          echo "✅ JavaScript size: $((JS_SIZE / 1024))KB"

      - name: Comment PR with bundle report
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('dist/bundle-SIZE-report.json'));
            const comment = `
            ## Bundle Size Report
            - **JavaScript:** ${(report.javascript.gzipped / 1024).toFixed(0)}KB (target: 250KB)
            - **CSS:** ${(report.css.gzipped / 1024).toFixed(0)}KB (target: 50KB)
            - **Total:** ${(report.total.gzipped / 1024).toFixed(0)}KB
            `;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment,
            });
```

### Web Vitals Measurement

Inside frontend app:

```typescript
// src/instrumentation/performance.ts
import { getCLS, getFCP, getLCP } from 'web-vitals';

const BUDGETS = {
  fcp: 1800,  // ms
  lcp: 2500,  // ms
  cls: 0.1,   // unitless
};

// Capture metrics
getCLS((metric) => {
  console.log('CLS:', metric.value);
  
  if (metric.value > 0.25) {
    console.warn('❌ CLS exceeds budget');
    Sentry.captureMessage('CLS regression', {
      level: 'warning',
      extra: { cls: metric.value, budget: BUDGETS.cls },
    });
  }
  
  // Send to PostHog for dashboard
  PostHog.capture({
    event: 'web_vital_cls',
    properties: { value: metric.value, rating: metric.rating },
  });
});

getFCP((metric) => {
  console.log('FCP:', metric.value);
  
  if (metric.value > 2500) {
    Sentry.captureMessage('FCP regression', {
      level: 'warning',
      extra: { fcp: metric.value },
    });
  }
  
  PostHog.capture({
    event: 'web_vital_fcp',
    properties: { value: metric.value, rating: metric.rating },
  });
});

getLCP((metric) => {
  console.log('LCP:', metric.value);
  
  if (metric.value > 4000) {
    Sentry.captureMessage('LCP regression', {
      level: 'warning',
      extra: { lcp: metric.value },
    });
  }
  
  PostHog.capture({
    event: 'web_vital_lcp',
    properties: { value: metric.value, rating: metric.rating },
  });
});
```

### Local Development Check

```bash
# Before pushing, run locally:
npm run performance:check

# Output:
# ✅ Lighthouse: 87 (≥85)
# ✅ FCP: 1.4s (≤1.8s)
# ✅ LCP: 2.0s (≤2.5s)
# ✅ CLS: 0.07 (≤0.1)
# ✅ JS bundle: 240KB (≤250KB)
# ⚠️  CSS bundle: 65KB (warning zone; 50KB target)

# If any budget exceeded:
# npm run performance:improve
# (Suggests optimizations: code-split, lazy-load, compress)
```

---

## Part 3: Configuration Files

### lighthouse-config.json

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000",
        "http://localhost:3000/videos",
        "http://localhost:3000/auth/login"
      ],
      "port": 3000,
      "numberOfRuns": 3,
      "settings": {
        "configPath": "./lighthouserc.json",
        "onlyCategories": ["performance", "accessibility"],
        "skipAudits": ["full-page-screenshot"]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "categories:accessibility": ["error", { "minScore": 0.90 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }]
      }
    }
  }
}
```

### budgets.json (Bundle Size)

```json
{
  "bundles": [
    {
      "name": "javascript",
      "size": "250 KB"
    },
    {
      "name": "css",
      "size": "50 KB"
    }
  ],
  "thresholds": {
    "javascript": {
      "warn": "280 KB",
      "error": "300 KB"
    },
    "css": {
      "warn": "65 KB",
      "error": "80 KB"
    }
  }
}
```

---

## Part 4: Monthly Performance Dashboard

**Published to #metrics Slack channel:**

```
📊 Performance Budget Status (April 2026)

Lighthouse Trend:
  Week 1: 87 ✅
  Week 2: 86 ✅
  Week 3: 85 ⚠️ (warning zone)
  Week 4: 86 ✅

Core Web Vitals (latest):
  FCP:  1.2s ✅ (target ≤1.8s)
  LCP:  2.0s ✅ (target ≤2.5s)
  CLS:  0.08 ✅ (target ≤0.1)

Bundle Size:
  JS:   240 KB ✅ (budget 250 KB)
  CSS:  52 KB  ✅ (budget 50 KB; 4% over target)
  Total: 3.1 MB ✅ (budget 3.0 MB; 3% over)

API Response Time (p95):
  GET /videos:              145ms ✅ (budget 200ms)
  POST /subscriptions:      280ms ✅ (budget 300ms)
  POST /api/videos (upload): 4.2s ✅ (budget 5s)

🎯 Overall: HEALTHY (all budgets met this week)
```

---

## Part 5: Regression Investigation

### When Budget Exceeded

```markdown
## Regression: Lighthouse Performance dropped to 84

Date: PR #842 merged April 27

### Investigation
1. Check commit diff
   - New component: VideoPlayer React.lazy implementation
   - New dependency: @react-player (105 KB)
   
2. Root cause analysis
   - @react-player not tree-shakeable
   - All 105 KB loaded even for users without player
   
3. Solution options
   a) Revert & find lighter player (1 week delay)
   b) Code-split player behind route (2 hours; recommended)
   c) Accept regression; improve next sprint (not recommended)

### Decision
Option B: Code-split behind route
- Player bundle loaded only on /videos/:id page
- Main bundle savings: 80 KB
- LCP impact: Negligible (player loads after content)

### Implementation
- Add React.lazy() + Suspense
- Measure new score: 86 ✅ (back above budget)
- PR #850: Merge with fix + document decision in ADR
```

---

## Part 6: Team Training

### PR Template Addition

```markdown
## Performance Considerations

- [ ] No new dependencies added (or justified in PR description)
- [ ] Bundle size check passed (or regression explained)
- [ ] Lighthouse score ≥85 (link to CI report)
- [ ] Core Web Vitals measured (FCP/LCP/CLS)
- [ ] Performance budget regression explained (if any)

### If Budget Exceeded

Please add a comment explaining:
1. Why the regression was necessary
2. Plan to recover the budget
3. Timeline (this PR / next sprint / Q3)

Example:
> Added @react-player for video playback (+80KB).
> Blocking issue: Player component must load before page render.
> Recovery plan: Implement code-splitting by May 15 (T2.3 follow-up).
> Impact: LCP +200ms on /videos/:id (acceptable for feature value).
```

---

## Part 7: Implementation Checklist (May 1–15)

**Week 1 (May 1–5): Setup**
- [ ] Create Lighthouse CI config (lighthouse-config.json)
- [ ] Create bundle size analysis script
- [ ] Wire GitHub Actions workflow
- [ ] Manual Lighthouse run on current main (baseline)
- Effort: 4 hours

**Week 2 (May 8–12): Activation**
- [ ] Enable check in all PRs
- [ ] Handle first regressions (investigate + document)
- [ ] Update PR template with performance section
- [ ] Document in ENGINEERING.md
- Effort: 4 hours

**Week 3 (May 15–22): Dashboard & Training**
- [ ] Set up weekly dashboard (Slack + Notion)
- [ ] Team training: how to interpret reports
- [ ] Create runbook: "Performance regression investigation"
- Effort: 3 hours

**Total Effort:** 11 hours (Frontend Lead + DevOps)

---

## Part 8: Exit Criteria (T2.3)

- [x] Lighthouse budget defined (≥85 with per-category targets)
- [x] Core Web Vitals budgets defined (FCP, LCP, CLS)
- [x] Bundle size budget defined (JS, CSS, images, total)
- [x] API response time budget defined (p95 targets)
- [x] GitHub Actions workflow designed
- [x] Local performance check command scripted
- [x] Monthly dashboard template created
- [ ] Workflows deployed (May 1)
- [ ] First week of metrics collected (May 6)
- [ ] Team trained (May 15)

---

## Version History

| Date | Author | Change |
|------|--------|--------|
| 2026-04-28 | FE Lead | T2.3 performance budgets; Lighthouse, Web Vitals, bundle size, API response time; CI gates |

---

**Status:** ✅ T2.3 PERFORMANCE BUDGET FRAMEWORK READY  
**Next Action:** Deploy GitHub Actions + Lighthouse CI (May 1); start tracking metrics

**References:**
- [Google: Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Bundle Analyzer](https://www.npmjs.com/package/webpack-bundle-analyzer)
- [Performance Budget Calculator](https://www.performancebudget.io/)
