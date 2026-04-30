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

  test('hero CTA "Get your free chart" is visible and routes to the auth overlay entry', async ({ page }) => {
    await page.goto('/');
    const cta = page.getByRole('link', { name: /get your free chart/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    // Should navigate to /?start=1
    await expect(page).toHaveURL(/start=1/);
  });

  test('auth entry renders the sign-in overlay contract at /?start=1', async ({ page }) => {
    await page.goto('/?start=1');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
    await expect(page.locator('#auth-password, input[name="password"], input[type="password"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Route redirects — Phase 1 fix verification
// ---------------------------------------------------------------------------

test.describe('Route redirects', () => {
  test('/login redirects to an auth-entry URL', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/(modal=login|start=1)/);
  });

  test('/dashboard redirects to /?start=1', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/start=1/);
  });

  test('/sign-in redirects to an auth-entry URL', async ({ page }) => {
    const response = await page.goto('/sign-in');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/(modal=login|start=1)/);
  });
});

// ---------------------------------------------------------------------------
// Marketing pages
// ---------------------------------------------------------------------------

test.describe('Marketing pages', () => {
  test('pricing page loads with plan copy', async ({ page }) => {
    await page.goto('/pricing.html');
    expect(page.url()).toContain('pricing.html');
    await expect(page).toHaveTitle(/Prime Self/i);
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
  test('/?start=1 renders the auth or chart-entry surface', async ({ page }) => {
    await page.goto('/?start=1');
    await expect(page).toHaveTitle(/Prime Self/);
    const body = page.locator('body');
    await expect(body).toContainText(/sign in|birth|chart|blueprint|date/i);
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
    await page.goto('/?start=1');
    await page.locator('input[name="email"], input[type="email"]').fill(process.env.SMOKE_EMAIL!);
    await page.locator('#auth-password, input[name="password"], input[type="password"]').fill(process.env.SMOKE_PASSWORD!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.locator('body')).toContainText(/blueprint|chart|reading|today|relationships|more/i, { timeout: 10_000 });
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/?start=1');
    await page.locator('input[name="email"], input[type="email"]').fill('invalid@example.com');
    await page.locator('#auth-password, input[name="password"], input[type="password"]').fill('wrongpassword123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.locator('#auth-error')).toBeVisible({ timeout: 8_000 });
  });
});
