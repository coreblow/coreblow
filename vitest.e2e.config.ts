/**
 * vitest.e2e.config.ts
 *
 * End-to-end test runner for CoreBlow.
 * E2E tests exercise full integration paths: embedded agent runtime,
 * gateway, plugin loader, subagent lifecycle, etc.
 *
 * Run: npx vitest run --config vitest.e2e.config.ts
 *
 * NOTE: resolve.alias MUST stay in sync with vitest.config.ts to prevent
 * ERR_MODULE_NOT_FOUND when import chains pull extension stubs.
 */
import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { pluginSdkSubpaths } from './scripts/lib/plugin-sdk-entries.mjs';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

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
            { find: /^matrix-js-sdk(\/.*)?$/, replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts') },
            { find: '@matrix-org/matrix-sdk-crypto-nodejs', replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts') },
            { find: 'markdown-it', replacement: path.resolve(repoRoot, 'src/stubs/markdown-it.ts') },
            { find: '@whiskeysockets/baileys', replacement: path.resolve(repoRoot, 'src/stubs/whiskeysockets-baileys.ts') },
            { find: '@urbit/aura', replacement: path.resolve(repoRoot, 'src/stubs/urbit-aura.ts') },
            { find: '@aws-sdk/client-bedrock-runtime', replacement: path.resolve(repoRoot, 'src/stubs/aws-bedrock-runtime.ts') },
            { find: '@aws-sdk/client-bedrock', replacement: path.resolve(repoRoot, 'src/stubs/aws-bedrock.ts') },
            { find: '@aws-sdk/client-s3', replacement: path.resolve(repoRoot, 'src/stubs/aws-s3.ts') },
            { find: '@aws-sdk/s3-request-presigner', replacement: path.resolve(repoRoot, 'src/stubs/aws-s3-presigner.ts') },
        ],
    },
    test: {
        name: 'e2e',
        include: ['test/**/*.e2e.test.ts', 'src/**/*.e2e.test.ts'],
        setupFiles: ['./test/setup.ts'],
        globals: true,
        environment: 'node',
        reporters: ['verbose'],
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});
