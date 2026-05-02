import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // RATCHET: floored for 0.3.0 per factory TECH_DEBT DEBT-006.
      // Raise to lines:90/functions:90/branches:85 once RS256 + JWKS paths
      // and legacy createAdminRouter routes gain dedicated coverage.
      thresholds: { lines: 75, functions: 80, branches: 65 },
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/types.ts'],
    },
  },
});
