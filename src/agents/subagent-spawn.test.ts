/**
 * agents/subagent-spawn.test.ts
 */
import { describe, it, expect } from 'vitest';
import { SubagentRegistry } from './subagent-registry.js';
import { createSubagentOrchestrator, formatSubagentList } from './subagent-spawn.js';

describe('Subagent Spawn', () => {
    it('spawns and completes', async () => {
        const registry = new SubagentRegistry();
        const orchestrator = createSubagentOrchestrator({
            registry,
            execute: async () => 'done',
        });
        const entry = await orchestrator.spawn({ parentSessionId: 'p1', agentId: 'test', task: 'do stuff' });
        expect(entry.status).toBe('running');
        const result = await orchestrator.waitFor(entry.id, 2000);
        expect(result).not.toBeNull();
        expect(result!.status).toBe('completed');
        expect(result!.result).toBe('done');
    });

    it('handles execution errors', async () => {
        const registry = new SubagentRegistry();
        let errorCaptured: Error | null = null;
        const orchestrator = createSubagentOrchestrator({
            registry,
            execute: async () => { throw new Error('boom'); },
            onError: (_e, err) => { errorCaptured = err; },
        });
        const entry = await orchestrator.spawn({ parentSessionId: 'p1', agentId: 'test', task: 'fail' });
        const result = await orchestrator.waitFor(entry.id, 2000);
        expect(result!.status).toBe('failed');
        expect(result!.error).toBe('boom');
        expect(errorCaptured).not.toBeNull();
    });

    it('lists for parent', async () => {
        const registry = new SubagentRegistry();
        const orchestrator = createSubagentOrchestrator({
            registry,
            execute: async () => 'ok',
        });
        await orchestrator.spawn({ parentSessionId: 'p1', agentId: 'a', task: 't1' });
        await orchestrator.spawn({ parentSessionId: 'p1', agentId: 'a', task: 't2' });
        await orchestrator.spawn({ parentSessionId: 'p2', agentId: 'a', task: 't3' });
        expect(orchestrator.list('p1')).toHaveLength(2);
    });

    it('lists running', async () => {
        const registry = new SubagentRegistry();
        let resolveExec: ((v: string) => void) | null = null;
        const orchestrator = createSubagentOrchestrator({
            registry,
            execute: () => new Promise<string>((r) => { resolveExec = r; }),
        });
        await orchestrator.spawn({ parentSessionId: 'p1', agentId: 'a', task: 't' });
        expect(orchestrator.listRunning()).toHaveLength(1);
        resolveExec!('done');
    });

    it('cancels', async () => {
        const registry = new SubagentRegistry();
        let resolveExec: ((v: string) => void) | null = null;
        const orchestrator = createSubagentOrchestrator({
            registry,
            execute: () => new Promise<string>((r) => { resolveExec = r; }),
        });
        const entry = await orchestrator.spawn({ parentSessionId: 'p1', agentId: 'a', task: 't' });
        const cancelled = await orchestrator.cancel(entry.id);
        expect(cancelled).toBe(true);
        expect(registry.get(entry.id)!.status).toBe('cancelled');
        resolveExec!('never');
    });

    it('steers', async () => {
        const registry = new SubagentRegistry();
        let resolveExec: ((v: string) => void) | null = null;
        const orchestrator = createSubagentOrchestrator({
            registry,
            execute: () => new Promise<string>((r) => { resolveExec = r; }),
        });
        const entry = await orchestrator.spawn({ parentSessionId: 'p1', agentId: 'a', task: 't' });
        const steered = await orchestrator.steer(entry.id, 'focus on X');
        expect(steered).toBe(true);
        expect(registry.get(entry.id)!.metadata?.lastSteer).toBe('focus on X');
        resolveExec!('done');
    });
});

describe('formatSubagentList', () => {
    it('formats empty list', () => {
        expect(formatSubagentList([])).toContain('No subagents');
    });
    it('formats entries', () => {
        const entries = [
            { id: 'sub-1', parentSessionId: 'p', agentId: 'test', task: 'hello', status: 'running' as const, createdAt: Date.now(), usageCount: 0, errorCount: 0 },
        ];
        const output = formatSubagentList(entries);
        expect(output).toContain('sub-1');
        expect(output).toContain('running');
    });
});
