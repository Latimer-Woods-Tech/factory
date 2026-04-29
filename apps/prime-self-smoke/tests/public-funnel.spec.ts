import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'https://selfprime.net';
const API_BASE = process.env.API_BASE_URL ?? 'https://api.selfprime.net';

// ---------------------------------------------------------------------------
// Public funnel — no credentials required
// ---------------------------------------------------------------------------

test.describe('Homepage', () => {
  test('loads with correct title and hero copy', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Prime Self/);
    await expect(page.locator('body')).toContainText('Prime Self');
  });

  test('hero CTA "Get your free chart" is visible and clickable', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('button', { name: /get your free chart/i });
    await expect(cta).toBeVisible();
    await cta.click();
    // Should navigate to /?start=1
    await expect(page).toHaveURL(/start=1/);
  });

  test('"Sign In" button opens login modal inline (no navigation)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    const modal = page.locator('#login-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('modal closes when backdrop is clicked', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    const modal = page.locator('#login-modal');
    await expect(modal).toBeVisible();
    await modal.click({ position: { x: 10, y: 10 } }); // click backdrop
    await expect(modal).not.toHaveClass(/open/);
  });
});

// ---------------------------------------------------------------------------
// Route redirects — Phase 1 fix verification
// ---------------------------------------------------------------------------

test.describe('Route redirects', () => {
  test('/login redirects to /?modal=login and auto-opens the modal', async ({ page }) => {
    const response = await page.goto('/login');
    // Should land on /?modal=login after redirect
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/modal=login/);
    await expect(page.locator('#login-modal')).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
  });

  test('/dashboard redirects to /?start=1', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/start=1/);
  });

  test('/sign-in redirects to /?modal=login', async ({ page }) => {
    const response = await page.goto('/sign-in');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/modal=login/);
  });
});

// ---------------------------------------------------------------------------
// Marketing pages
// ---------------------------------------------------------------------------

test.describe('Marketing pages', () => {
  test('pricing page loads with plan copy', async ({ page }) => {
    await page.goto('/pricing.html');
    await expect(page).toHaveTitle(/pricing/i);
  });

  test('practitioners page loads', async ({ page }) => {
    await page.goto('/practitioners.html');
    await expect(page).toHaveTitle(/Practitioner/i);
  });

  test('privacy policy loads', async ({ page }) => {
    await page.goto('/privacy.html');
    await expect(page.locator('body')).toContainText('Privacy');
  });

  test('terms loads', async ({ page }) => {
    await page.goto('/terms.html');
    await expect(page.locator('body')).toContainText('Term');
  });
});

// ---------------------------------------------------------------------------
// Chart input flow — public, no auth
// ---------------------------------------------------------------------------

test.describe('Chart flow entry', () => {
  test('/?start=1 renders chart input form', async ({ page }) => {
    await page.goto('/?start=1');
    await expect(page).toHaveTitle(/Prime Self/);
    // The chart wizard should be visible — check for the form or key heading
    const body = page.locator('body');
    await expect(body).toContainText(/birth|chart|blueprint|date/i);
  });
});

// ---------------------------------------------------------------------------
// API health
// ---------------------------------------------------------------------------

test.describe('API health', () => {
  test('api.selfprime.net/api/health returns ok', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('Worker health returns ok with env field', async ({ request }) => {
    const workerUrl = process.env.WORKER_URL ?? 'https://prime-self.adrper79.workers.dev';
    const response = await request.get(`${workerUrl}/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.env).toBe('production');
  });
});

// ---------------------------------------------------------------------------
// Authenticated flow — skipped unless SMOKE_EMAIL + SMOKE_PASSWORD are set
// ---------------------------------------------------------------------------

test.describe('Authenticated flow', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      !process.env.SMOKE_EMAIL || !process.env.SMOKE_PASSWORD,
      'SMOKE_EMAIL / SMOKE_PASSWORD not configured — skipping authenticated tests',
    );
  });

  test('logs in with test credentials and sees chart screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.locator('#login-email').fill(process.env.SMOKE_EMAIL!);
    await page.locator('#login-password').fill(process.env.SMOKE_PASSWORD!);
    await page.locator('#login-form').locator('button[type=submit]').click();
    // After login, page should redirect to /?start=1
    await expect(page).toHaveURL(/start=1/, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(/blueprint|chart|reading/i);
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.locator('#login-email').fill('invalid@example.com');
    await page.locator('#login-password').fill('wrongpassword123');
    await page.locator('#login-form').locator('button[type=submit]').click();
    await expect(page.locator('#login-error')).toBeVisible({ timeout: 8_000 });
  });
});
