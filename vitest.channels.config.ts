import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/channels/**/*.test.ts', 'extensions/*/src/**/*.test.ts'],
    testTimeout: 15000,
  },
});
