import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentTracker, type Incident } from './incident-tracker.js';
import { CodeQualityAnalyzer, type ModuleMetrics } from './code-quality.js';

// ─── IncidentTracker ────────────────────────────────────────────

describe('IncidentTracker', () => {
    let tracker: IncidentTracker;

    beforeEach(() => {
        tracker = new IncidentTracker();
    });

    describe('create', () => {
        it('creates an incident', () => {
            const inc = tracker.create('DB Down', 'sev1', 'Database unreachable');
            expect(inc.id).toMatch(/^inc-/);
            expect(inc.title).toBe('DB Down');
            expect(inc.severity).toBe('sev1');
            expect(inc.status).toBe('open');
            expect(inc.timeline).toHaveLength(1);
            expect(inc.timeline[0].action).toContain('created');
        });

        it('assigns unique IDs', () => {
            const i1 = tracker.create('A', 'sev2', 'x');
            const i2 = tracker.create('B', 'sev3', 'y');
            expect(i1.id).not.toBe(i2.id);
        });
    });

    describe('updateStatus', () => {
        it('updates status and adds timeline entry', () => {
            const inc = tracker.create('Test', 'sev2', 'desc');
            expect(tracker.updateStatus(inc.id, 'investigating', 'alice')).toBe(true);
            const updated = tracker.get(inc.id)!;
            expect(updated.status).toBe('investigating');
            expect(updated.timeline).toHaveLength(2);
            expect(updated.timeline[1].actor).toBe('alice');
        });

        it('sets resolvedAt when resolved', () => {
            const inc = tracker.create('Test', 'sev3', 'desc');
            tracker.updateStatus(inc.id, 'resolved');
            expect(tracker.get(inc.id)!.resolvedAt).toBeDefined();
        });

        it('returns false for unknown ID', () => {
            expect(tracker.updateStatus('fake', 'resolved')).toBe(false);
        });
    });

    describe('assign', () => {
        it('assigns an incident', () => {
            const inc = tracker.create('T', 'sev2', 'd');
            expect(tracker.assign(inc.id, 'bob')).toBe(true);
            expect(tracker.get(inc.id)!.assignee).toBe('bob');
        });

        it('returns false for unknown ID', () => {
            expect(tracker.assign('fake', 'bob')).toBe(false);
        });
    });

    describe('addTimelineEntry', () => {
        it('adds timeline entry', () => {
            const inc = tracker.create('T', 'sev2', 'd');
            tracker.addTimelineEntry(inc.id, 'Root cause identified', 'alice');
            expect(tracker.get(inc.id)!.timeline).toHaveLength(2);
        });

        it('returns false for unknown ID', () => {
            expect(tracker.addTimelineEntry('fake', 'x')).toBe(false);
        });
    });

    describe('addPostmortem', () => {
        it('adds postmortem', () => {
            const inc = tracker.create('T', 'sev1', 'd');
            expect(tracker.addPostmortem(inc.id, 'Root cause: config drift')).toBe(true);
            expect(tracker.get(inc.id)!.postmortem).toContain('config drift');
        });
    });

    describe('getActive', () => {
        it('returns only non-resolved incidents', () => {
            const i1 = tracker.create('A', 'sev1', 'd');
            const i2 = tracker.create('B', 'sev2', 'd');
            tracker.updateStatus(i1.id, 'resolved');
            expect(tracker.getActive()).toHaveLength(1);
            expect(tracker.getActive()[0].id).toBe(i2.id);
        });
    });

    describe('getBySeverity', () => {
        it('filters by severity', () => {
            tracker.create('A', 'sev1', 'd');
            tracker.create('B', 'sev1', 'd');
            tracker.create('C', 'sev3', 'd');
            expect(tracker.getBySeverity('sev1')).toHaveLength(2);
            expect(tracker.getBySeverity('sev3')).toHaveLength(1);
            expect(tracker.getBySeverity('sev4')).toHaveLength(0);
        });
    });

    describe('getMTTR', () => {
        it('returns 0 when no resolved incidents', () => {
            tracker.create('A', 'sev1', 'd');
            expect(tracker.getMTTR()).toBe(0);
        });

        it('calculates MTTR for resolved incidents', () => {
            const inc = tracker.create('A', 'sev1', 'd');
            tracker.updateStatus(inc.id, 'resolved');
            expect(tracker.getMTTR()).toBeGreaterThanOrEqual(0);
        });
    });
});

