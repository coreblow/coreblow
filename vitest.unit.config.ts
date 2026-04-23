import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

/**
 * Unit test config — inherits resolve.alias from vitest.config.ts
 * so that `coreblow/plugin-sdk/*` subpath imports resolve correctly.
 */
const base = baseConfig as unknown as Record<string, unknown>;
const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
  ...base,
  test: {
    ...baseTest,
    include: ['src/**/*.test.ts'],
    exclude: [
      ...((baseTest.exclude as string[]) ?? []),
      '**/*.e2e.test.ts',
    ],
    testTimeout: 10000,
  },
});
