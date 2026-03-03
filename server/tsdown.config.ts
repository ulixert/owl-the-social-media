import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  tsconfig: 'tsconfig.json',
});
