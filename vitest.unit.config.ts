import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['gateway/src/**/*.test.ts'],
    exclude: ['**/*.e2e.test.ts'],
    testTimeout: 10000,
  },
});
