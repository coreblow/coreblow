/**
 * tests/unit/subagent.test.ts
 * Sub-agent System tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Sub-agent Manager', () => {
    let SubagentManager: any;

    beforeEach(async () => {
        const mod = await import('../../subagent.js');
        SubagentManager = mod.SubagentManager;
    });

    function createMgr(config?: any) {
        const mgr = new SubagentManager(config);
        mgr.setExecutor(async (task: any) => `Result for: ${task.name}`);
        return mgr;
    }

    // ── Spawning ──

    it('should spawn a sub-agent', () => {
        const mgr = createMgr();
        const task = mgr.spawn(null, { name: 'test', prompt: 'Do something' });
        expect(task.id).toBeTruthy();
        expect(task.status).toBe('pending');
        expect(task.name).toBe('test');
    });

    it('should enforce max depth', () => {
        const mgr = createMgr({ maxDepth: 2 });
        const t1 = mgr.spawn(null, { name: 'level1', prompt: 'L1' });
        const t2 = mgr.spawn(t1.id, { name: 'level2', prompt: 'L2' });
        expect(() => mgr.spawn(t2.id, { name: 'level3', prompt: 'L3' })).toThrow('Max sub-agent depth');
    });

    it('should enforce max concurrent', async () => {
        const mgr = new SubagentManager({ maxConcurrent: 2, defaultMaxRetries: 0 });
        // Set a slow executor to keep tasks active
        mgr.setExecutor(async () => {
            await new Promise(r => setTimeout(r, 500));
            return 'done';
        });
        const t1 = mgr.spawn(null, { name: 'a', prompt: 'a' });
        const t2 = mgr.spawn(null, { name: 'b', prompt: 'b' });
        // Start both executing (fills up slots)
        const p1 = mgr.execute(t1.id);
        const p2 = mgr.execute(t2.id);
        // Now active count is at max, stats should show 2 active
        expect(mgr.getStats().active).toBe(2);
        await Promise.all([p1, p2]);
    });

    // ── Execution ──

    it('should execute a task', async () => {
        const mgr = createMgr();
        const task = mgr.spawn(null, { name: 'greet', prompt: 'Say hi' });
        const result = await mgr.execute(task.id);
        expect(result.status).toBe('completed');
        expect(result.result).toContain('greet');
    });

    it('should delegate (spawn + execute)', async () => {
        const mgr = createMgr();
        const result = await mgr.delegate(null, { name: 'quick', prompt: 'Do it' });
        expect(result.status).toBe('completed');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle execution failure', async () => {
        const mgr = new SubagentManager({ defaultMaxRetries: 0 });
        mgr.setExecutor(async () => { throw new Error('API error'); });
        const result = await mgr.delegate(null, { name: 'fail', prompt: 'crash' });
        expect(result.status).toBe('failed');
        expect(result.error).toContain('API error');
    });

    it('should retry on failure', async () => {
        let attempt = 0;
        const mgr = new SubagentManager({ defaultMaxRetries: 2 });
        mgr.setExecutor(async () => {
            attempt++;
            if (attempt < 2) throw new Error('Transient');
            return 'Success after retry';
        });
        const result = await mgr.delegate(null, { name: 'retry', prompt: 'try' });
        expect(result.status).toBe('completed');
        expect(result.retries).toBe(1);
    });

    it('should timeout', async () => {
        const mgr = new SubagentManager({ defaultMaxRetries: 0 });
        mgr.setExecutor(async () => {
            await new Promise(r => setTimeout(r, 5000));
            return 'never';
        });
        const result = await mgr.delegate(null, { name: 'slow', prompt: 'wait', timeoutMs: 50 });
        expect(result.status).toBe('timeout');
    });

    // ── Fan-out ──

    it('should fan-out to multiple sub-agents', async () => {
        const mgr = createMgr();
        const results = await mgr.fanOut(null, [
            { name: 'research', prompt: 'Research topic A' },
            { name: 'analyze', prompt: 'Analyze data B' },
            { name: 'summarize', prompt: 'Summarize C' },
        ]);
        expect(results).toHaveLength(3);
        expect(results.every((r: any) => r.status === 'completed')).toBe(true);
    });

    // ── Chain ──

    it('should chain tasks sequentially', async () => {
        const mgr = new SubagentManager();
        const prompts: string[] = [];
        mgr.setExecutor(async (task: any) => {
            prompts.push(task.prompt);
            return `Step done: ${task.name}`;
        });

        const results = await mgr.chain(null, [
            { name: 'step1', prompt: 'First step' },
            { name: 'step2', prompt: 'Second step' },
        ]);

        expect(results).toHaveLength(2);
        expect(results[0].status).toBe('completed');
        // Step 2 should include result from step 1
        expect(prompts[1]).toContain('Previous step result');
    });

    it('should break chain on failure', async () => {
        let callCount = 0;
        const mgr = new SubagentManager({ defaultMaxRetries: 0 });
        mgr.setExecutor(async () => {
            callCount++;
            if (callCount === 2) throw new Error('Chain break');
            return 'ok';
        });

        const results = await mgr.chain(null, [
            { name: 'ok', prompt: 'OK' },
            { name: 'fail', prompt: 'Fail' },
            { name: 'skip', prompt: 'Should not run' },
        ]);

        expect(results).toHaveLength(2); // 3rd task skipped
    });

    // ── Task Tree ──

    it('should get children of a task', async () => {
        const mgr = createMgr();
        const parent = mgr.spawn(null, { name: 'parent', prompt: 'P' });
        mgr.spawn(parent.id, { name: 'child1', prompt: 'C1' });
        mgr.spawn(parent.id, { name: 'child2', prompt: 'C2' });
        expect(mgr.getChildren(parent.id)).toHaveLength(2);
    });

    it('should get task tree', async () => {
        const mgr = createMgr();
        const root = mgr.spawn(null, { name: 'root', prompt: 'R' });
        const child = mgr.spawn(root.id, { name: 'child', prompt: 'C' });
        const tree = mgr.getTree(root.id);
        expect(tree).not.toBeNull();
        expect(tree!.children).toHaveLength(1);
    });

    // ── Context Building ──

    it('should build context from results', async () => {
        const mgr = createMgr();
        const r1 = await mgr.delegate(null, { name: 'Research', prompt: 'Find info' });
        const r2 = await mgr.delegate(null, { name: 'Analysis', prompt: 'Analyze' });
        const context = mgr.buildContext([r1.taskId, r2.taskId]);
        expect(context).toContain('[Sub-agent Results]');
        expect(context).toContain('Research');
        expect(context).toContain('Analysis');
    });

    // ── Stats ──

    it('should get stats', async () => {
        const mgr = createMgr();
        await mgr.delegate(null, { name: 'a', prompt: 'a' });
        await mgr.delegate(null, { name: 'b', prompt: 'b' });
        const stats = mgr.getStats();
        expect(stats.total).toBe(2);
        expect(stats.completed).toBe(2);
        expect(stats.active).toBe(0);
    });

    // ── Cancel ──

    it('should cancel task', () => {
        const mgr = createMgr();
        const task = mgr.spawn(null, { name: 'cancel-me', prompt: 'x' });
        // Can't cancel pending task (not running)
        expect(mgr.cancel(task.id)).toBe(false);
    });

    // ── Cleanup ──

    it('should cleanup old tasks', async () => {
        const mgr = createMgr();
        await mgr.delegate(null, { name: 'old', prompt: 'old' });
        // Wait a tiny bit so completedAt is in the past
        await new Promise(r => setTimeout(r, 10));
        const removed = mgr.cleanup(5); // 5ms max age
        expect(removed).toBe(1);
        expect(mgr.getStats().total).toBe(0);
    });
});
