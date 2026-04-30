import { test, expect } from '@playwright/test';

const USER_ROUTES = ['home', 'blueprint', 'today', 'relationships', 'more'] as const;
const PRACTITIONER_ROUTES = ['prac-dashboard', 'prac-clients', 'prac-sessions', 'prac-deliver', 'prac-more'] as const;
const API_BASE = process.env.API_BASE_URL ?? 'https://api.selfprime.net';

const userEmail = process.env.SMOKE_USER_EMAIL ?? '';
const userPassword = process.env.SMOKE_USER_PASSWORD ?? '';
const practitionerEmail = process.env.SMOKE_PRACTITIONER_EMAIL ?? '';
const practitionerPassword = process.env.SMOKE_PRACTITIONER_PASSWORD ?? '';
const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  const loginResponse = await page.request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
  });
  expect(loginResponse.status()).toBe(200);

  const meResponse = await page.request.get(`${API_BASE}/api/auth/me`);
  expect(meResponse.status()).toBe(200);
  const me = await meResponse.json();
  expect(me?.user?.email).toBe(email.toLowerCase());
}

test.describe('Workspace Contract', () => {
  test.beforeAll(() => {
    if (!isCi) return;

    const requiredVars = [
      'SMOKE_USER_EMAIL',
      'SMOKE_USER_PASSWORD',
      'SMOKE_PRACTITIONER_EMAIL',
      'SMOKE_PRACTITIONER_PASSWORD',
    ];
    const missingVars = requiredVars.filter((name) => !process.env[name]);

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required CI smoke credentials for workspace contract tests: ${missingVars.join(', ')}`,
      );
    }
  });

  test('destination handoff URL reaches auth surface (not marketing dead-end)', async ({ page }) => {
    await page.goto('/?destination=practitioner');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText(/sign in/i);
  });

  test('authenticated user can discover and reach personal tools', async ({ page }) => {
    test.skip(!userEmail || !userPassword, 'Set SMOKE_USER_EMAIL and SMOKE_USER_PASSWORD for personal workspace contract tests.');

    await page.goto('/?start=1');
    await login(page, userEmail, userPassword);

    for (const route of USER_ROUTES) {
      await page.evaluate((r) => { window.location.hash = `#/${r}`; }, route);
      await expect(page).toHaveURL(new RegExp(`#/${route}$`), { timeout: 10_000 });
    }
  });

  test('authenticated practitioner lands in practitioner workspace and reaches practitioner tools', async ({ page }) => {
    test.skip(
      !practitionerEmail || !practitionerPassword,
      'Set SMOKE_PRACTITIONER_EMAIL and SMOKE_PRACTITIONER_PASSWORD for practitioner workspace contract tests.',
    );

    await page.goto('/?destination=practitioner');
    await login(page, practitionerEmail, practitionerPassword);

    for (const route of PRACTITIONER_ROUTES) {
      await page.evaluate((r) => { window.location.hash = `#/${r}`; }, route);
      await expect(page).toHaveURL(new RegExp(`#/${route}$`), { timeout: 10_000 });
    }
  });
});