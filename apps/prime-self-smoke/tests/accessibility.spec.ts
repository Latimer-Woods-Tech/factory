import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Accessibility gate — Phase 3
// Fail on critical or serious axe violations only (not moderate/minor).
// Pages tested: homepage, chart entry, pricing, practitioners, privacy, terms.
// ---------------------------------------------------------------------------

const PAGES: Array<{ name: string; path: string }> = [
  { name: 'Homepage', path: '/' },
  { name: 'Chart entry', path: '/?start=1' },
  { name: 'Pricing', path: '/pricing.html' },
  { name: 'Practitioners', path: '/practitioners.html' },
  { name: 'Privacy', path: '/privacy.html' },
  { name: 'Terms', path: '/terms.html' },
];

for (const { name, path } of PAGES) {
  test(`${name} — no critical/serious axe violations`, async ({ page }) => {
    await page.goto(path);
    // Wait for JS to complete initial render (cover any async mutations)
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      // Exclude third-party embeds that we cannot control
      .exclude('iframe')
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (blocking.length > 0) {
      const report = blocking
        .map(
          (v) =>
            `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
            v.nodes
              .slice(0, 3)
              .map((n) => `  → ${n.target.join(', ')}`)
              .join('\n'),
        )
        .join('\n\n');
      expect.soft(blocking).toHaveLength(0);
      console.error(`Axe violations on "${name}":\n${report}`);
    }

    // Assert after soft-checks so all pages always run
    expect(blocking).toHaveLength(0);
  });
}
