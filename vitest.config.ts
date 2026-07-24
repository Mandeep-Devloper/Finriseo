import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    // Mirror tsconfig's "@/*" → "./src/*" so tests import modules the same way
    // the app does.
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // `server-only` is a build-time-only guard package with no Node entry point;
      // stub it so server modules that import it are testable under Vitest.
      'server-only': path.resolve(__dirname, 'src/test/stubs/server-only.ts'),
    },
  },
});