// ─── CodeQualityAnalyzer ────────────────────────────────────────

describe('CodeQualityAnalyzer', () => {
    let analyzer: CodeQualityAnalyzer;

    const mkMod = (name: string, overrides?: Partial<ModuleMetrics>): ModuleMetrics => ({
        name, linesOfCode: 200, exportCount: 10, complexity: 5,
        testCount: 20, testsPassing: 20, coverage: 0.85,
        ...overrides,
    });

    beforeEach(() => {
        analyzer = new CodeQualityAnalyzer();
    });

    describe('registerModule + getModule', () => {
        it('registers and retrieves a module', () => {
            const mod = mkMod('auth');
            analyzer.registerModule(mod);
            expect(analyzer.getModule('auth')).toEqual(mod);
        });

        it('returns null for unknown module', () => {
            expect(analyzer.getModule('unknown')).toBeNull();
        });
    });

    describe('getModuleScore', () => {
        it('returns 0 for unknown module', () => {
            expect(analyzer.getModuleScore('unknown')).toBe(0);
        });

        it('gives high score for well-tested low-complexity module', () => {
            analyzer.registerModule(mkMod('good', {
                testCount: 50, testsPassing: 50, coverage: 0.9, complexity: 5,
            }));
            expect(analyzer.getModuleScore('good')).toBeGreaterThanOrEqual(90);
        });

        it('gives lower score for module with no tests', () => {
            analyzer.registerModule(mkMod('bad', {
                testCount: 0, testsPassing: 0, coverage: undefined, complexity: 25,
            }));
            expect(analyzer.getModuleScore('bad')).toBeLessThan(70);
        });
    });

    describe('generateReport', () => {
        it('generates empty report for no modules', () => {
            const report = analyzer.generateReport();
            expect(report.totalModules).toBe(0);
            expect(report.overallScore).toBe(0);
        });

        it('generates report with correct aggregates', () => {
            analyzer.registerModule(mkMod('a', { linesOfCode: 100, testCount: 10, testsPassing: 10 }));
            analyzer.registerModule(mkMod('b', { linesOfCode: 200, testCount: 20, testsPassing: 18 }));
            const report = analyzer.generateReport();
            expect(report.totalModules).toBe(2);
            expect(report.totalLines).toBe(300);
            expect(report.totalTests).toBe(30);
            expect(report.testPassRate).toBeCloseTo(28 / 30);
        });

        it('detects issues', () => {
            analyzer.registerModule(mkMod('no-tests', { testCount: 0, testsPassing: 0 }));
            analyzer.registerModule(mkMod('failing', { testCount: 10, testsPassing: 5 }));
            analyzer.registerModule(mkMod('complex', { complexity: 25 }));
            analyzer.registerModule(mkMod('large', { linesOfCode: 600 }));
            const report = analyzer.generateReport();
            expect(report.issues.length).toBeGreaterThanOrEqual(4);
            expect(report.issues.some(i => i.issue === 'No tests')).toBe(true);
            expect(report.issues.some(i => i.issue === 'Failing tests')).toBe(true);
            expect(report.issues.some(i => i.issue === 'High complexity')).toBe(true);
            expect(report.issues.some(i => i.issue === 'Large module')).toBe(true);
        });
    });

    describe('listByQuality', () => {
        it('sorts modules by quality score descending', () => {
            analyzer.registerModule(mkMod('bad', { testCount: 0, testsPassing: 0, coverage: undefined }));
            analyzer.registerModule(mkMod('good', { testCount: 50, testsPassing: 50, coverage: 0.95, complexity: 3 }));
            const list = analyzer.listByQuality();
            expect(list[0].name).toBe('good');
            expect(list[1].name).toBe('bad');
            expect(list[0].score).toBeGreaterThan(list[1].score);
        });
    });

    describe('count', () => {
        it('returns module count', () => {
            expect(analyzer.count()).toBe(0);
            analyzer.registerModule(mkMod('a'));
            analyzer.registerModule(mkMod('b'));
            expect(analyzer.count()).toBe(2);
        });
    });
});
