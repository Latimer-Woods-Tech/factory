import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // RATCHET: floored for 0.1.0 per factory TECH_DEBT DEBT-005.
      // Raise to lines:90/functions:90/branches:85 once D1 binding stub + 
      // provider-specific cost paths gain dedicated tests.
      thresholds: { lines: 80, functions: 85, branches: 70 },
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/types.ts'],
    },
  },
});
