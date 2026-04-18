/**
 * agents/subagent-registry.test.ts
 */
import { describe, it, expect } from 'vitest';
import { SubagentRegistry } from './subagent-registry.js';

describe('Subagent Registry', () => {
    it('registers and retrieves', () => {
        const reg = new SubagentRegistry();
        const entry = reg.register({ id: 'sub-1', parentSessionId: 'p1', agentId: 'agent-a', task: 'do stuff' });
        expect(entry.status).toBe('pending');
        expect(reg.get('sub-1')).toBe(entry);
    });

    it('starts', () => {
        const reg = new SubagentRegistry();
        reg.register({ id: 'sub-1', parentSessionId: 'p1', agentId: 'a', task: 't' });
        expect(reg.start('sub-1')).toBe(true);
        expect(reg.get('sub-1')!.status).toBe('running');
    });

    it('completes', () => {
        const reg = new SubagentRegistry();
        reg.register({ id: 'sub-1', parentSessionId: 'p1', agentId: 'a', task: 't' });
        reg.start('sub-1');
        expect(reg.complete('sub-1', 'done')).toBe(true);
        expect(reg.get('sub-1')!.status).toBe('completed');
        expect(reg.get('sub-1')!.result).toBe('done');
    });

    it('fails', () => {
        const reg = new SubagentRegistry();
        reg.register({ id: 'sub-1', parentSessionId: 'p1', agentId: 'a', task: 't' });
        reg.start('sub-1');
        expect(reg.fail('sub-1', 'oops')).toBe(true);
        expect(reg.get('sub-1')!.error).toBe('oops');
    });

    it('cancels', () => {
        const reg = new SubagentRegistry();
        reg.register({ id: 'sub-1', parentSessionId: 'p1', agentId: 'a', task: 't' });
        expect(reg.cancel('sub-1')).toBe(true);
        expect(reg.get('sub-1')!.status).toBe('cancelled');
    });

    it('lists for parent', () => {
        const reg = new SubagentRegistry();
        reg.register({ id: 's1', parentSessionId: 'p1', agentId: 'a', task: 't1' });
        reg.register({ id: 's2', parentSessionId: 'p1', agentId: 'a', task: 't2' });
        reg.register({ id: 's3', parentSessionId: 'p2', agentId: 'a', task: 't3' });
        expect(reg.listForParent('p1')).toHaveLength(2);
    });

    it('lists running', () => {
        const reg = new SubagentRegistry();
        reg.register({ id: 's1', parentSessionId: 'p1', agentId: 'a', task: 't' });
        reg.register({ id: 's2', parentSessionId: 'p1', agentId: 'a', task: 't' });
        reg.start('s1');
        expect(reg.listRunning()).toHaveLength(1);
    });

    it('prunes old entries', () => {
        const reg = new SubagentRegistry();
        const entry = reg.register({ id: 's1', parentSessionId: 'p1', agentId: 'a', task: 't' });
        (entry as any).createdAt = Date.now() - 100_000;
        expect(reg.prune(50_000)).toBe(1);
        expect(reg.size()).toBe(0);
    });
});
