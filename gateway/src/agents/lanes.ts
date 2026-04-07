/**
 * agents/lanes.ts
 * Execution lanes — concurrent slot management for parallel agents.
 */
export interface Lane { id: string; agentId: string; status: 'idle' | 'busy' | 'paused'; startedAt?: number; task?: string; }

export class LaneManager {
    private lanes = new Map<string, Lane>();
    private maxLanes: number;
    constructor(maxLanes = 4) { this.maxLanes = maxLanes; }

    acquire(agentId: string, task?: string): Lane | null {
        if (this.busyCount() >= this.maxLanes) return null;
        const id = `lane_${Date.now().toString(36)}_${this.lanes.size}`;
        const lane: Lane = { id, agentId, status: 'busy', startedAt: Date.now(), task };
        this.lanes.set(id, lane);
        return lane;
    }

    release(laneId: string): boolean {
        return this.lanes.delete(laneId);
    }

    pause(laneId: string): boolean { const l = this.lanes.get(laneId); if (!l) return false; l.status = 'paused'; return true; }
    resume(laneId: string): boolean { const l = this.lanes.get(laneId); if (!l) return false; l.status = 'busy'; return true; }

    get(laneId: string): Lane | undefined { return this.lanes.get(laneId); }
    list(): Lane[] { return [...this.lanes.values()]; }
    listBusy(): Lane[] { return this.list().filter((l) => l.status === 'busy'); }
    busyCount(): number { return this.listBusy().length; }
    availableSlots(): number { return Math.max(0, this.maxLanes - this.busyCount()); }
    clear(): void { this.lanes.clear(); }
}
