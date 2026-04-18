import { defineConfig } from 'vitest/config';
import path from 'path';

const repoRoot = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.node'],
        alias: [
            {
                find: 'coreblow/extension-api',
                replacement: path.join(repoRoot, 'src', 'extensionAPI.ts'),
            },
            {
                // Wildcard: resolve all coreblow/plugin-sdk/* subpath imports
                find: /^coreblow\/plugin-sdk\/(.+)$/,
                replacement: path.join(repoRoot, 'src', 'plugin-sdk', '$1.ts'),
            },
            {
                find: 'coreblow/plugin-sdk',
                replacement: path.join(repoRoot, 'src', 'plugin-sdk', 'index.ts'),
            },
            // Runtime stubs for proprietary packages
            {
                find: /^@mariozechner\/pi-ai(\/.*)?$/,
                replacement: path.resolve(repoRoot, 'src/stubs/pi-ai.ts'),
            },
            {
                find: /^@mariozechner\/pi-coding-agent(\/.*)?$/,
                replacement: path.resolve(repoRoot, 'src/stubs/pi-coding-agent.ts'),
            },
            // Stub for fake-indexeddb (used by extensions/matrix)
            {
                find: 'fake-indexeddb/auto',
                replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts'),
            },
            {
                find: 'fake-indexeddb',
                replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts'),
            },
            // Stub for music-metadata (used by extensions/matrix)
            {
                find: 'music-metadata',
                replacement: path.resolve(repoRoot, 'src/stubs/music-metadata.ts'),
            },
            // Stub for Grammy throttler (used by extensions/telegram)
            {
                find: '@grammyjs/transformer-throttler',
                replacement: path.resolve(repoRoot, 'src/stubs/grammyjs-throttler.ts'),
            },
            // Stubs for matrix-js-sdk and related packages
            {
                find: /^matrix-js-sdk(\/.*)?$/,
                replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts'),
            },
            {
                find: '@matrix-org/matrix-sdk-crypto-nodejs',
                replacement: path.resolve(repoRoot, 'src/stubs/fake-indexeddb-auto.ts'),
            },
            {
                find: 'markdown-it',
                replacement: path.resolve(repoRoot, 'src/stubs/markdown-it.ts'),
            },
        ],
    },
    test: {
        testTimeout: 120_000,
        hookTimeout: 120_000,
        unstubEnvs: true,
        unstubGlobals: true,
        pool: 'forks',
        include: [
            'src/**/*.test.ts',
            'tests/**/*.test.ts',
            'ui/src/ui/app-chat.test.ts',
            'ui/src/ui/chat/**/*.test.ts',
            'ui/src/ui/views/agents-utils.test.ts',
            'ui/src/ui/views/channels.test.ts',
            'ui/src/ui/views/chat.test.ts',
            'ui/src/ui/views/nodes.devices.test.ts',
            'ui/src/ui/views/usage-render-details.test.ts',
            'ui/src/ui/controllers/agents.test.ts',
            'ui/src/ui/controllers/chat.test.ts',
            'ui/src/ui/controllers/sessions.test.ts',
            'ui/src/ui/views/sessions.test.ts',
            'ui/src/ui/app-gateway.sessions.node.test.ts',
        ],
        setupFiles: ['test/setup.ts'],
        exclude: [
            'dist/**',
            'test/fixtures/**',
            '**/node_modules/**',
            '**/vendor/**',
            '**/*.live.test.ts',
            '**/*.e2e.test.ts',
            // canvas-host tests require chokidar
            'src/canvas-host/**/*.test.ts',
            // Extension tests have their own vitest config
            'extensions/**/*.test.ts',
            // status.test.ts requires full extension dependency tree (matrix-js-sdk, grammy, etc.)
            'src/commands/status.test.ts',
            // pdf-tool.test.ts requires matrix-js-sdk class hierarchy
            'src/agents/tools/pdf-tool.test.ts',
            // index.test.ts hangs during import resolution
            'src/index.test.ts',
        ],
    },
});
