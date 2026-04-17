/**
 * CoreBlow — Snapshot Testing
 *
 * Compares output against stored snapshots for
 * regression testing. Supports update mode, diff
 * generation, and multiple snapshot formats.
 */

/** Snapshot entry */
export interface SnapshotEntry {
    key: string;
    value: string;
    createdAt: number;
    updatedAt: number;
}

/**
 * CoreBlow Snapshot Testing
 */
export class SnapshotTesting {
    private snapshots = new Map<string, SnapshotEntry>();
    private updateMode = false;
    private stats = { matched: 0, created: 0, updated: 0, failed: 0 };

    /**
     * Set update mode.
     */
    setUpdateMode(enabled: boolean): void { this.updateMode = enabled; }

    /**
     * Match against snapshot.
     */
    match(key: string, value: unknown): { match: boolean; diff?: string } {
        const serialized = this.serialize(value);
        const existing = this.snapshots.get(key);

        if (!existing) {
            // New snapshot
            this.snapshots.set(key, { key, value: serialized, createdAt: Date.now(), updatedAt: Date.now() });
            this.stats.created++;
            return { match: true };
        }

        if (existing.value === serialized) {
            this.stats.matched++;
            return { match: true };
        }

        if (this.updateMode) {
            existing.value = serialized;
            existing.updatedAt = Date.now();
            this.stats.updated++;
            return { match: true };
        }

        this.stats.failed++;
        return { match: false, diff: this.generateDiff(existing.value, serialized) };
    }

    /**
     * Get a stored snapshot.
     */
    get(key: string): string | null {
        return this.snapshots.get(key)?.value ?? null;
    }

    /**
     * Delete a snapshot.
     */
    delete(key: string): boolean { return this.snapshots.delete(key); }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /**
     * List snapshot keys.
     */
    list(): string[] { return Array.from(this.snapshots.keys()); }

    /** Count */
    count(): number { return this.snapshots.size; }

    // === Private ===
    private serialize(value: unknown): string {
        if (typeof value === 'string') return value;
        return JSON.stringify(value, null, 2);
    }

    private generateDiff(expected: string, actual: string): string {
        const expLines = expected.split('\n');
        const actLines = actual.split('\n');
        const diffs: string[] = [];
        const max = Math.max(expLines.length, actLines.length);
        for (let i = 0; i < max; i++) {
            if (expLines[i] !== actLines[i]) {
                if (expLines[i]) diffs.push(`- ${expLines[i]}`);
                if (actLines[i]) diffs.push(`+ ${actLines[i]}`);
            }
        }
        return diffs.join('\n');
    }
}
