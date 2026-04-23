import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

const base = baseConfig as unknown as Record<string, unknown>;
const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...base,
  test: {
    ...baseTest,
    include: ['src/channels/**/*.test.ts', 'extensions/*/src/**/*.test.ts'],
    testTimeout: 15000,
  },
});
