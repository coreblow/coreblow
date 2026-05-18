/**
 * vitest.contracts.config.ts
 *
 * Konfigurasi Vitest khusus untuk contract tests.
 * Contract tests memverifikasi bahwa public API surfaces tidak berubah
 * secara breaking — shape, behavioral contract, dan type invariants.
 *
 * Run: pnpm test:contracts
 *      npx vitest run --config test/vitest/vitest.contracts.config.ts
 *
 * NOTE: resolve.alias harus sinkron dengan vitest.config.ts untuk mencegah
 * ERR_MODULE_NOT_FOUND saat import chain menarik extension stubs.
 */
import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { pluginSdkSubpaths } from '../../scripts/lib/plugin-sdk-entries.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.node'],
        alias: [
            // ── CoreBlow self-referential aliases ──
            { find: 'coreblow/extension-api', replacement: path.join(repoRoot, 'src', 'extensionAPI.ts') },
            ...pluginSdkSubpaths.map((subpath: string) => ({
                find: `coreblow/plugin-sdk/${subpath}`,
                replacement: path.join(repoRoot, 'src', 'plugin-sdk', `${subpath}.ts`),
            })),
            { find: 'coreblow/plugin-sdk', replacement: path.join(repoRoot, 'src', 'plugin-sdk', 'index.ts') },
            // ── Third-party stubs (keep in sync with vitest.config.ts) ──
            { find: 'fake-indexeddb/auto', replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts') },
            { find: 'fake-indexeddb', replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts') },
            { find: 'music-metadata', replacement: path.resolve(repoRoot, 'src/stubs/music-metadata.ts') },
            { find: '@grammyjs/transformer-throttler', replacement: path.resolve(repoRoot, 'src/stubs/grammyjs-throttler.ts') },
            { find: /^matrix-js-sdk(\/.*)?$/, replacement: path.resolve(repoRoot, 'src/stubs/matrix-js-sdk.ts') },
            { find: '@matrix-org/matrix-sdk-crypto-nodejs', replacement: path.resolve(repoRoot, 'src/stubs/matrix-js-sdk.ts') },
            { find: 'markdown-it', replacement: path.resolve(repoRoot, 'src/stubs/markdown-it.ts') },
        ],
    },
    test: {
        name: 'contracts',
        include: ['tests/contracts/**/*.contract.test.ts', 'src/**/*.contract.test.ts'],
        globals: true,
        environment: 'node',
        reporters: ['verbose'],
        // Allow heavy first-import chains (google/matrix/telegram extensions).
        testTimeout: 30_000,
        hookTimeout: 60_000,
    },
});
