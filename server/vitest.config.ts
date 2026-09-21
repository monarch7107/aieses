import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: { NODE_ENV: 'test', DEMO_MODE: 'true' },
  },
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared') },
  },
});
