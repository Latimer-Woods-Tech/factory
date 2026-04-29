import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

// ---------------------------------------------------------------------------
// W360-042: UI Regression Gates Configuration
// Extends base Playwright config with screenshot storage and Lighthouse
// settings for multi-viewport visual regression + performance monitoring.
// ---------------------------------------------------------------------------

export default defineConfig({
  testDir: './tests',
  // Increased timeout for Lighthouse collection (can take 10-15s on slow networks)
  timeout: 45_000,
  retries: 1,
  workers: 2,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://selfprime.net',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  // W360-042: All screenshots stored here for regression comparison
  snapshotDir: path.join(__dirname, 'screenshots-baseline'),
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-{platform}{ext}',

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // W360-042: Global setup/teardown can be added here for baseline management
  // globalSetup: require.resolve('./playwright-global-setup.ts'),
});
