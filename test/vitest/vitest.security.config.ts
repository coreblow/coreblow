import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.ts';

const base = baseConfig as unknown as Record<string, unknown>;
const baseTest = (baseConfig as { test?: Record<string, unknown> }).test ?? {};

export default defineConfig({
    ...base,
    test: {
        ...baseTest,
        include: ['src/security/**/*.test.ts', 'test/security/**/*.test.ts'],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            'src/security/audit-extra.sync.test.ts',
            'src/security/audit.test.ts',
            'src/security/fix.test.ts',
        ],
        testTimeout: 15_000,
        hookTimeout: 10_000,
    },
});
