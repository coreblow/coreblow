#!/usr/bin/env node
/**
 * scripts/write-build-info.mjs
 *
 * Write dist/build-info.json with version, commit, and build timestamp.
 * [PORT] coreblow-main/scripts/write-build-info.ts
 */

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const distDir = path.join(rootDir, 'dist');

const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

let commit = null;
try {
    commit = execSync('git rev-parse --short HEAD', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
} catch {
    // Not a git repo or git not available
}

const buildInfo = {
    version: pkg.version ?? '0.0.0',
    commit,
    builtAt: new Date().toISOString(),
    nodeVersion: process.versions.node,
};

mkdirSync(distDir, { recursive: true });
writeFileSync(
    path.join(distDir, 'build-info.json'),
    JSON.stringify(buildInfo, null, 2) + '\n',
    'utf8',
);

console.log(`[write-build-info] version=${buildInfo.version} commit=${buildInfo.commit ?? 'N/A'}`);
