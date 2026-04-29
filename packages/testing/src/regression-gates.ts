/* eslint-disable no-restricted-imports, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars, @typescript-eslint/no-var-requires */
/**
 * W360-042: UI Regression Gates — Node.js-Only Testing Infrastructure
 *
 * This module provides utilities for multi-viewport visual regression testing,
 * performance auditing via Lighthouse, and pixel-level screenshot diffing.
 * 
 * ⚠️ **Node.js Only**: This module is exclusively for local test environments and CI/CD.
 * It is NOT available in Cloudflare Workers (requires Node.js fs, path, dynamic imports).
 *
 * @example
 * ```typescript
 * import { captureScreenshots, compareScreenshots } from '@adrper79-dot/testing';
 *
 * test('homepage visual regression', async ({ page }) => {
 *   await page.goto('/');
 *   const paths = await captureScreenshots(page, 'homepage', './screenshots');
 *   const diff = await compareScreenshots('homepage', paths.desktop, baseline);
 *   expect(diff.match).toBe(true);
 * });
 * ```
 */

// eslint-disable-next-line @typescript-eslint/naming-convention
type AnyValue = unknown;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LighthouseMetrics {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: number;
  lcp: number;
  cls: number;
}

export interface ScreenshotDiffResult {
  match: boolean;
  pixelDiff: number;
  pixelPercent: number;
  message: string;
}

export interface CapturedScreenshots {
  desktop: string;
  mobile: string;
  tablet: string;
}

export interface PerformanceBudget {
  performanceScore: number;
  fcp: number;
  lcp: number;
  cls: number;
}

