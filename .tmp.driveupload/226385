/**
 * CoreBlow Phase 33 — Testing Infrastructure Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TestRunner } from '../../src/tools/test-runner.js';
import { MockFactory } from '../../src/tools/mock-factory.js';
import { FixtureManager } from '../../src/tools/fixture-manager.js';
import { SnapshotTesting } from '../../src/tools/snapshot-testing.js';
import { CoverageReporter } from '../../src/tools/coverage-reporter.js';

// ================================================================
describe('TestRunner', () => {
    let runner: TestRunner;
    beforeEach(() => { runner = new TestRunner(); });

    it('should run passing tests', async () => {
        runner.addSuite({ name: 'basic', tests: [{ name: 'pass', fn: async () => {} }] });
        const report = await runner.run();
        expect(report.passed).toBe(1);
    });

    it('should catch failing tests', async () => {
        runner.addSuite({ name: 'basic', tests: [{ name: 'fail', fn: async () => { throw new Error('boom'); } }] });
        const report = await runner.run();
        expect(report.failed).toBe(1);
    });

    it('should skip tests', async () => {
        runner.addSuite({ name: 'basic', tests: [{ name: 'skip', fn: async () => {}, skip: true }] });
        const report = await runner.run();
        expect(report.skipped).toBe(1);
    });

    it('should handle timeouts', async () => {
        runner.addSuite({ name: 'basic', tests: [{ name: 'slow', fn: async () => { await new Promise(r => setTimeout(r, 200)); }, timeout: 50 }] });
        const report = await runner.run();
        expect(report.results[0]?.status).toBe('timeout');
    });

    it('should run lifecycle hooks', async () => {
        const order: string[] = [];
        runner.addSuite({
            name: 'hooks', tests: [{ name: 't', fn: async () => { order.push('test'); } }],
            beforeAll: async () => { order.push('beforeAll'); },
            afterAll: async () => { order.push('afterAll'); },
        });
        await runner.run();
        expect(order).toEqual(['beforeAll', 'test', 'afterAll']);
    });
});

// ================================================================
describe('MockFactory', () => {
    let factory: MockFactory;
    beforeEach(() => { factory = new MockFactory(); });

    it('should create spy', () => {
        const spy = factory.createSpy('result');
        expect(spy('arg1')).toBe('result');
        expect(spy.callCount).toBe(1);
        expect(spy.lastCall?.args).toEqual(['arg1']);
    });

    it('should create sequence spy', () => {
        const spy = factory.createSequenceSpy([1, 2, 3]);
        expect(spy()).toBe(1);
        expect(spy()).toBe(2);
        expect(spy()).toBe(3);
    });

    it('should reset spy', () => {
        const spy = factory.createSpy();
        spy(); spy();
        spy.reset();
        expect(spy.callCount).toBe(0);
    });

    it('should create mock objects', () => {
        const mock = factory.createMock({ greet: () => 'hello', name: 'test' });
        mock.greet();
        expect(mock.__mocks.greet.callCount).toBe(1);
        expect(mock.name).toBe('test');
    });

    it('should register/get named mocks', () => {
        factory.register('db', { connected: true });
        expect(factory.get('db')).toEqual({ connected: true });
    });
});

// ================================================================
describe('FixtureManager', () => {
    let fm: FixtureManager;
    beforeEach(() => {
        fm = new FixtureManager();
        fm.define('user', (overrides?: Partial<{ name: string; age: number }>) => ({
            name: overrides?.name ?? 'Alice', age: overrides?.age ?? 25,
        }));
    });

    it('should create fixtures', () => {
        const user = fm.create<{ name: string; age: number }>('user');
        expect(user.name).toBe('Alice');
    });

    it('should override', () => {
        const user = fm.create<{ name: string }>('user', { name: 'Bob' });
        expect(user.name).toBe('Bob');
    });

    it('should create many', () => {
        const users = fm.createMany('user', 3);
        expect(users).toHaveLength(3);
    });

    it('should manage sets', () => {
        fm.defineSet('team', [{ name: 'user', overrides: { name: 'A' } }, { name: 'user', overrides: { name: 'B' } }]);
        const team = fm.loadSet('team') as Array<{ name: string }>;
        expect(team).toHaveLength(2);
    });

    it('should list fixtures', () => {
        expect(fm.list()).toContain('user');
    });
});

// ================================================================
describe('SnapshotTesting', () => {
    let snap: SnapshotTesting;
    beforeEach(() => { snap = new SnapshotTesting(); });

    it('should create new snapshots', () => {
        const result = snap.match('key1', { a: 1 });
        expect(result.match).toBe(true);
        expect(snap.count()).toBe(1);
    });

    it('should match existing', () => {
        snap.match('key1', { a: 1 });
        const result = snap.match('key1', { a: 1 });
        expect(result.match).toBe(true);
    });

    it('should detect changes', () => {
        snap.match('key1', { a: 1 });
        const result = snap.match('key1', { a: 2 });
        expect(result.match).toBe(false);
        expect(result.diff).toBeTruthy();
    });

    it('should update in update mode', () => {
        snap.match('key1', { a: 1 });
        snap.setUpdateMode(true);
        const result = snap.match('key1', { a: 2 });
        expect(result.match).toBe(true);
    });

    it('should track stats', () => {
        snap.match('k1', 'a');
        snap.match('k1', 'a');
        expect(snap.getStats().matched).toBe(1);
    });
});

// ================================================================
describe('CoverageReporter', () => {
    let reporter: CoverageReporter;
    beforeEach(() => {
        reporter = new CoverageReporter();
        reporter.addFile({ file: 'a.ts', lines: { total: 100, covered: 80 }, functions: { total: 20, covered: 16 }, branches: { total: 10, covered: 8 } });
        reporter.addFile({ file: 'b.ts', lines: { total: 50, covered: 50 }, functions: { total: 10, covered: 10 }, branches: { total: 5, covered: 5 } });
    });

    it('should get summary', () => {
        const s = reporter.getSummary();
        expect(s.totalFiles).toBe(2);
        expect(s.lineCoverage).toBeGreaterThan(80);
    });

    it('should detect below threshold', () => {
        reporter.setThreshold(90);
        const s = reporter.getSummary();
        expect(s.belowThreshold).toContain('a.ts');
    });

    it('should generate report', () => {
        const report = reporter.generateReport();
        expect(report).toContain('# Coverage Report');
        expect(report).toContain('Lines');
    });

    it('should get file coverage', () => {
        expect(reporter.getFile('a.ts')?.lines.covered).toBe(80);
    });

    it('should track trend', () => {
        reporter.getSummary();
        reporter.getSummary();
        expect(reporter.getTrend()).toHaveLength(2);
    });
});
