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
  // Consumers don't need to install @latimer-woods-tech/errors or @latimer-woods-tech/logger
  // separately — they're inlined here.
  noExternal: [/@adrper79-dot\/.*/],
});
