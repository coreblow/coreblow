import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
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
