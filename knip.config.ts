import type { KnipConfig } from 'knip';

const config: KnipConfig = {
    entry: [
        'src/index.ts',
        'src/entry.ts',
        'src/gateway/server.ts',
        'src/cli/index.ts',
        'src/cli-main.ts',
        'src/dashboard/serve.ts',
        'coreblow.mjs',
    ],
    project: ['src/**/*.ts'],
    ignore: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/stubs/**',
        'tests/**/*',
        'node_modules/**',
        'gateway/**',
    ],
    ignoreDependencies: [
        // Build tools used via CLI
        'vitest',
        'typescript',
        'tsx',
        '@vitejs/plugin-react',
        'vite',
        // Peer dependencies
        'react',
        'react-dom',
    ],
    ignoreExportsUsedInFile: true,
};

export default config;
