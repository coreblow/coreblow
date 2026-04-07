import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        exclude: [
            // canvas-host tests require 'chokidar' which cannot be installed
            // due to the deno2node post-install hook. These are CoreBlow-specific
            // integration tests that need a full chokidar installation.
            'src/canvas-host/**/*.test.ts',
            // Default vitest excludes
            '**/node_modules/**',
            '**/dist/**',
        ],
    },
});
