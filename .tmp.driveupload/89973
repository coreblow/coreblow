import type { KnipConfig } from 'knip';

const config: KnipConfig = {
    entry: [
        'src/index.ts',
        'src/gateway/server.ts',
        'src/cli/index.ts',
        'src/dashboard/serve.ts',
    ],
    project: ['src/**/*.ts'],
    ignore: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'tests/**/*',
        'node_modules/**',
    ],
    ignoreDependencies: [
        // Build tools used via CLI
        'vitest',
        'typescript',
    ],
    ignoreExportsUsedInFile: true,
};

export default config;
