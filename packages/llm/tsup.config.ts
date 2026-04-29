import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  // Bundle all workspace-local packages so the published dist is self-contained.
  // Consumers don't need to install @adrper79-dot/errors or @adrper79-dot/logger
  // separately — they're inlined here.
  noExternal: [/@adrper79-dot\/.*/],
});
