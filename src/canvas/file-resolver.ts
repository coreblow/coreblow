/**
 * CoreBlow — Canvas File Resolver (Security)
 *
 * Safe file resolution within a root directory.
 * Prevents path traversal attacks (../), symlink escapes,
 * and null byte injection.
 *
 * Pattern from CoreBlow's canvas-host/file-resolver.ts
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// ─── Types ──────────────────────────────────────────────────────

export interface ResolvedFile {
    /** Absolute path to the resolved file */
    realPath: string;
    /** File handle for reading */
    handle: fs.FileHandle;
}

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Normalize a URL path to remove traversal sequences.
 * Strips query strings, fragments, and decodes percent-encoding.
 */
export function normalizeUrlPath(rawPath: string): string {
    // Reject null bytes
    if (rawPath.includes('\0')) {
        throw new PathTraversalError('Null byte in path');
    }

    try {
        const decoded = decodeURIComponent(rawPath.split('?')[0]!.split('#')[0]!);
        // Normalize path separators and resolve relative segments
        const normalized = path.posix.normalize(decoded);
        // Ensure it starts with /
        return normalized.startsWith('/') ? normalized : '/' + normalized;
    } catch {
        return '/';
    }
}

/**
 * Safely resolve a file path within a root directory.
 *
 * Returns null if:
 *  - The path escapes the root directory
 *  - The file doesn't exist
 *  - The resolved symlink escapes the root
 *
 * Security checks:
 *  1. Normalize URL path (strip traversal sequences)
 *  2. Join with root and resolve to absolute
 *  3. Verify resolved path starts with root
 *  4. Follow symlinks and re-verify
 *  5. Check it's a regular file (not directory/device/etc)
 */
export async function resolveFileWithinRoot(
    rootDir: string,
    requestedPath: string,
): Promise<ResolvedFile | null> {
    // Reject null bytes
    if (requestedPath.includes('\0')) {
        return null;
    }

    try {
        // Normalize and resolve the root directory
        const rootReal = await fs.realpath(rootDir);

        // Normalize the requested URL path
        const normalized = normalizeUrlPath(requestedPath);

        // Remove leading slash for path.join
        const relative = normalized.replace(/^\/+/, '') || 'index.html';

        // Build candidate path
        const candidate = path.resolve(rootReal, relative);

        // Check 1: Candidate must be within root (pre-symlink resolution)
        if (!candidate.startsWith(rootReal + path.sep) && candidate !== rootReal) {
            return null;
        }

        // Check 2: File must exist
        let stat;
        try {
            stat = await fs.stat(candidate);
        } catch {
            // Try with .html extension
            if (!path.extname(candidate)) {
                try {
                    const withHtml = candidate + '.html';
                    stat = await fs.stat(withHtml);
                    if (stat.isFile()) {
                        return resolveFileWithinRoot(rootDir, normalized + '.html');
                    }
                } catch {
                    return null;
                }
            }
            return null;
        }

        // If it's a directory, try index.html
        if (stat.isDirectory()) {
            const indexPath = path.join(candidate, 'index.html');
            try {
                const indexStat = await fs.stat(indexPath);
                if (indexStat.isFile()) {
                    return resolveFileWithinRoot(rootDir, path.posix.join(normalized, 'index.html'));
                }
            } catch {
                return null;
            }
            return null;
        }

        // Must be a regular file
        if (!stat.isFile()) {
            return null;
        }

        // Check 3: Resolve symlinks and verify still within root
        const realPath = await fs.realpath(candidate);
        if (!realPath.startsWith(rootReal + path.sep) && realPath !== rootReal) {
            return null; // Symlink escape attempt
        }

        // Open file handle
        const handle = await fs.open(realPath, 'r');
        return { realPath, handle };
    } catch {
        return null;
    }
}

/**
 * Check if a requested path is safe (no traversal, no null bytes).
 * Does NOT check if file exists — just validates the path pattern.
 */
export function isPathSafe(requestedPath: string): boolean {
    if (requestedPath.includes('\0')) return false;

    const normalized = path.normalize(requestedPath);

    // Reject paths that go above root
    if (normalized.startsWith('..') || normalized.includes('/..') || normalized.includes('\\..')) {
        return false;
    }

    // Reject absolute paths (on non-Windows)
    if (path.isAbsolute(requestedPath) && !requestedPath.startsWith('/')) {
        return false;
    }

    return true;
}

/**
 * Sanitize a filename for safe filesystem storage.
 * Strips dangerous characters, limits length, prevents reserved names.
 */
export function sanitizeFilename(name: string): string {
    // Remove null bytes
    let safe = name.replace(/\0/g, '');

    // Remove path separators
    safe = safe.replace(/[/\\]/g, '_');

    // Remove other dangerous chars
    safe = safe.replace(/[<>:"|?*]/g, '_');

    // Remove leading dots (hidden files / directory traversal)
    safe = safe.replace(/^\.+/, '');

    // Limit length
    if (safe.length > 200) {
        const ext = path.extname(safe);
        safe = safe.slice(0, 200 - ext.length) + ext;
    }

    // Prevent reserved names on Windows
    const RESERVED = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)/i;
    if (RESERVED.test(safe)) {
        safe = '_' + safe;
    }

    return safe || 'unnamed';
}

// ─── Error Class ────────────────────────────────────────────────

export class PathTraversalError extends Error {
    constructor(message: string) {
        super(`Path traversal blocked: ${message}`);
        this.name = 'PathTraversalError';
    }
}
