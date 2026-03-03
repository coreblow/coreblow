import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolExecutor, type ToolExecutionResult } from './tool-executor.js';
import { ToolRegistry, type ToolDefinition } from './tool-registry.js';

function makeTool(name: string, handler: ToolDefinition['handler']): ToolDefinition {
    return {
        name,
        description: `Test tool ${name}`,
        parameters: { type: 'object' as const, properties: {}, required: [] },
        handler,
    };
}

describe('ToolExecutor', () => {
    let registry: ToolRegistry;
    let executor: ToolExecutor;

    beforeEach(() => {
        registry = new ToolRegistry();
        executor = new ToolExecutor(registry, { timeoutMs: 5000, maxRetries: 1, maxConcurrent: 3 });
    });

    // === Successful Execution ===

    describe('execute (success)', () => {
        it('returns success result for a valid tool call', async () => {
            registry.register(makeTool('echo', async (args) => `Hello ${args['name']}`));
            const result = await executor.execute('echo', { name: 'World' }, 'call-1');

            expect(result.success).toBe(true);
            expect(result.toolName).toBe('echo');
            expect(result.callId).toBe('call-1');
            expect(result.output).toBe('Hello World');
            expect(result.error).toBeUndefined();
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.timestamp).toBeGreaterThan(0);
        });

        it('generates empty callId when not provided', async () => {
            registry.register(makeTool('noop', async () => 'done'));
            const result = await executor.execute('noop', {});
            expect(result.callId).toBe('');
        });
    });

    // === Error Cases ===

    describe('execute (errors)', () => {
        it('returns error for non-existent tool', async () => {
            const result = await executor.execute('ghost', {});
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('returns error for disabled tool', async () => {
            registry.register(makeTool('disabled', async () => 'nope'));
            registry.setEnabled('disabled', false);
            const result = await executor.execute('disabled', {});
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found or disabled');
        });

        it('captures handler errors', async () => {
            registry.register(makeTool('bomb', async () => { throw new Error('kaboom'); }));
            const result = await executor.execute('bomb', {});
            expect(result.success).toBe(false);
            expect(result.error).toBe('kaboom');
        });

        it('captures non-Error throws', async () => {
            registry.register(makeTool('string-throw', async () => { throw 'yikes'; }));
            const result = await executor.execute('string-throw', {});
            expect(result.success).toBe(false);
            expect(result.error).toBe('yikes');
        });
    });

    // === Concurrency ===

    describe('concurrency limit', () => {
        it('rejects when max concurrent calls reached', async () => {
            const slow = async () => { await new Promise((r) => setTimeout(r, 200)); return 'done'; };
            registry.register(makeTool('slow', slow));

            // Fire 3 concurrent (at limit)
            const p1 = executor.execute('slow', {}, 'c1');
            const p2 = executor.execute('slow', {}, 'c2');
            const p3 = executor.execute('slow', {}, 'c3');

            // 4th should be rejected
            const p4 = executor.execute('slow', {}, 'c4');
            const result4 = await p4;
            expect(result4.success).toBe(false);
            expect(result4.error).toContain('concurrent');

            // Wait for others
            await Promise.all([p1, p2, p3]);
        });
    });

    // === Batch Execution ===

    describe('executeMany', () => {
        it('executes multiple calls in parallel', async () => {
            registry.register(makeTool('add', async (args) => String(Number(args['a']) + Number(args['b']))));

            const results = await executor.executeMany([
                { toolName: 'add', args: { a: 1, b: 2 }, callId: 'c1' },
                { toolName: 'add', args: { a: 3, b: 4 }, callId: 'c2' },
            ]);

            expect(results).toHaveLength(2);
            expect(results[0]!.output).toBe('3');
            expect(results[1]!.output).toBe('7');
        });
    });

    // === History & Stats ===

    describe('getHistory', () => {
        it('records execution history', async () => {
            registry.register(makeTool('log', async () => 'logged'));
            await executor.execute('log', {});
            await executor.execute('log', {});

            const history = executor.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0]!.toolName).toBe('log');
        });

        it('respects limit parameter', async () => {
            registry.register(makeTool('log', async () => 'ok'));
            for (let i = 0; i < 10; i++) await executor.execute('log', {});

            expect(executor.getHistory(3)).toHaveLength(3);
        });
    });

    describe('getStats', () => {
        it('returns zero stats when no calls made', () => {
            const stats = executor.getStats();
            expect(stats.totalCalls).toBe(0);
            expect(stats.successRate).toBe(0);
            expect(stats.avgDurationMs).toBe(0);
            expect(stats.activeCalls).toBe(0);
        });

        it('calculates success rate correctly', async () => {
            registry.register(makeTool('ok', async () => 'fine'));
            registry.register(makeTool('fail', async () => { throw new Error('no'); }));

            await executor.execute('ok', {});
            await executor.execute('ok', {});
            await executor.execute('fail', {});

            const stats = executor.getStats();
            expect(stats.totalCalls).toBe(3);
            expect(stats.successRate).toBeCloseTo(2 / 3, 2);
        });
    });
});
