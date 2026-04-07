import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['extensions/*/src/**/*.test.ts'],
    testTimeout: 10000,
  },
});
