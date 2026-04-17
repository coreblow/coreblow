/**
 * CoreBlow Phase 41 — Tool Executor Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - ToolExecutor: execute, timeout, retry, concurrency, stats, disabled tools
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolExecutor } from '../../src/tools/tool-executor.js';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import type { ToolDefinition } from '../../src/tools/tool-registry.js';

describe('ToolExecutor — Extended', () => {
    let registry: ToolRegistry;
    let executor: ToolExecutor;

    const mockTool = (name: string, handler: () => Promise<string>): ToolDefinition => ({
        name, description: '', parameters: { type: 'object', properties: {} },
        handler,
    });

    beforeEach(() => {
        registry = new ToolRegistry();
        executor = new ToolExecutor(registry, { timeoutMs: 50, maxRetries: 1, maxConcurrent: 2 });
    });

    it('should execute tool successfully', async () => {
        registry.register(mockTool('fast', async () => 'done'));
        const res = await executor.execute('fast', {});
        expect(res.success).toBe(true);
        expect(res.output).toBe('done');
    });

    it('should reject non-existent or disabled tools', async () => {
        registry.register(mockTool('disabled-tool', async () => 'ok'));
        registry.setEnabled('disabled-tool', false);

        const r1 = await executor.execute('disabled-tool', {});
        expect(r1.success).toBe(false);
        expect(r1.error).toContain('not found or disabled');

        const r2 = await executor.execute('ghost-tool', {});
        expect(r2.success).toBe(false);
    });

    it('should enforce execution timeout', async () => {
        registry.register(mockTool('slow', async () => new Promise(r => setTimeout(() => r('ok'), 200))));
        const res = await executor.execute('slow', {});
        expect(res.success).toBe(false);
        expect(res.error).toContain('timed out');
    });

    it('should retry on failure', async () => {
        let attempts = 0;
        registry.register(mockTool('flaky', async () => {
            attempts++;
            if (attempts === 1) throw new Error('First try failed');
            return 'success on second';
        }));

        const res = await executor.execute('flaky', {});
        expect(res.success).toBe(true);
        expect(res.output).toBe('success on second');
        expect(attempts).toBe(2);
    });

    it('should execute many in parallel', async () => {
        registry.register(mockTool('t', async () => 'ok'));
        const res = await executor.executeMany([
            { toolName: 't', args: {}, callId: '1' },
            { toolName: 't', args: {}, callId: '2' },
        ]);
        expect(res).toHaveLength(2);
        expect(res.every(r => r.success)).toBe(true);
    });

    it('should enforce concurrency limit', async () => {
        let active = 0;
        registry.register(mockTool('t', async () => {
            active++;
            await new Promise(r => setTimeout(r, 10));
            active--;
            return 'ok';
        }));

        const p1 = executor.execute('t', {});
        const p2 = executor.execute('t', {});
        const p3 = executor.execute('t', {}); // concurrency set to 2 in beforeEach

        const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
        // r3 should fail due to concurrency limit
        expect(r3?.success).toBe(false);
        expect(r3?.error).toContain('Too many concurrent');
    });

    it('should track stats and history', async () => {
        registry.register(mockTool('succeed', async () => 'ok'));
        registry.register(mockTool('fail', async () => { throw new Error('err'); }));

        await executor.execute('succeed', {});
        await executor.execute('succeed', {});
        await executor.execute('fail', {});

        const history = executor.getHistory();
        expect(history).toHaveLength(3);

        const stats = executor.getStats();
        expect(stats.totalCalls).toBe(3);
        expect(stats.successRate).toBeCloseTo(0.66, 1); // 2/3
        expect(stats.activeCalls).toBe(0);
    });
});
