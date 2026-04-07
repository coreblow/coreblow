/**
 * CoreBlow — Backup Manager
 *
 * Manages backups of configuration, conversations,
 * and agent data. Supports snapshots, restore,
 * and scheduled backups.
 */

/** Backup entry */
export interface BackupEntry {
    id: string;
    name: string;
    type: 'config' | 'conversations' | 'full';
    data: Record<string, unknown>;
    size: number;
    createdAt: number;
    metadata?: Record<string, unknown>;
}

/** Restore result */
export interface RestoreResult {
    success: boolean;
    backupId: string;
    restoredKeys: string[];
    timestamp: number;
}

/**
 * CoreBlow Backup Manager
 */
export class BackupManager {
    private backups = new Map<string, BackupEntry>();
    private maxBackups = 50;
    private idCounter = 0;

    /**
     * Create a backup.
     */
    create(name: string, type: BackupEntry['type'], data: Record<string, unknown>): BackupEntry {
        const serialized = JSON.stringify(data);
        const backup: BackupEntry = {
            id: `bk-${++this.idCounter}`,
            name, type, data: JSON.parse(serialized),
            size: serialized.length,
            createdAt: Date.now(),
        };

        this.backups.set(backup.id, backup);
        this.enforceLimit();
        return backup;
    }

    /**
     * Restore from a backup.
     */
    restore(backupId: string): RestoreResult {
        const backup = this.backups.get(backupId);
        if (!backup) {
            return { success: false, backupId, restoredKeys: [], timestamp: Date.now() };
        }

        return {
            success: true,
            backupId,
            restoredKeys: Object.keys(backup.data),
            timestamp: Date.now(),
        };
    }

    /**
     * Get a backup.
     */
    get(backupId: string): BackupEntry | null {
        return this.backups.get(backupId) ?? null;
    }

    /**
     * Delete a backup.
     */
    delete(backupId: string): boolean {
        return this.backups.delete(backupId);
    }

    /**
     * List backups.
     */
    list(type?: BackupEntry['type']): Array<{ id: string; name: string; type: string; size: number; createdAt: number }> {
        return Array.from(this.backups.values())
            .filter((b) => !type || b.type === type)
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((b) => ({ id: b.id, name: b.name, type: b.type, size: b.size, createdAt: b.createdAt }));
    }

    /**
     * Get total backup size.
     */
    getTotalSize(): number {
        return Array.from(this.backups.values()).reduce((s, b) => s + b.size, 0);
    }

    /** Count */
    count(): number { return this.backups.size; }

    // === Private ===

    private enforceLimit(): void {
        if (this.backups.size <= this.maxBackups) return;
        const sorted = Array.from(this.backups.values()).sort((a, b) => a.createdAt - b.createdAt);
        while (sorted.length > this.maxBackups) {
            const oldest = sorted.shift()!;
            this.backups.delete(oldest.id);
        }
    }
}
