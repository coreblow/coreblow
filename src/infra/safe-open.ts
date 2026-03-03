/**
 * CoreBlow — Safe File Open (Sync)
 *
 * Ported from CoreBlow reference's safe-open-sync.ts.
 * Opens files with security validation:
 *   - O_NOFOLLOW to reject symlinks at kernel level
 *   - Pre-open lstat + post-open fstat (TOCTOU protection)
 *   - Hardlink rejection (nlink > 1)
 *   - File size limit enforcement
 *   - Type validation (file vs directory)
 *
 * Used by boundary-file-read.ts for plugin manifest loading.
 */

import fs from 'node:fs';
import { sameFileIdentity } from './file-identity.js';

// ─── Types ──────────────────────────────────────────────────────

export type SafeOpenSyncFailureReason = 'path' | 'validation' | 'io';

export type SafeOpenSyncResult =
    | { ok: true; path: string; fd: number; stat: fs.Stats }
    | { ok: false; reason: SafeOpenSyncFailureReason; error?: unknown };

export type SafeOpenSyncAllowedType = 'file' | 'directory';

// ─── Flags ──────────────────────────────────────────────────────

const SUPPORTS_NOFOLLOW = process.platform !== 'win32' && 'O_NOFOLLOW' in fs.constants;
const OPEN_READ_FLAGS = fs.constants.O_RDONLY | (SUPPORTS_NOFOLLOW ? fs.constants.O_NOFOLLOW : 0);

// ─── Helpers ────────────────────────────────────────────────────

function isExpectedPathError(error: unknown): boolean {
    const code =
        typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: string }).code) : '';
    return code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP';
}

function isAllowedType(stat: fs.Stats, allowedType: SafeOpenSyncAllowedType): boolean {
    if (allowedType === 'directory') {
        return stat.isDirectory();
    }
    return stat.isFile();
}

// ─── Main ───────────────────────────────────────────────────────

/**
 * Open a file with full security validation.
 *
 * CoreBlow pattern: lstat → validate → open(O_NOFOLLOW) → fstat → validate identity
 *
 * This prevents:
 *   - Symlink following (O_NOFOLLOW)
 *   - Hardlink exploitation (nlink check)
 *   - TOCTOU swaps (sameFileIdentity between lstat and fstat)
 *   - Oversized files (maxBytes)
 */
export function openVerifiedFileSync(params: {
    filePath: string;
    resolvedPath?: string;
    rejectPathSymlink?: boolean;
    rejectHardlinks?: boolean;
    maxBytes?: number;
    allowedType?: SafeOpenSyncAllowedType;
}): SafeOpenSyncResult {
    const allowedType = params.allowedType ?? 'file';
    let fd: number | null = null;

    try {
        // 1. Pre-open symlink check (lstat doesn't follow symlinks)
        if (params.rejectPathSymlink) {
            const candidateStat = fs.lstatSync(params.filePath);
            if (candidateStat.isSymbolicLink()) {
                return { ok: false, reason: 'validation' };
            }
        }

        // 2. Resolve real path
        const realPath = params.resolvedPath ?? fs.realpathSync(params.filePath);

        // 3. Pre-open validation (lstat on realPath)
        const preOpenStat = fs.lstatSync(realPath);
        if (!isAllowedType(preOpenStat, allowedType)) {
            return { ok: false, reason: 'validation' };
        }
        if (params.rejectHardlinks && preOpenStat.isFile() && preOpenStat.nlink > 1) {
            return { ok: false, reason: 'validation' };
        }
        if (params.maxBytes !== undefined && preOpenStat.isFile() && preOpenStat.size > params.maxBytes) {
            return { ok: false, reason: 'validation' };
        }

        // 4. Open with O_NOFOLLOW (kernel-level symlink rejection)
        fd = fs.openSync(realPath, OPEN_READ_FLAGS);

        // 5. Post-open validation (fstat on opened fd — TOCTOU protection)
        const openedStat = fs.fstatSync(fd);
        if (!isAllowedType(openedStat, allowedType)) {
            return { ok: false, reason: 'validation' };
        }
        if (params.rejectHardlinks && openedStat.isFile() && openedStat.nlink > 1) {
            return { ok: false, reason: 'validation' };
        }
        if (params.maxBytes !== undefined && openedStat.isFile() && openedStat.size > params.maxBytes) {
            return { ok: false, reason: 'validation' };
        }

        // 6. Identity check — detect file swap between lstat and open
        if (!sameFileIdentity(preOpenStat, openedStat)) {
            return { ok: false, reason: 'validation' };
        }

        // All checks pass — return opened fd
        const opened = { ok: true as const, path: realPath, fd, stat: openedStat };
        fd = null; // prevent cleanup from closing
        return opened;
    } catch (error) {
        if (isExpectedPathError(error)) {
            return { ok: false, reason: 'path', error };
        }
        return { ok: false, reason: 'io', error };
    } finally {
        // Cleanup fd on any validation failure
        if (fd !== null) {
            fs.closeSync(fd);
        }
    }
}

// ---------------------------------------------------------------------------
// SafeOpenService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "./service-patterns.js";
export class SafeOpenService {
  [Symbol.toStringTag] = 'SafeOpenService';
}


const { getInstance: getSafeOpenService, __testing: __testing_safeOpen } =
  createStandaloneSingleton({ create: () => new SafeOpenService(), defaultDeps: {} });

export { getSafeOpenService, __testing_safeOpen };
