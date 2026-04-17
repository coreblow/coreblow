/**
 * CoreBlow — Rollback Manager
 *
 * Manages rollback points and automated rollback
 * for deployments, configurations, and database
 * migrations.
 */

/** Rollback point */
export interface RollbackPoint {
    id: string;
    type: 'deployment' | 'config' | 'migration' | 'custom';
    description: string;
    state: Record<string, unknown>;
    createdAt: number;
    size: number;
}

/**
 * CoreBlow Rollback Manager
 */
export class RollbackManager {
    private points = new Map<string, RollbackPoint>();
    private idCounter = 0;
    private maxPoints = 50;
    private history: Array<{ pointId: string; rolledBackAt: number; reason: string }> = [];

    /**
     * Create a rollback point.
     */
    create(type: RollbackPoint['type'], description: string, state: Record<string, unknown>): RollbackPoint {
        const id = `rb-${++this.idCounter}`;
        const serialized = JSON.stringify(state);
        const point: RollbackPoint = { id, type, description, state, createdAt: Date.now(), size: serialized.length };
        this.points.set(id, point);

        // Evict old points
        if (this.points.size > this.maxPoints) {
            const oldest = Array.from(this.points.keys())[0]!;
            this.points.delete(oldest);
        }

        return point;
    }

    /**
     * Rollback to a point.
     */
    rollback(pointId: string, reason: string = 'manual'): { success: boolean; state?: Record<string, unknown> } {
        const point = this.points.get(pointId);
        if (!point) return { success: false };
        this.history.push({ pointId, rolledBackAt: Date.now(), reason });
        return { success: true, state: { ...point.state } };
    }

    /**
     * Rollback to latest of a type.
     */
    rollbackLatest(type: RollbackPoint['type'], reason: string = 'auto'): { success: boolean; state?: Record<string, unknown> } {
        const latest = Array.from(this.points.values())
            .filter((p) => p.type === type)
            .sort((a, b) => b.createdAt - a.createdAt)[0];
        if (!latest) return { success: false };
        return this.rollback(latest.id, reason);
    }

    /**
     * Get a point.
     */
    get(id: string): RollbackPoint | null { return this.points.get(id) ?? null; }

    /**
     * List by type.
     */
    listByType(type: RollbackPoint['type']): RollbackPoint[] {
        return Array.from(this.points.values()).filter((p) => p.type === type);
    }

    /**
     * Get rollback history.
     */
    getHistory(): typeof this.history { return [...this.history]; }

    /**
     * Get total storage size.
     */
    getTotalSize(): number {
        return Array.from(this.points.values()).reduce((s, p) => s + p.size, 0);
    }

    /** Count */
    count(): number { return this.points.size; }
}
