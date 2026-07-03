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
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
