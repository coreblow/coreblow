/**
 * agents/subagent-registry.ts
 * Registry for managing subagent sessions.
 * Ported from OpenClaw src/agents/subagent-registry.ts.
 */

export type SubagentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SubagentEntry {
    id: string;
    parentSessionId: string;
    agentId: string;
    task: string;
    status: SubagentStatus;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    result?: string;
    error?: string;
    metadata?: Record<string, unknown>;
}

export class SubagentRegistry {
    private entries = new Map<string, SubagentEntry>();

    register(entry: Omit<SubagentEntry, 'createdAt' | 'status'>): SubagentEntry {
        const full: SubagentEntry = { ...entry, status: 'pending', createdAt: Date.now() };
        this.entries.set(entry.id, full);
        return full;
    }

    start(id: string): boolean {
        const e = this.entries.get(id);
        if (!e || e.status !== 'pending') return false;
        e.status = 'running';
        e.startedAt = Date.now();
        return true;
    }

    complete(id: string, result: string): boolean {
        const e = this.entries.get(id);
        if (!e || (e.status !== 'running' && e.status !== 'pending')) return false;
        e.status = 'completed';
        e.completedAt = Date.now();
        e.result = result;
        return true;
    }

    fail(id: string, error: string): boolean {
        const e = this.entries.get(id);
        if (!e) return false;
        e.status = 'failed';
        e.completedAt = Date.now();
        e.error = error;
        return true;
    }

    cancel(id: string): boolean {
        const e = this.entries.get(id);
        if (!e || e.status === 'completed' || e.status === 'failed') return false;
        e.status = 'cancelled';
        e.completedAt = Date.now();
        return true;
    }

    get(id: string): SubagentEntry | undefined { return this.entries.get(id); }

    listForParent(parentSessionId: string): SubagentEntry[] {
        return [...this.entries.values()].filter((e) => e.parentSessionId === parentSessionId);
    }

    listRunning(): SubagentEntry[] {
        return [...this.entries.values()].filter((e) => e.status === 'running');
    }

    listByAgent(agentId: string): SubagentEntry[] {
        return [...this.entries.values()].filter((e) => e.agentId === agentId);
    }

    prune(maxAge: number = 24 * 60 * 60 * 1000): number {
        const cutoff = Date.now() - maxAge;
        let pruned = 0;
        for (const [id, e] of this.entries) {
            if ((e.completedAt ?? e.createdAt) < cutoff) { this.entries.delete(id); pruned++; }
        }
        return pruned;
    }

    size(): number { return this.entries.size; }
    clear(): void { this.entries.clear(); }
}
