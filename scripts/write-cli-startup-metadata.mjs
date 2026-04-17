#!/usr/bin/env node
/**
 * scripts/write-cli-startup-metadata.mjs
 *
 * Generate dist/cli-startup-metadata.json after build.
 * Used by coreblow.mjs for fast bare --help (precomputed output).
 *
 * [PORT] openclaw-main/scripts/write-cli-startup-metadata.ts
 * Adaptasi (OpenClaw → CoreBlow):
 *   - Hapus channelOptions/extensionsDir (CoreBlow tidak pakai extension catalog)
 *   - rootHelpText dirender dari dist/cli-main.js via Commander.js --help capture
 *
 * Dipanggil setelah tsc: node scripts/write-cli-startup-metadata.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const distDir = path.join(rootDir, 'dist');
const outputPath = path.join(distDir, 'cli-startup-metadata.json');

// ─── Capture root help text ───────────────────────────────────────────────────

/**
 * Render the --help output by spawning the compiled CLI and capturing stdout.
 * [PORT] openclaw renderBundledRootHelpText()
 */
async function renderRootHelpText() {
    const { spawn } = await import('node:child_process');
    return new Promise((resolve, reject) => {
        const proc = spawn(process.execPath, [path.join(distDir, 'cli-main.js'), '--help'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        proc.stdout.on('data', (chunk) => { out += chunk.toString(); });
        proc.stderr.on('data', () => {}); // ignore stderr
        proc.on('close', () => resolve(out));
        proc.on('error', reject);
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let rootHelpText = '';
try {
    rootHelpText = await renderRootHelpText();
} catch (err) {
    console.warn(`[write-cli-startup-metadata] Could not capture root help text: ${err.message}`);
    console.warn('  dist/cli-startup-metadata.json will have empty rootHelpText');
}

mkdirSync(distDir, { recursive: true });
writeFileSync(
    outputPath,
    JSON.stringify(
        {
            generatedBy: 'scripts/write-cli-startup-metadata.mjs',
            rootHelpText,
        },
        null,
        2,
    ) + '\n',
    'utf8',
);

console.log(`[write-cli-startup-metadata] Written to ${outputPath}`);
