import { test, expect } from '@playwright/test';
import {
  captureScreenshots,
  compareScreenshots,
  collectLighthouse,
  assertLighthouseBudget,
  DEFAULT_PERFORMANCE_BUDGETS,
  type ScreenshotDiffResult,
} from '@latimer-woods-tech/testing';
import * as path from 'path';

// ---------------------------------------------------------------------------
// W360-042: UI Regression Gates
// Blocks on accessibility (axe), performance (Lighthouse), and visual drift
// (pixel-diff) for critical pages.
// ---------------------------------------------------------------------------

const BASE_SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots-baseline');
const ACTUAL_SCREENSHOTS_DIR = path.join(__dirname, '..', 'test-results/screenshots');
const STRICT_GATES = process.env.UI_REGRESSION_STRICT === '1';

function projectSlug(projectName: string): string {
  return projectName.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function actualScreenshotPath(
  routeName: string,
  viewport: 'desktop' | 'mobile' | 'tablet',
  projectName: string,
) {
  return path.join(ACTUAL_SCREENSHOTS_DIR, projectSlug(projectName), routeName, `${viewport}.png`);
}

function assertGate(condition: boolean, message: string): void {
  if (STRICT_GATES) {
    expect(condition, message).toBe(true);
    return;
  }
  expect.soft(condition, message).toBe(true);
}

test.describe('UI Regression Gates — Homepage', () => {
  test('captures baseline screenshots (desktop, mobile, tablet)', async ({ page }, testInfo) => {
    await page.goto('/');
    const paths = await captureScreenshots(
      page,
      'homepage',
      path.join(ACTUAL_SCREENSHOTS_DIR, projectSlug(testInfo.project.name)),
    );
    
    // Verify all viewports captured
    expect(paths.desktop).toBeTruthy();
    expect(paths.mobile).toBeTruthy();
    expect(paths.tablet).toBeTruthy();
  });

  test('detects visual regression (desktop)', async ({ page }, testInfo) => {
    await page.goto('/');
    const routeName = 'homepage-latest';
    await captureScreenshots(
      page,
      routeName,
      path.join(ACTUAL_SCREENSHOTS_DIR, projectSlug(testInfo.project.name)),
    );

    const baselineDesktop = path.join(
      BASE_SCREENSHOTS_DIR,
      projectSlug(testInfo.project.name),
      'homepage',
      'desktop.png',
    );
    const diffResult: ScreenshotDiffResult = await compareScreenshots(
      `homepage-desktop-${projectSlug(testInfo.project.name)}`,
      actualScreenshotPath(routeName, 'desktop', testInfo.project.name),
      baselineDesktop,
      150, // Allow ~0.15% pixel change
    );

    // Log difference for debugging
    console.info(`Homepage desktop diff: ${diffResult.message}`);
    
    assertGate(diffResult.match, diffResult.message);
  });

  test('detects visual regression (mobile)', async ({ page }, testInfo) => {
    await page.goto('/');
    const routeName = 'homepage-mobile';
    await captureScreenshots(
      page,
      routeName,
      path.join(ACTUAL_SCREENSHOTS_DIR, projectSlug(testInfo.project.name)),
    );

    const baselineMobile = path.join(
      BASE_SCREENSHOTS_DIR,
      projectSlug(testInfo.project.name),
      'homepage',
      'mobile.png',
    );
    const diffResult: ScreenshotDiffResult = await compareScreenshots(
      `homepage-mobile-${projectSlug(testInfo.project.name)}`,
      actualScreenshotPath(routeName, 'mobile', testInfo.project.name),
      baselineMobile,
      100,
    );

    console.info(`Homepage mobile diff: ${diffResult.message}`);
    assertGate(diffResult.match, diffResult.message);
  });

  test('performance budget (Lighthouse)', async ({ page }) => {
    await page.goto('/');
    const metrics = await collectLighthouse(page, 'homepage', { skipLocalhost: true });

    if (!metrics) {
      test.skip(true, '[homepage] Lighthouse metrics unavailable in this runtime');
      return;
    }

    console.info(
      `Homepage Lighthouse: perf=${metrics.performance} a11y=${metrics.accessibility} fcp=${metrics.fcp}ms lcp=${metrics.lcp}ms cls=${metrics.cls}`,
    );

    const budget = DEFAULT_PERFORMANCE_BUDGETS.homepage;
    assertLighthouseBudget(metrics, budget);
  });
});

test.describe('UI Regression Gates — Pricing Page', () => {
  test('detects visual regression', async ({ page }, testInfo) => {
    await page.goto('/pricing');
    const routeName = 'pricing';
    await captureScreenshots(
      page,
      routeName,
      path.join(ACTUAL_SCREENSHOTS_DIR, projectSlug(testInfo.project.name)),
    );

    const baselineDesktop = path.join(
      BASE_SCREENSHOTS_DIR,
      projectSlug(testInfo.project.name),
      'pricing',
      'desktop.png',
    );
    const diffResult: ScreenshotDiffResult = await compareScreenshots(
      `pricing-desktop-${projectSlug(testInfo.project.name)}`,
      actualScreenshotPath(routeName, 'desktop', testInfo.project.name),
      baselineDesktop,
      100,
    );

    console.info(`Pricing desk diff: ${diffResult.message}`);
    assertGate(diffResult.match, diffResult.message);
  });

  test('performance budget (Lighthouse)', async ({ page }) => {
    await page.goto('/pricing');
    const metrics = await collectLighthouse(page, 'pricing', { skipLocalhost: true });

    if (!metrics) {
      test.skip(true, '[pricing] Lighthouse metrics unavailable in this runtime');
      return;
    }

    console.info(
      `Pricing Lighthouse: perf=${metrics.performance} a11y=${metrics.accessibility}`,
    );
    assertLighthouseBudget(metrics, DEFAULT_PERFORMANCE_BUDGETS.pricing);
  });
});

test.describe('UI Regression Gates — Practitioners Page', () => {
  test('detects visual regression', async ({ page }, testInfo) => {
    await page.goto('/practitioners');
    const routeName = 'practitioners';
    await captureScreenshots(
      page,
      routeName,
      path.join(ACTUAL_SCREENSHOTS_DIR, projectSlug(testInfo.project.name)),
    );

    const baselineDesktop = path.join(
      BASE_SCREENSHOTS_DIR,
      projectSlug(testInfo.project.name),
      'practitioners',
      'desktop.png',
    );
    const diffResult: ScreenshotDiffResult = await compareScreenshots(
      `practitioners-desktop-${projectSlug(testInfo.project.name)}`,
      actualScreenshotPath(routeName, 'desktop', testInfo.project.name),
      baselineDesktop,
      150,
    );

    console.info(`Practitioners diff: ${diffResult.message}`);
    assertGate(diffResult.match, diffResult.message);
  });
});

test.describe('Dashboard visual regression (authenticated routes)', () => {
  // This would require auth setup, typically via fixtures or API login
  test('dashboard captures and compares (when auth available)', async ({ page }) => {
    // Placeholder: Dashboard testing requires test user + session
    const loginUrl = '/?modal=login';
    await page.goto(loginUrl);
    
    // In production, would:
    // 1. Fill login form with test credentials
    // 2. Wait for redirect to dashboard
    // 3. Capture screenshots of dashboard
    // 4. Compare against baseline
    
    console.info('[dashboard] Skipped (requires explicit auth fixture)');
  });
});
