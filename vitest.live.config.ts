/**
 * vitest.live.config.ts
 *
 * Live integration test runner — port pola OpenClaw `vitest.live.config.ts`.
 *
 * Live tests berinteraksi dengan services nyata:
 *   - Running CoreBlow gateway instance
 *   - Real LLM API providers (jika COREBLOW_TEST_OPENAI_KEY diset)
 *   - Actual network I/O
 *
 * Semua live tests WAJIB pakai `describe.skipIf(!COREBLOW_TEST_URL)` atau
 * equivalent — agar tidak fail di CI environment tanpa services.
 *
 * Pola OpenClaw (vitest.live.config.ts):
 *   - disableConsoleIntercept: true  → output provider terlihat realtime
 *   - maxWorkers: 1                  → live tests TIDAK boleh parallel
 *   - include: **\/*.live.test.ts    → hanya file dengan `.live.test.ts` suffix
 *
 * File naming convention:
 *   tests/live/<domain>.live.test.ts
 *
 * Required env vars:
 *   COREBLOW_TEST_URL=http://localhost:3100    — running gateway URL
 *   COREBLOW_TEST_TOKEN=<token>                — gateway auth token
 *
 * Run:
 *   npm run test:live
 *   COREBLOW_TEST_URL=http://localhost:3100 npm run test:live
 *
 * @see openclaw-main/vitest.live.config.ts
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: 'live',
        include: [
            'tests/live/**/*.live.test.ts',
            // Allow co-located live tests in src/ following OpenClaw pattern
            'src/**/*.live.test.ts',
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
        ],

        // Pola OpenClaw: disable console intercept agar output LLM/gateway provider
        // terlihat realtime — penting untuk debugging live connection issues.
        disableConsoleIntercept: true,

        // Pola OpenClaw: single worker — live tests TIDAK boleh parallel.
        // Rate limits, connection pools, dan shared state akan corrupt jika parallel.
        maxWorkers: 1,
        minWorkers: 1,

        // Live LLM calls bisa 30-60s, gateway startup bisa 15s
        testTimeout: 60_000,
        hookTimeout: 30_000,

        // Verbose output agar progress live tests terlihat
        reporters: ['verbose'],
    },
});
