// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginExecutor } from './executor.js';

// Mock HookRunner
function createMockHookRunner(overrides: Record<string, Function> = {}) {
    return {
        runBeforeToolCall: overrides.runBeforeToolCall ?? (async () => null),
        runAfterToolCall: overrides.runAfterToolCall ?? (async () => {}),
        runBeforeAgentStart: overrides.runBeforeAgentStart ?? (async () => undefined),
        runAgentEnd: overrides.runAgentEnd ?? (async () => {}),
        runBeforeCompaction: overrides.runBeforeCompaction ?? (async () => {}),
        runAfterCompaction: overrides.runAfterCompaction ?? (async () => {}),
        runInboundClaim: overrides.runInboundClaim ?? (async () => null),
    };
}

describe('Plugin Executor — Phase 10', () => {
    it('beforeToolCall passes through when not blocked', async () => {
        const executor = new PluginExecutor(createMockHookRunner());
        const result = await executor.beforeToolCall('read_file', { path: '/test' }, 'sess-1');
        expect(result.blocked).toBe(false);
    });

    it('beforeToolCall blocks when hook says block', async () => {
        const executor = new PluginExecutor(createMockHookRunner({
            runBeforeToolCall: async () => ({ block: true, blockReason: 'Forbidden tool' }),
        }));
        const result = await executor.beforeToolCall('rm_file', {}, 'sess-1');
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Forbidden tool');
    });

    it('beforeToolCall returns modified params', async () => {
        const executor = new PluginExecutor(createMockHookRunner({
            runBeforeToolCall: async () => ({ block: false, params: { sanitized: true } }),
        }));
        const result = await executor.beforeToolCall('write', { content: 'x' }, 'sess-1');
        expect(result.blocked).toBe(false);
        expect(result.modifiedParams).toEqual({ sanitized: true });
    });

    it('beforeToolCall handles hook error gracefully', async () => {
        const executor = new PluginExecutor(createMockHookRunner({
            runBeforeToolCall: async () => { throw new Error('hook crash'); },
        }));
        const result = await executor.beforeToolCall('tool', {}, 'sess-1');
        expect(result.blocked).toBe(false); // fail-open
    });

    it('afterToolCall succeeds silently', async () => {
        const executor = new PluginExecutor(createMockHookRunner());
        await executor.afterToolCall('tool', { output: 'result' }, 'sess-1');
        // No error thrown
    });

    it('afterToolCall handles error gracefully', async () => {
        const executor = new PluginExecutor(createMockHookRunner({
            runAfterToolCall: async () => { throw new Error('after hook crash'); },
        }));
        await executor.afterToolCall('tool', {}, 'sess-1');
        expect(executor.getStats().errors).toBe(1);
    });

    it('beforeAgentStart fires and returns result', async () => {
        const executor = new PluginExecutor(createMockHookRunner({
            runBeforeAgentStart: async () => ({ customModel: 'gpt-4o' }),
        }));
        const result = await executor.beforeAgentStart('sess-1', 'claude', 1);
        expect(result).toEqual({ customModel: 'gpt-4o' });
    });

    it('agentEnd fires', async () => {
        let called = false;
        const executor = new PluginExecutor(createMockHookRunner({
            runAgentEnd: async () => { called = true; },
        }));
        await executor.agentEnd('sess-1');
        expect(called).toBe(true);
    });

    it('compaction hooks fire', async () => {
        let beforeCalled = false, afterCalled = false;
        const executor = new PluginExecutor(createMockHookRunner({
            runBeforeCompaction: async () => { beforeCalled = true; },
            runAfterCompaction: async () => { afterCalled = true; },
        }));
        await executor.beforeCompaction('sess-1');
        await executor.afterCompaction('sess-1', { tokens: 500 });
        expect(beforeCalled).toBe(true);
        expect(afterCalled).toBe(true);
    });

    it('tryInboundClaim returns claimed when handled', async () => {
        const executor = new PluginExecutor(createMockHookRunner({
            runInboundClaim: async () => ({ handled: true, response: 'Plugin handled it' }),
        }));
        const result = await executor.tryInboundClaim('hello', 'sess-1', 'discord');
        expect(result.claimed).toBe(true);
        expect(result.response).toBe('Plugin handled it');
    });

    it('tryInboundClaim returns not claimed', async () => {
        const executor = new PluginExecutor(createMockHookRunner());
        const result = await executor.tryInboundClaim('hello', 'sess-1', 'slack');
        expect(result.claimed).toBe(false);
    });

    it('getStats tracks all operations', async () => {
        const executor = new PluginExecutor(createMockHookRunner());
        await executor.beforeToolCall('a', {}, 's');
        await executor.beforeToolCall('b', {}, 's');
        await executor.beforeAgentStart('s');
        await executor.agentEnd('s');
        await executor.beforeCompaction('s');
        const stats = executor.getStats();
        expect(stats.toolCallsProcessed).toBe(2);
        expect(stats.agentStartsFired).toBe(1);
        expect(stats.agentEndsFired).toBe(1);
        expect(stats.compactionsFired).toBe(1);
    });

    it('resetStats clears counters', async () => {
        const executor = new PluginExecutor(createMockHookRunner());
        await executor.beforeToolCall('a', {}, 's');
        executor.resetStats();
        expect(executor.getStats().toolCallsProcessed).toBe(0);
    });
});
