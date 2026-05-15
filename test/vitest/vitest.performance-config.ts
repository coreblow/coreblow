/**
 * vitest.performance-config.ts
 *
 * Performance baseline benchmark runner — P2 audit item #16.
 * Port pola dari `test/vitest/vitest.performance-config.ts`.
 *
 * Performance tests memverifikasi bahwa critical paths memenuhi
 * SLA latency — bukan test correctness, melainkan test efficiency.
 *
 * Naming convention:
 *   tests/performance/<domain>.perf.test.ts
 *
 * Pola CoreBlow `test/vitest/vitest.performance-config.ts`:
 *   - loadVitestExperimentalConfig()  → optional fsModuleCache, importDurations
 *   - maxWorkers: 1                   → sequential untuk avoid CPU contention
 *   - Env flag: COREBLOW_VITEST_FS_MODULE_CACHE → opt-in fs module cache
 *
 * Run: npm run test:performance
 *
 * @see test/vitest/vitest.performance-config.ts
 */
import { defineConfig } from 'vitest/config';

type EnvMap = Record<string, string | undefined>;

const isEnabled = (value: string | undefined): boolean => {
    const normalized = value?.trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
};

const isDisabled = (value: string | undefined): boolean => {
    const normalized = value?.trim().toLowerCase();
    return normalized === '0' || normalized === 'false';
};

/**
 * Vitest experimental config untuk performance optimization.
 * Pola identik CoreBlow `loadVitestExperimentalConfig()`.
 *
 * Env vars:
 *   COREBLOW_VITEST_FS_MODULE_CACHE=1         — enable fs module cache (default: on non-Windows)
 *   COREBLOW_VITEST_FS_MODULE_CACHE_PATH=...  — custom cache path
 *   COREBLOW_VITEST_IMPORT_DURATIONS=1        — print import timings
 */
export function loadVitestExperimentalConfig(
    env: EnvMap = process.env,
    platform: NodeJS.Platform = process.platform,
): Record<string, unknown> {
    const isWindows = platform === 'win32' ||
        env.RUNNER_OS?.trim().toLowerCase() === 'windows';

    const experimental: Record<string, unknown> = {};

    // fs module cache: on by default (non-Windows), off on Windows
    if (!isWindows && !isDisabled(env.COREBLOW_VITEST_FS_MODULE_CACHE)) {
        experimental.fsModuleCache = true;
    }
    if (isWindows && isEnabled(env.COREBLOW_VITEST_FS_MODULE_CACHE)) {
        experimental.fsModuleCache = true;
    }
    if (experimental.fsModuleCache && env.COREBLOW_VITEST_FS_MODULE_CACHE_PATH?.trim()) {
        experimental.fsModuleCachePath = env.COREBLOW_VITEST_FS_MODULE_CACHE_PATH.trim();
    }
    if (isEnabled(env.COREBLOW_VITEST_IMPORT_DURATIONS)) {
        experimental.importDurations = { print: true };
    }

    return Object.keys(experimental).length > 0 ? { experimental } : {};
}

export default defineConfig({
    ...loadVitestExperimentalConfig(),
    test: {
        name: 'performance',
        include: [
            'tests/performance/**/*.perf.test.ts',
        ],
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
        ],

        // Sequential — performance tests TIDAK boleh parallel
        // CPU contention akan corrupt benchmark numbers
        maxWorkers: 1,
        minWorkers: 1,

        // Performance tests bisa memerlukan many iterations
        testTimeout: 30_000,
        hookTimeout: 10_000,

        reporters: ['verbose'],

        // Disable isolate untuk avoid module reload overhead yang
        // mengacaukan timing measurements
        isolate: false,
    },
});
