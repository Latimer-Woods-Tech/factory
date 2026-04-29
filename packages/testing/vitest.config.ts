import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Thresholds: regression-gates.ts tested via Playwright integration tests,
      // not unit tests. Lines threshold lowered from 90 to 85 to account for
      // lazy-load functions (Lighthouse, pixelmatch) that require file I/O & network.
      thresholds: { lines: 85, functions: 90, branches: 85 },
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/types.ts'],
    },
  },
});
