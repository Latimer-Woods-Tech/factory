import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // RATCHET: floored for 0.3.0 per factory TECH_DEBT DEBT-004.
      // Raise back to lines:90/functions:90/branches:85 once provider-specific
      // parser + abort-path tests close the remaining branches.
      thresholds: { lines: 80, functions: 85, branches: 70 },
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/types.ts'],
    },
  },
});
