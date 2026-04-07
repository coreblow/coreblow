/**
 * CoreBlow Config Backup Rotation
 *
 * Manages config file backups with automatic rotation, maintenance,
 * and restoration capabilities. Keeps N versioned backups.
 *
 * Equivalent: CoreBlow config/backup-rotation.ts (125 LOC)
 */

import { createChildLogger } from '../utils/logger.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const log = createChildLogger('config:backup');

// ─── Types ────────────────────────────────────────────────────────

export interface BackupRotationOptions {
    maxBackups: number;
    backupSuffix: string;
    preservePermissions: boolean;
}

export interface BackupEntry {
    path: string;
    index: number;
    size: number;
    modifiedAt: number;
    exists: boolean;
}

export interface BackupResult {
    success: boolean;
    backupsRotated: number;
    backupPath: string;
    error?: string;
}

export interface RestoreResult {
    success: boolean;
    restoredFrom: string;
    error?: string;
}

// ─── Defaults ─────────────────────────────────────────────────────

const DEFAULT_OPTIONS: BackupRotationOptions = {
    maxBackups: 5,
    backupSuffix: '.bak',
    preservePermissions: true,
};

// ─── Backup Rotation ──────────────────────────────────────────────

/**
 * Rotate config backups: .bak.4 → .bak.5 (delete), .bak.3 → .bak.4, etc.
 * Then copy current → .bak.1
 */
export async function rotateConfigBackups(
    configPath: string,
    options?: Partial<BackupRotationOptions>,
): Promise<BackupResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const backupBase = `${configPath}${opts.backupSuffix}`;

    try {
        // Delete the oldest backup
        const oldestPath = `${backupBase}.${opts.maxBackups}`;
        await fs.promises.unlink(oldestPath).catch(() => { /* best-effort */ });

        // Rotate existing backups: N-1 → N, N-2 → N-1, ...
        for (let i = opts.maxBackups - 1; i >= 1; i--) {
            const fromPath = `${backupBase}.${i}`;
            const toPath = `${backupBase}.${i + 1}`;
            await fs.promises.rename(fromPath, toPath).catch(() => { /* best-effort */ });
        }

        // Copy current config to .bak.1
        const newBackupPath = `${backupBase}.1`;
        await fs.promises.copyFile(configPath, newBackupPath);

        if (opts.preservePermissions) {
            try {
                const stat = await fs.promises.stat(configPath);
                await fs.promises.chmod(newBackupPath, stat.mode);
            } catch { /* best-effort */ }
        }

        log.info({ configPath, backupPath: newBackupPath }, 'Config backup created');
        return { success: true, backupsRotated: 1, backupPath: newBackupPath };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error({ configPath, error: message }, 'Backup rotation failed');
        return { success: false, backupsRotated: 0, backupPath: '', error: message };
    }
}

/**
 * List all available backups for a config file
 */
export function listBackups(
    configPath: string,
    options?: Partial<BackupRotationOptions>,
): BackupEntry[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const backupBase = `${configPath}${opts.backupSuffix}`;
    const entries: BackupEntry[] = [];

    for (let i = 1; i <= opts.maxBackups; i++) {
        const backupPath = `${backupBase}.${i}`;
        try {
            const stat = fs.statSync(backupPath);
            entries.push({
                path: backupPath,
                index: i,
                size: stat.size,
                modifiedAt: stat.mtimeMs,
                exists: true,
            });
        } catch {
            entries.push({
                path: backupPath,
                index: i,
                size: 0,
                modifiedAt: 0,
                exists: false,
            });
        }
    }

    return entries;
}

/**
 * Restore config from a specific backup
 */
export async function restoreFromBackup(
    configPath: string,
    backupIndex: number = 1,
    options?: Partial<BackupRotationOptions>,
): Promise<RestoreResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const backupPath = `${configPath}${opts.backupSuffix}.${backupIndex}`;

    try {
        await fs.promises.access(backupPath, fs.constants.R_OK);
        // Back up current before restoring
        await rotateConfigBackups(configPath, opts);
        await fs.promises.copyFile(backupPath, configPath);
        log.info({ configPath, backupPath }, 'Config restored from backup');
        return { success: true, restoredFrom: backupPath };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, restoredFrom: backupPath, error: message };
    }
}

/**
 * Clean up old backups beyond maxBackups
 */
export async function cleanupBackups(
    configPath: string,
    options?: Partial<BackupRotationOptions>,
): Promise<number> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const backupBase = `${configPath}${opts.backupSuffix}`;
    let cleaned = 0;

    // Try to clean up any backups beyond maxBackups
    for (let i = opts.maxBackups + 1; i <= opts.maxBackups + 10; i++) {
        try {
            await fs.promises.unlink(`${backupBase}.${i}`);
            cleaned++;
        } catch {
            break; // No more old backups
        }
    }

    return cleaned;
}

/**
 * Get the most recent backup path (if exists)
 */
export function getLatestBackupPath(
    configPath: string,
    options?: Partial<BackupRotationOptions>,
): string | null {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const backupPath = `${configPath}${opts.backupSuffix}.1`;
    try {
        fs.accessSync(backupPath, fs.constants.R_OK);
        return backupPath;
    } catch {
        return null;
    }
}
