import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  // Prevent drizzle-orm and the Neon serverless driver from being bundled;
  // consuming apps must install them as direct dependencies.
  external: ['drizzle-orm', '@neondatabase/serverless'],
});
