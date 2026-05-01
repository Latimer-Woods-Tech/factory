import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // DEBT (ratchet rule): regression-gates.ts is barely covered by unit tests because it's exercised via Playwright integration. Floor thresholds to current reality; raise as new tests land.
      thresholds: { lines: 65, functions: 85, branches: 65 },
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/types.ts'],
    },
  },
});
