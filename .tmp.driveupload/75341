/**
 * vitest.contracts.config.ts
 *
 * Konfigurasi Vitest khusus untuk contract tests.
 * Contract tests memverifikasi bahwa public API surfaces tidak berubah
 * secara breaking — shape, behavioral contract, dan type invariants.
 *
 * Run: npm run test:contracts
 *      npx vitest run --config vitest.contracts.config.ts
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: 'contracts',
        include: ['tests/contracts/**/*.contract.test.ts'],
        globals: true,
        environment: 'node',
        reporters: ['verbose'],
        // Contract tests harus cepat — pure logic, tidak ada I/O eksternal
        testTimeout: 5_000,
        hookTimeout: 5_000,
    },
});
