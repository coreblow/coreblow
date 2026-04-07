/**
 * CoreBlow Phase 25 — Testing & Quality Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../../src/infra/dependency-graph.js';
import { CodeQualityAnalyzer } from '../../src/observability/code-quality.js';
import { FeatureFlags } from '../../src/infra/feature-flags.js';
import { RetryPolicy } from '../../src/infra/retry-policy.js';

// ================================================================
// Dependency Graph Tests
// ================================================================
describe('DependencyGraph', () => {
    let graph: DependencyGraph;
    beforeEach(() => { graph = new DependencyGraph(); });

    it('should add nodes', () => {
        graph.addNode('a', 'Module A', 'module');
        expect(graph.count()).toBe(1);
    });

    it('should add edges', () => {
        graph.addNode('a', 'A', 'mod');
        graph.addNode('b', 'B', 'mod');
        expect(graph.addEdge('a', 'b')).toBe(true);
        expect(graph.getNode('a')?.dependencies).toContain('b');
    });

    it('should detect cycles', () => {
        graph.addNode('a', 'A', 'mod');
        graph.addNode('b', 'B', 'mod');
        graph.addEdge('a', 'b');
        graph.addEdge('b', 'a');
        expect(graph.detectCycles().length).toBeGreaterThan(0);
    });

    it('should topological sort', () => {
        graph.addNode('a', 'A', 'mod');
        graph.addNode('b', 'B', 'mod');
        graph.addNode('c', 'C', 'mod');
        graph.addEdge('c', 'b');
        graph.addEdge('b', 'a');
        const sorted = graph.topologicalSort();
        expect(sorted.indexOf('a')).toBeLessThan(sorted.indexOf('b'));
    });

    it('should analyze impact', () => {
        graph.addNode('core', 'Core', 'mod');
        graph.addNode('api', 'API', 'mod');
        graph.addNode('cli', 'CLI', 'mod');
        graph.addEdge('api', 'core');
        graph.addEdge('cli', 'core');
        const impact = graph.analyzeImpact('core');
        expect(impact.totalImpacted).toBe(2);
    });

    it('should list nodes', () => {
        graph.addNode('a', 'A', 'mod');
        graph.addNode('b', 'B', 'mod');
        expect(graph.list()).toHaveLength(2);
    });
});

// ================================================================
// Code Quality Analyzer Tests
// ================================================================
describe('CodeQualityAnalyzer', () => {
    let analyzer: CodeQualityAnalyzer;
    beforeEach(() => { analyzer = new CodeQualityAnalyzer(); });

    it('should register modules', () => {
        analyzer.registerModule({ name: 'gateway', linesOfCode: 200, exportCount: 10, complexity: 5, testCount: 30, testsPassing: 30 });
        expect(analyzer.count()).toBe(1);
    });

    it('should generate report', () => {
        analyzer.registerModule({ name: 'a', linesOfCode: 100, exportCount: 5, complexity: 3, testCount: 10, testsPassing: 10, coverage: 0.9 });
        const report = analyzer.generateReport();
        expect(report.totalModules).toBe(1);
        expect(report.testPassRate).toBe(1);
    });

    it('should detect issues', () => {
        analyzer.registerModule({ name: 'bad', linesOfCode: 600, exportCount: 2, complexity: 25, testCount: 0, testsPassing: 0 });
        const report = analyzer.generateReport();
        expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should score modules', () => {
        analyzer.registerModule({ name: 'good', linesOfCode: 100, exportCount: 5, complexity: 3, testCount: 10, testsPassing: 10, coverage: 0.95 });
        expect(analyzer.getModuleScore('good')).toBeGreaterThan(80);
    });

    it('should list by quality', () => {
        analyzer.registerModule({ name: 'a', linesOfCode: 100, exportCount: 5, complexity: 3, testCount: 10, testsPassing: 10 });
        analyzer.registerModule({ name: 'b', linesOfCode: 100, exportCount: 5, complexity: 3, testCount: 0, testsPassing: 0 });
        const list = analyzer.listByQuality();
        expect(list[0]!.name).toBe('a');
    });
});

// ================================================================
// Feature Flags Tests
// ================================================================
describe('FeatureFlags', () => {
    let flags: FeatureFlags;
    beforeEach(() => { flags = new FeatureFlags(); });

    it('should define flags', () => {
        flags.define('dark-mode', 'Dark Mode', true);
        expect(flags.count()).toBe(1);
    });

    it('should check enabled', () => {
        flags.define('feature-a', 'Feature A', true);
        expect(flags.isEnabled('feature-a')).toBe(true);
    });

    it('should check disabled', () => {
        flags.define('feature-b', 'Feature B', false);
        expect(flags.isEnabled('feature-b')).toBe(false);
    });

    it('should toggle', () => {
        flags.define('x', 'X', true);
        flags.toggle('x');
        expect(flags.isEnabled('x')).toBe(false);
    });

    it('should target users', () => {
        flags.define('beta', 'Beta', true, { targetUsers: ['user1'] });
        expect(flags.isEnabled('beta', { userId: 'user1' })).toBe(true);
        expect(flags.isEnabled('beta', { userId: 'user2' })).toBe(false);
    });

    it('should target channels', () => {
        flags.define('ch', 'Channel', true, { targetChannels: ['discord'] });
        expect(flags.isEnabled('ch', { channel: 'discord' })).toBe(true);
        expect(flags.isEnabled('ch', { channel: 'telegram' })).toBe(false);
    });

    it('should list flags', () => {
        flags.define('a', 'A', true);
        flags.define('b', 'B', false);
        expect(flags.list()).toHaveLength(2);
    });

    it('should delete flags', () => {
        flags.define('temp', 'Temp', true);
        expect(flags.delete('temp')).toBe(true);
    });
});

// ================================================================
// Retry Policy Tests
// ================================================================
describe('RetryPolicy', () => {
    it('should succeed on first try', async () => {
        const policy = new RetryPolicy();
        const result = await policy.execute(async () => 'ok');
        expect(result.success).toBe(true);
        expect(result.data).toBe('ok');
        expect(result.attempts).toBe(1);
    });

    it('should retry on failure', async () => {
        const policy = new RetryPolicy({ maxRetries: 2, baseDelayMs: 10 });
        let attempt = 0;
        const result = await policy.execute(async () => {
            attempt++;
            if (attempt < 3) throw new Error('fail');
            return 'ok';
        });
        expect(result.success).toBe(true);
        expect(result.attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
        const policy = new RetryPolicy({ maxRetries: 1, baseDelayMs: 10 });
        const result = await policy.execute(async () => { throw new Error('always fail'); });
        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('always fail');
    });

    it('should track stats', async () => {
        const policy = new RetryPolicy({ maxRetries: 0 });
        await policy.execute(async () => 'ok');
        const stats = policy.getStats();
        expect(stats.totalCalls).toBe(1);
        expect(stats.totalSuccess).toBe(1);
    });

    it('should have presets', () => {
        expect(RetryPolicy.aggressive()).toBeInstanceOf(RetryPolicy);
        expect(RetryPolicy.conservative()).toBeInstanceOf(RetryPolicy);
        expect(RetryPolicy.noRetry()).toBeInstanceOf(RetryPolicy);
    });

    it('should support conditional retry', async () => {
        let calls = 0;
        const policy = new RetryPolicy({ maxRetries: 3, baseDelayMs: 10, retryOn: (err) => err.message === 'transient' });
        const result = await policy.execute(async () => { calls++; throw new Error('permanent'); });
        expect(result.success).toBe(false);
        expect(calls).toBe(1); // Only called once, no retries
    });
});
