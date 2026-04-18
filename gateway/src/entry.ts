#!/usr/bin/env node
/**
 * CoreBlow — CLI Entry Point
 *
 * This is the compiled entry point that coreblow.mjs imports.
 * It bootstraps the CLI environment and delegates to the
 * Commander-based program.
 *
 * Follows OpenClaw's entry.ts pattern:
 *   1. Node.js version guard
 *   2. isMainModule guard (prevent double-boot)
 *   3. Compile cache (Node.js 22.1+ module.enableCompileCache)
 *   4. Process warning filter (punycode/DEP0040/ExperimentalWarning)
 *   5. Environment normalization
 *   6. Exec marker
 *   7. CLI launch
 *
 * @packageDocumentation
 */

import { enableCompileCache } from 'node:module';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 12;

// ─── Node Version Check ──────────────────────────────────────────

function ensureSupportedNodeVersion(): void {
    const [majorRaw = '0', minorRaw = '0'] = process.versions.node.split('.');
    const major = Number(majorRaw);
    const minor = Number(minorRaw);

    if (major < MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor < MIN_NODE_MINOR)) {
        process.stderr.write(
            `coreblow: Node.js v${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}+ is required (current: v${process.versions.node}).\n` +
            `If you use nvm, run:\n` +
            `  nvm install ${MIN_NODE_MAJOR}\n` +
            `  nvm use ${MIN_NODE_MAJOR}\n` +
            `  nvm alias default ${MIN_NODE_MAJOR}\n`,
        );
        process.exit(1);
    }
}

// ─── Main Module Guard ───────────────────────────────────────────

const ENTRY_WRAPPER_PAIRS = [
    { wrapperBasename: 'coreblow.mjs', entryBasename: 'entry.js' },
    { wrapperBasename: 'coreblow.js', entryBasename: 'entry.js' },
] as const;

/**
 * Guard: only run entry-point logic when this file is the main module.
 * Prevents double-boot when bundler imports entry.js as a shared dependency.
 */
function isMainModule(): boolean {
    try {
        const currentFile = fileURLToPath(import.meta.url);
        const mainFile = process.argv[1];
        if (!mainFile) return false;

        // Direct execution: node dist/entry.js
        if (currentFile === mainFile) return true;

        // Via wrapper: node coreblow.mjs → import('./dist/entry.js')
        for (const pair of ENTRY_WRAPPER_PAIRS) {
            if (mainFile.endsWith(pair.wrapperBasename)) return true;
        }

        return false;
    } catch {
        return false;
    }
}

// ─── CoreBlow Exec Marker ────────────────────────────────────────

const COREBLOW_EXEC_MARKER = Symbol.for('coreblow.exec');

function ensureCoreBlowExecMarkerOnProcess(): void {
    const proc = process as unknown as Record<symbol, boolean>;
    proc[COREBLOW_EXEC_MARKER] = true;
}

// ─── Environment Normalization ───────────────────────────────────

async function normalizeEnv(): Promise<void> {
    // Ensure HOME is set (some Docker images strip it)
    if (!process.env.HOME) {
        try {
            const { homedir } = await import('node:os');
            process.env.HOME = homedir();
        } catch {
            // Best effort
        }
    }
}

// ─── Bootstrap ───────────────────────────────────────────────────

ensureSupportedNodeVersion();

if (!isMainModule()) {
    // Imported as a dependency — skip all entry-point side effects.
} else {
    void (async () => {
        // Set process title for easy identification in ps/top
        process.title = 'coreblow';

        // Set exec marker
        ensureCoreBlowExecMarkerOnProcess();

        // Enable Node.js compile cache (22.1+)
        // https://nodejs.org/api/module.html#module-compile-cache
        if (enableCompileCache && !process.env.NODE_DISABLE_COMPILE_CACHE) {
            try {
                enableCompileCache();
            } catch {
                // Best-effort only; never block startup.
            }
        }

        // Install process warning filter (suppress punycode, DEP0040, etc)
        try {
            const { installWarningFilter } = await import('./infra/warning-filter.js');
            if (typeof installWarningFilter === 'function') {
                installWarningFilter();
            }
        } catch {
            // warning-filter is optional; don't crash if missing
        }

        // Normalize environment
        await normalizeEnv();

        // Handle --no-color flag
        if (process.argv.includes('--no-color')) {
            process.env.NO_COLOR = '1';
            process.env.FORCE_COLOR = '0';
        }

        // Global error handlers
        process.on('uncaughtException', (error) => {
            console.error(
                '[coreblow] Uncaught exception:',
                error instanceof Error ? (error.stack ?? error.message) : error,
            );
            process.exit(1);
        });

        process.on('unhandledRejection', (reason) => {
            console.error(
                '[coreblow] Unhandled rejection:',
                reason instanceof Error ? (reason.stack ?? reason.message) : reason,
            );
            process.exit(1);
        });

        // Launch CLI
        const { runCli } = await import('./cli/program.js');
        void runCli(process.argv).catch((err) => {
            console.error(
                '[coreblow] CLI failed:',
                err instanceof Error ? (err.stack ?? err.message) : err,
            );
            process.exit(1);
        });
    })();
}

export { };
