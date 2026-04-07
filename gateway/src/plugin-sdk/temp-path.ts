/**
 * plugin-sdk/temp-path.ts
 * Secure temp file handling.
 * Ported from OpenClaw temp-path patterns.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const COREBLOW_TMP_DIR = 'coreblow';

/**
 * Resolve preferred temp directory.
 * Uses /tmp/coreblow if available, falls back to os.tmpdir()/coreblow.
 */
export function resolvePreferredTmpDir(): string {
    const preferred = path.join('/tmp', COREBLOW_TMP_DIR);
    try {
        fs.mkdirSync(preferred, { recursive: true, mode: 0o700 });
        return preferred;
    } catch {
        const fallback = path.join(os.tmpdir(), COREBLOW_TMP_DIR);
        fs.mkdirSync(fallback, { recursive: true, mode: 0o700 });
        return fallback;
    }
}

/**
 * Build a random temp file path with optional extension.
 */
export function buildRandomTempFilePath(ext?: string): string {
    const dir = resolvePreferredTmpDir();
    const name = `cb_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    return path.join(dir, ext ? `${name}.${ext}` : name);
}

/**
 * Run a function with a temporary download path, cleaned up afterwards.
 */
export async function withTempDownloadPath<T>(fn: (tempPath: string) => Promise<T>, ext?: string): Promise<T> {
    const tempPath = buildRandomTempFilePath(ext);
    try {
        return await fn(tempPath);
    } finally {
        try { fs.unlinkSync(tempPath); } catch { /* may not exist */ }
    }
}

/**
 * Clean up old temp files (older than maxAgeMs).
 */
export function cleanupTempFiles(maxAgeMs = 24 * 60 * 60 * 1000): number {
    const dir = resolvePreferredTmpDir();
    let cleaned = 0;
    try {
        const entries = fs.readdirSync(dir);
        const now = Date.now();
        for (const entry of entries) {
            const filePath = path.join(dir, entry);
            try {
                const stat = fs.statSync(filePath);
                if (now - stat.mtimeMs > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            } catch { /* skip */ }
        }
    } catch { /* dir may not exist */ }
    return cleaned;
}
