import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Local runs load credentials from .env.test; CI provides DATABASE_URL directly.
loadEnv({ path: '.env.test' });

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" path alias (baseUrl: src).
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
    // Source files import with explicit .js extensions (NodeNext style).
    // Map those requests to the .ts sources so Vitest can resolve them.
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
  test: {
    environment: 'node',
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // Tests share a single database; run files serially to avoid cross-talk.
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    env: process.env as Record<string, string>,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
