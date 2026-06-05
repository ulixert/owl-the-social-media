import { defineConfig } from 'tsdown';

export default defineConfig({
  // The demo seed is a second entry so it compiles to dist/seed-demo.mjs and can
  // run with plain node in prod (the image has no tsx). Bundling pulls in src/
  // (the storage backend) which isn't otherwise copied into the runtime image.
  entry: {
    server: 'src/server.ts',
    'seed-demo': 'prisma/seed/demo.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  tsconfig: 'tsconfig.json',
});
