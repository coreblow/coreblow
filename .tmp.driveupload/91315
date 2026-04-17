/**
 * agents/tool-mutation.ts
 * Track tool mutations for undo/audit.
 */
export type MutationType = 'create' | 'update' | 'delete' | 'move' | 'exec';
export interface ToolMutation { id: string; toolName: string; type: MutationType; target: string; timestamp: number; details?: Record<string, unknown>; reversible: boolean; }

export class MutationTracker {
    private mutations: ToolMutation[] = [];
    private maxHistory: number;
    private counter = 0;
    constructor(maxHistory = 500) { this.maxHistory = maxHistory; }
    record(mutation: Omit<ToolMutation, 'id' | 'timestamp'>): ToolMutation {
        const entry: ToolMutation = { ...mutation, id: `mut_${++this.counter}`, timestamp: Date.now() };
        this.mutations.push(entry);
        if (this.mutations.length > this.maxHistory) this.mutations.splice(0, this.mutations.length - this.maxHistory);
        return entry;
    }
    getHistory(): readonly ToolMutation[] { return this.mutations; }
    getRecent(n: number): ToolMutation[] { return this.mutations.slice(-n); }
    getByType(type: MutationType): ToolMutation[] { return this.mutations.filter((m) => m.type === type); }
    getByTool(toolName: string): ToolMutation[] { return this.mutations.filter((m) => m.toolName === toolName); }
    getReversible(): ToolMutation[] { return this.mutations.filter((m) => m.reversible); }
    count(): number { return this.mutations.length; }
    clear(): void { this.mutations = []; }
    format(): string {
        if (this.mutations.length === 0) return 'No mutations recorded.';
        return this.mutations.slice(-10).map((m) => `[${m.type}] ${m.toolName} → ${m.target}${m.reversible ? ' ↩' : ''}`).join('\n');
    }
}