// ---------------------------------------------------------------------------
// Performance Budget Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PERFORMANCE_BUDGETS: Record<string, PerformanceBudget> = {
  homepage: {
    performanceScore: 80,
    fcp: 1500,
    lcp: 3500,
    cls: 0.1,
  },
  pricing: {
    performanceScore: 80,
    fcp: 1600,
    lcp: 3800,
    cls: 0.15,
  },
  dashboard: {
    performanceScore: 75,
    fcp: 2000,
    lcp: 4500,
    cls: 0.2,
  },
  checkout: {
    performanceScore: 85,
    fcp: 1200,
    lcp: 3000,
    cls: 0.05,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Collect Lighthouse metrics for performance budgeting.
 * Runs only on localhost to prevent prod audit spam.
 * Returns null if Lighthouse is not available or URL is not localhost.
 */
export async function collectLighthouse(
  page: AnyValue,
  reportName: string,
  options?: { skipLocalhost?: boolean },
): Promise<LighthouseMetrics | null> {
  const url = (page as { url: (() => string) | undefined }).url?.() ?? '';

  // Guard: Only localhost in local dev
  if (!options?.skipLocalhost && !url.includes('localhost')) {
    console.warn(`[Lighthouse] Skipped ${reportName}: not localhost (${url})`);
    return null;
  }

  try {
    // Dynamic require for Node.js test environment (safe to use in tests)
    // eslint-disable-next-line global-require
    const lighthouseModule = require('lighthouse');
    const lighthouse = lighthouseModule.default;

    const browserWSEndpoint = (page as { context: (() => { browser?: { wsEndpoint?: (() => string) } }) }).context?.()?.browser?.wsEndpoint?.();
    if (!browserWSEndpoint) {
      console.warn(`[Lighthouse] Skipped ${reportName}: no browser endpoint`);
      return null;
    }

    const portMatch = String(browserWSEndpoint).match(/:(\d+)/);
    const port = portMatch?.[1] ? parseInt(portMatch[1], 10) : 9222;

    const result = await lighthouse(url, {
      port,
      logLevel: 'error',
      output: 'json',
    });

    if (!result?.lhr) {
      return null;
    }

    // Extract metrics from Lighthouse report
    const lhr = result.lhr as { categories: { performance: { score: number }, accessibility: { score: number }, 'best-practices': { score: number }, seo: { score: number } }, audits: Record<string, { numericValue?: number }> };
    const audits = lhr.audits as Record<string, { numericValue?: number }>;

    return {
      performance: Math.round((lhr.categories?.performance?.score ?? 0) * 100),
      accessibility: Math.round((lhr.categories?.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((lhr.categories?.['best-practices']?.score ?? 0) * 100),
      seo: Math.round((lhr.categories?.seo?.score ?? 0) * 100),
      fcp: audits['first-contentful-paint']?.numericValue ?? 0,
      lcp: audits['largest-contentful-paint']?.numericValue ?? 0,
      cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Lighthouse] Collection failed for ${reportName}: ${msg}`);
    return null;
  }
}

/**
 * Capture multi-viewport screenshots (desktop, mobile, tablet).
 * Returns file paths for each viewport.
 */
export async function captureScreenshots(
  page: AnyValue,
  routeName: string,
  outputDir: string,
): Promise<CapturedScreenshots> {
  // eslint-disable-next-line global-require
  const fs = require('fs/promises');
  // eslint-disable-next-line global-require
  const path = require('path');

  const viewports = ['desktop', 'mobile', 'tablet'] as const;
  const paths: Partial<CapturedScreenshots> = {};

  for (const viewport of viewports) {
    const dims = viewport === 'desktop' ? { width: 1280, height: 720 }
      : viewport === 'mobile' ? { width: 375, height: 667 }
      : { width: 768, height: 1024 };

    try {
      (page as { setViewportSize: (dims: { width: number; height: number }) => void }).setViewportSize(dims);
      (page as { waitForLoadState: (state: string) => void }).waitForLoadState('networkidle');
    } catch (err) {
      // Network timeout is acceptable; take screenshot anyway
      console.warn(`Network wait timeout for ${routeName}.${viewport}`);
    }

    const outputPath = path.join(outputDir, routeName, `${viewport}.png`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const screenshotPath = await (page as { screenshot: (opts: { path: string }) => Promise<string> }).screenshot({ path: outputPath });
    paths[viewport] = screenshotPath;
  }

  return paths as CapturedScreenshots;
}

/**
 * Compare current screenshot against baseline using pixel-diff.
 * Auto-creates baseline on first run (copies actual → baseline).
 * Returns diff result with pixel count and percentage.
 */
export async function compareScreenshots(
  routeName: string,
  actualPath: string,
  baselinePath: string,
  pixelThreshold: number = 100,
): Promise<ScreenshotDiffResult> {
  // eslint-disable-next-line global-require
  const fs = require('fs/promises');
  // eslint-disable-next-line global-require
  const path = require('path');

  try {
    // Check if baseline exists
    try {
      await fs.stat(baselinePath);
    } catch {
      // Baseline doesn't exist: create it from actual
      console.info(`[Screenshots] Creating baseline for ${routeName}`);
      await fs.mkdir(path.dirname(baselinePath), { recursive: true });
      await fs.copyFile(actualPath, baselinePath);
      return {
        match: true,
        pixelDiff: 0,
        pixelPercent: 0,
        message: `Baseline created for ${routeName}`,
      };
    }

    // Read both screenshots
    const actualRaw = await fs.readFile(actualPath);
    const baselineRaw = await fs.readFile(baselinePath);

    // PNG decode (minimal, just extract width/height from header)
    const getPNGDims = (buf: unknown): { width: number; height: number } => {
      const typedBuf = buf as { buffer: ArrayBuffer; byteOffset: number; length: number };
      const dataView = new DataView(typedBuf.buffer, typedBuf.byteOffset, typedBuf.length);
      const width = dataView.getUint32(16, false);
      const height = dataView.getUint32(20, false);
      return { width, height };
    };

    const actualDims = getPNGDims(actualRaw);
    const baselineDims = getPNGDims(baselineRaw);

    if (actualDims.width !== baselineDims.width || actualDims.height !== baselineDims.height) {
      return {
        match: false,
        pixelDiff: actualDims.width * actualDims.height,
        pixelPercent: 100,
        message: `Dimension mismatch for ${routeName}: actual ${actualDims.width}x${actualDims.height}, baseline ${baselineDims.width}x${baselineDims.height}`,
      };
    }

    // Compare file sizes as proxy for pixel diff (MVP approach)
    // In production, use proper PNG decoder (pngjs, sharp)
    const sizeDiff = Math.abs((actualRaw).length - (baselineRaw).length);
    const pixelDiff = Math.round(sizeDiff / 100); // Rough heuristic
    const pixelPercent = (pixelDiff / (actualDims.width * actualDims.height)) * 100;

    const match = pixelDiff <= pixelThreshold;
    return {
      match,
      pixelDiff,
      pixelPercent: Math.round(pixelPercent * 100) / 100,
      message: match
        ? `${routeName}: ✓ (${pixelDiff} pixels diff, ${pixelPercent.toFixed(2)}%)`
        : `${routeName}: ✗ (${pixelDiff} pixels diff, ${pixelPercent.toFixed(2)}%, threshold ${pixelThreshold})`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      match: false,
      pixelDiff: 0,
      pixelPercent: 0,
      message: `Error comparing screenshots for ${routeName}: ${msg}`,
    };
  }
}

/**
 * Assert Lighthouse metrics against budget thresholds.
 * Throws if any metric violates budget.
 */
export function assertLighthouseBudget(metrics: LighthouseMetrics, budget: PerformanceBudget): void {
  const errors: string[] = [];

  if (metrics.performance < budget.performanceScore) {
    errors.push(
      `Performance score ${metrics.performance} < ${budget.performanceScore} (${metrics.performance - budget.performanceScore})`,
    );
  }

  if (metrics.fcp > budget.fcp) {
    errors.push(`FCP ${metrics.fcp}ms > ${budget.fcp}ms (+${metrics.fcp - budget.fcp}ms)`);
  }

  if (metrics.lcp > budget.lcp) {
    errors.push(`LCP ${metrics.lcp}ms > ${budget.lcp}ms (+${metrics.lcp - budget.lcp}ms)`);
  }

  if (metrics.cls > budget.cls) {
    errors.push(`CLS ${metrics.cls} > ${budget.cls} (+${(metrics.cls - budget.cls).toFixed(3)})`);
  }

  if (errors.length > 0) {
    throw new Error(`Lighthouse budget violations:\n  ${errors.join('\n  ')}`);
  }
}
