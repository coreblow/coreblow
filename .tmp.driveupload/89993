import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/unit/**/*.test.ts'],
        exclude: ['tests/integration/**', 'tests/e2e/**', 'tests/security/**', 'tests/agent-system/**'],
        testTimeout: 10_000,
        hookTimeout: 10_000,
    },
});
