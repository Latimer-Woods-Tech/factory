import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'neutral',
  // External Node.js modules used only in regression-gates (test utilities)
  external: ['fs/promises', 'path', 'lighthouse', 'pixelmatch'],
});
