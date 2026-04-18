/**
 * agents/subagent-spawn.ts
 * Subagent spawning and orchestration.
 * Ported from CoreBlow src/agents/subagent-spawn.ts.
 */

import { SubagentRegistry, type SubagentEntry } from './subagent-registry.js';

export interface SpawnSubagentParams {
    parentSessionId: string;
    agentId: string;
    task: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
    metadata?: Record<string, unknown>;
}

export interface SubagentOrchestrator {
    spawn: (params: SpawnSubagentParams) => Promise<SubagentEntry>;
    list: (parentSessionId: string) => SubagentEntry[];
    listRunning: () => SubagentEntry[];
    steer: (id: string, instruction: string) => Promise<boolean>;
    cancel: (id: string) => Promise<boolean>;
    waitFor: (id: string, timeoutMs?: number) => Promise<SubagentEntry | null>;
}

/**
 * Create a subagent orchestrator.
 */
export function createSubagentOrchestrator(params: {
    registry: SubagentRegistry;
    execute: (entry: SubagentEntry) => Promise<string>;
    onComplete?: (entry: SubagentEntry) => void;
    onError?: (entry: SubagentEntry, error: Error) => void;
}): SubagentOrchestrator {
    const { registry, execute, onComplete, onError } = params;
    let idCounter = 0;

    const spawn = async (spawnParams: SpawnSubagentParams): Promise<SubagentEntry> => {
        const id = `sub_${Date.now()}_${++idCounter}`;
        const entry = registry.register({
            id,
            parentSessionId: spawnParams.parentSessionId,
            agentId: spawnParams.agentId,
            task: spawnParams.task,
            metadata: { ...spawnParams.metadata, model: spawnParams.model, maxTokens: spawnParams.maxTokens },
        });

        registry.start(id);

        // Execute async — don't await
        void (async () => {
            try {
                const result = await Promise.race([
                    execute(entry),
                    ...(spawnParams.timeoutMs ? [timeoutPromise(spawnParams.timeoutMs)] : []),
                ]);
                registry.complete(id, result);
                onComplete?.(registry.get(id)!);
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                registry.fail(id, error.message);
                onError?.(registry.get(id)!, error);
            }
        })();

        return entry;
    };

    const list = (parentSessionId: string) => registry.listForParent(parentSessionId);
    const listRunning = () => registry.listRunning();

    const steer = async (id: string, _instruction: string): Promise<boolean> => {
        const entry = registry.get(id);
        if (!entry || entry.status !== 'running') return false;
        // Steering is stored as metadata; actual steering depends on execution model
        if (!entry.metadata) entry.metadata = {};
        entry.metadata.lastSteer = _instruction;
        entry.metadata.steeredAt = Date.now();
        return true;
    };

    const cancel = async (id: string): Promise<boolean> => registry.cancel(id);

    const waitFor = async (id: string, timeoutMs = 60_000): Promise<SubagentEntry | null> => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const entry = registry.get(id);
            if (!entry) return null;
            if (entry.status === 'completed' || entry.status === 'failed' || entry.status === 'cancelled') return entry;
            await new Promise((r) => setTimeout(r, 200));
        }
        return registry.get(id) ?? null;
    };

    return { spawn, list, listRunning, steer, cancel, waitFor };
}

function timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(`Subagent timeout after ${ms}ms`)), ms));
}

/**
 * Format subagent list for display.
 */
export function formatSubagentList(entries: SubagentEntry[]): string {
    if (entries.length === 0) return '  No subagents.';
    const header = '  ID                    Agent       Status     Task';
    const sep = '  ' + '─'.repeat(65);
    const rows = entries.map((e) => {
        const task = e.task.length > 30 ? e.task.slice(0, 27) + '...' : e.task;
        return `  ${e.id.padEnd(22)} ${e.agentId.padEnd(10)} ${e.status.padEnd(10)} ${task}`;
    });
    return [header, sep, ...rows].join('\n');
}
