import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'https://selfprime.net';
const API_BASE = process.env.API_BASE_URL ?? 'https://api.selfprime.net';
const smokeUserEmail = process.env.SMOKE_USER_EMAIL ?? '';
const smokeUserPassword = process.env.SMOKE_USER_PASSWORD ?? '';
const visibleEmailInput = 'input[name="email"]:visible, input[type="email"]:visible';
const visiblePasswordInput = '#auth-password:visible, input[name="password"]:visible, input[type="password"]:visible';

async function ensureAuthFormOpen(page: import('@playwright/test').Page) {
  if ((await page.locator(visibleEmailInput).count()) > 0) return;

  const signInButton = page.getByRole('button', { name: /sign in/i }).first();
  const signInLink = page.getByRole('link', { name: /sign in/i }).first();

  if (await signInButton.isVisible().catch(() => false)) {
    await signInButton.click();
  } else if (await signInLink.isVisible().catch(() => false)) {
    await signInLink.click();
  } else {
    await page.goto('/?start=1');
  }

  if ((await page.locator(visibleEmailInput).count()) === 0) {
    await page.goto('/?start=1');
  }

  await expect(page.locator(visibleEmailInput).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(visiblePasswordInput).first()).toBeVisible({ timeout: 15_000 });
}

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
    await expect(page).toHaveURL(/(start=1|pricing#free-chart)/);
  });

  test('auth entry renders the sign-in overlay contract at /?start=1', async ({ page }) => {
    await page.goto('/?destination=practitioner');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Route redirects — Phase 1 fix verification
// ---------------------------------------------------------------------------

test.describe('Route redirects', () => {
  test('/login redirects to an auth-entry URL', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/(auth=required|modal=login|start=1)/);
  });

  test('/dashboard redirects to /?start=1', async ({ page }) => {
    const response = await page.goto('/dashboard');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/(auth=required|start=1)/);
  });

  test('/sign-in redirects to an auth-entry URL', async ({ page }) => {
    const response = await page.goto('/sign-in');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/(auth=required|modal=login|start=1)/);
  });
});

// ---------------------------------------------------------------------------
// Marketing pages
// ---------------------------------------------------------------------------

test.describe('Marketing pages', () => {
  test('pricing page loads with plan copy', async ({ page }) => {
    await page.goto('/pricing');
    expect(page.url()).toContain('/pricing');
    await expect(page).toHaveTitle(/Prime Self/i);
  });

  test('practitioners page loads', async ({ page }) => {
    await page.goto('/practitioners');
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
// CSP / SRI / static-asset integrity
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate a browser-blocked CSP or SRI violation in the
 * console.  Matches Chrome/Firefox/Safari wording.
 */
const CSP_VIOLATION_RE =
  /refused to (load|execute|apply|connect)|content security policy|violates the following|sri.*integrity|integrity.*sha|blocked by.*csp/i;

/** First-party JS files that must exist on the pricing page. */
const REQUIRED_PRICING_JS = ['/js/pricing-schema.js', '/js/trust-proof-content.js'];

/** Normalised origin of BASE (e.g. "https://selfprime.net") for exact-origin comparison. */
const BASE_ORIGIN = new URL(BASE).origin;

function attachCspListener(page: Page): () => string[] {
  const blockedMessages: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (CSP_VIOLATION_RE.test(text)) {
      blockedMessages.push(`[${msg.type()}] ${text}`);
    }
  });
  // SecurityError thrown when a blocked script body is evaluated
  page.on('pageerror', (err) => {
    if (CSP_VIOLATION_RE.test(err.message)) {
      blockedMessages.push(`[pageerror] ${err.message}`);
    }
  });
  return () => blockedMessages;
}

function assertNoViolations(violations: string[], label: string): void {
  expect(violations, `${label}:\n  ${violations.join('\n  ')}`).toHaveLength(0);
}

test.describe('CSP and static-asset integrity', () => {
  test('/ — no CSP/SRI blocked-script console errors', async ({ page }) => {
    const getBlocked = attachCspListener(page);
    await page.goto('/');
    // networkidle may never fire on pages with long-poll/SSE — domcontentloaded
    // guarantees all synchronously-loaded scripts have been evaluated.
    await page.waitForLoadState('domcontentloaded');
    assertNoViolations(getBlocked(), 'CSP/SRI violation(s) on /');
  });

  test('/pricing — no CSP/SRI blocked-script console errors', async ({ page }) => {
    const getBlocked = attachCspListener(page);
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');
    assertNoViolations(getBlocked(), 'CSP/SRI violation(s) on /pricing');
  });

  test('pricing page — required first-party JS assets return 200 (no 404)', async ({ page }) => {
    const notFound: string[] = [];

    page.on('response', (response) => {
      // Guard against subdomain-bypass: compare origin strictly, not startsWith on the raw URL.
      const parsed = new URL(response.url());
      if (parsed.origin === BASE_ORIGIN && response.status() === 404) {
        if (REQUIRED_PRICING_JS.includes(parsed.pathname)) {
          notFound.push(`${parsed.pathname} → 404`);
        }
      }
    });

    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    // Explicitly probe each required asset so the test fails even when the
    // <script> tag referencing it has already been removed from the page.
    for (const asset of REQUIRED_PRICING_JS) {
      const response = await page.request.get(`${BASE_ORIGIN}${asset}`);
      if (response.status() === 404) {
        notFound.push(`${asset} → 404 (direct probe)`);
      }
    }

    assertNoViolations(notFound, 'First-party JS 404s on /pricing');
  });
});

// ---------------------------------------------------------------------------
// Authenticated flow — skipped unless SMOKE_USER_EMAIL + SMOKE_USER_PASSWORD are set
// ---------------------------------------------------------------------------

test.describe('Authenticated flow', () => {
  test.beforeEach(() => {
    test.skip(
      !smokeUserEmail || !smokeUserPassword,
      'SMOKE_USER_EMAIL / SMOKE_USER_PASSWORD not configured — skipping authenticated tests',
    );
  });

  test('logs in with test credentials and sees chart screen', async ({ page }) => {
    await page.goto('/?destination=practitioner');
    await expect(page.getByRole('heading', { name: /sign in/i }).first()).toBeVisible({ timeout: 15_000 });
    await ensureAuthFormOpen(page);
    await page.locator(visibleEmailInput).first().fill(smokeUserEmail);
    await page.locator(visiblePasswordInput).first().fill(smokeUserPassword);
    const modal = page.locator('#login-modal');
    await modal.locator('button[type="submit"], button:has-text("Sign in")').first().click();
    await expect(page.locator('body')).toContainText(/blueprint|chart|reading|today|relationships|more/i, { timeout: 20_000 });
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/?destination=practitioner');
    await expect(page.getByRole('heading', { name: /sign in/i }).first()).toBeVisible({ timeout: 15_000 });
    await ensureAuthFormOpen(page);
    await page.locator(visibleEmailInput).first().fill('invalid@example.com');
    await page.locator(visiblePasswordInput).first().fill('wrongpassword123');
    const modal = page.locator('#login-modal');
    await modal.locator('button[type="submit"], button:has-text("Sign in")').first().click();
    await expect(modal).toContainText(/invalid|incorrect|unauthorized|error|try again/i, { timeout: 8_000 });
  });
});
