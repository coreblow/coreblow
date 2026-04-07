/**
 * CoreBlow — Migration System
 *
 * Manages data and config migrations when upgrading.
 * Supports versioned migrations, rollback, dry-run,
 * and migration history tracking.
 */

/** Migration definition */
export interface Migration {
    version: string;
    name: string;
    description?: string;
    up: () => Promise<void>;
    down?: () => Promise<void>;
}

/** Migration record */
export interface MigrationRecord {
    version: string;
    name: string;
    status: 'applied' | 'rolled-back' | 'failed';
    appliedAt: number;
    durationMs: number;
    error?: string;
}

/**
 * CoreBlow Migration System
 */
export class MigrationSystem {
    private migrations: Migration[] = [];
    private applied = new Map<string, MigrationRecord>();
    private currentVersion = '0.0.0';

    /**
     * Register a migration.
     */
    register(migration: Migration): void {
        this.migrations.push(migration);
        this.migrations.sort((a, b) => this.compareVersion(a.version, b.version));
    }

    /**
     * Run all pending migrations.
     */
    async migrate(): Promise<MigrationRecord[]> {
        const results: MigrationRecord[] = [];
        for (const migration of this.migrations) {
            if (this.applied.has(migration.version)) continue;
            const record = await this.applyMigration(migration);
            results.push(record);
            if (record.status === 'failed') break;
        }
        return results;
    }

    /**
     * Rollback the last applied migration.
     */
    async rollback(): Promise<MigrationRecord | null> {
        const appliedList = Array.from(this.applied.values())
            .filter((r) => r.status === 'applied')
            .sort((a, b) => b.appliedAt - a.appliedAt);

        if (appliedList.length === 0) return null;

        const last = appliedList[0]!;
        const migration = this.migrations.find((m) => m.version === last.version);
        if (!migration?.down) return null;

        const start = Date.now();
        try {
            await migration.down();
            const record: MigrationRecord = {
                version: migration.version, name: migration.name,
                status: 'rolled-back', appliedAt: Date.now(), durationMs: Date.now() - start,
            };
            this.applied.set(migration.version, record);
            this.updateCurrentVersion();
            return record;
        } catch (err) {
            return {
                version: migration.version, name: migration.name,
                status: 'failed', appliedAt: Date.now(), durationMs: Date.now() - start,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    /**
     * Get pending migrations.
     */
    getPending(): Migration[] {
        return this.migrations.filter((m) => !this.applied.has(m.version) ||
            this.applied.get(m.version)?.status === 'rolled-back');
    }

    /**
     * Get migration history.
     */
    getHistory(): MigrationRecord[] {
        return Array.from(this.applied.values()).sort((a, b) => a.appliedAt - b.appliedAt);
    }

    /**
     * Get current version.
     */
    getVersion(): string {
        return this.currentVersion;
    }

    /** Count registered */
    count(): number { return this.migrations.length; }

    // === Private ===

    private async applyMigration(migration: Migration): Promise<MigrationRecord> {
        const start = Date.now();
        try {
            await migration.up();
            const record: MigrationRecord = {
                version: migration.version, name: migration.name,
                status: 'applied', appliedAt: Date.now(), durationMs: Date.now() - start,
            };
            this.applied.set(migration.version, record);
            this.currentVersion = migration.version;
            return record;
        } catch (err) {
            const record: MigrationRecord = {
                version: migration.version, name: migration.name,
                status: 'failed', appliedAt: Date.now(), durationMs: Date.now() - start,
                error: err instanceof Error ? err.message : String(err),
            };
            this.applied.set(migration.version, record);
            return record;
        }
    }

    private updateCurrentVersion(): void {
        const appliedVersions = Array.from(this.applied.values())
            .filter((r) => r.status === 'applied')
            .map((r) => r.version);
        this.currentVersion = appliedVersions.length > 0 ? appliedVersions[appliedVersions.length - 1]! : '0.0.0';
    }

    private compareVersion(a: string, b: string): number {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
        }
        return 0;
    }
}
