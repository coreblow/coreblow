import { describe, it, expect, beforeEach } from 'vitest';
import { CodeQualityAnalyzer, type ModuleMetrics } from './code-quality.js';

let analyzer: CodeQualityAnalyzer;

function makeModule(name: string, overrides?: Partial<ModuleMetrics>): ModuleMetrics {
    return {
        name,
        linesOfCode: 100,
        exportCount: 5,
        complexity: 8,
        testCount: 10,
        testsPassing: 10,
        coverage: 0.85,
        ...overrides,
    };
}

beforeEach(() => {
    analyzer = new CodeQualityAnalyzer();
});

describe('CodeQualityAnalyzer — construction', () => {
    it('starts empty', () => {
        expect(analyzer.count()).toBe(0);
    });
});

describe('CodeQualityAnalyzer — registerModule / getModule', () => {
    it('registers and retrieves a module', () => {
        analyzer.registerModule(makeModule('auth'));
        expect(analyzer.getModule('auth')).not.toBeNull();
        expect(analyzer.getModule('auth')!.name).toBe('auth');
        expect(analyzer.count()).toBe(1);
    });

    it('returns null for unknown module', () => {
        expect(analyzer.getModule('unknown')).toBeNull();
    });
});

describe('CodeQualityAnalyzer — getModuleScore', () => {
    it('returns 0 for unknown module', () => {
        expect(analyzer.getModuleScore('nope')).toBe(0);
    });

    it('gives high score for well-tested, low-complexity module', () => {
        analyzer.registerModule(makeModule('good', { complexity: 5, coverage: 0.9 }));
        const score = analyzer.getModuleScore('good');
        expect(score).toBeGreaterThanOrEqual(90);
    });

    it('gives lower score for module without tests', () => {
        analyzer.registerModule(makeModule('no-tests', { testCount: 0, testsPassing: 0, coverage: undefined }));
        const score = analyzer.getModuleScore('no-tests');
        // base(50) + tests(0) + allPass(15, 0===0) + coverage(0) + lowComplexity(5) = 70
        expect(score).toBeLessThanOrEqual(70);
    });

    it('caps at 100', () => {
        analyzer.registerModule(makeModule('perfect'));
        expect(analyzer.getModuleScore('perfect')).toBeLessThanOrEqual(100);
    });
});

describe('CodeQualityAnalyzer — generateReport', () => {
    it('returns zero report when empty', () => {
        const r = analyzer.generateReport();
        expect(r.totalModules).toBe(0);
        expect(r.overallScore).toBe(0);
    });

    it('computes aggregate metrics', () => {
        analyzer.registerModule(makeModule('a', { linesOfCode: 200, testCount: 5, testsPassing: 5 }));
        analyzer.registerModule(makeModule('b', { linesOfCode: 300, testCount: 10, testsPassing: 8 }));
        const r = analyzer.generateReport();
        expect(r.totalModules).toBe(2);
        expect(r.totalLines).toBe(500);
        expect(r.totalTests).toBe(15);
        expect(r.testPassRate).toBeCloseTo(13 / 15, 2);
    });

    it('detects issues: no tests', () => {
        analyzer.registerModule(makeModule('untested', { testCount: 0, testsPassing: 0 }));
        const r = analyzer.generateReport();
        expect(r.issues.some(i => i.issue === 'No tests')).toBe(true);
    });

    it('detects issues: failing tests', () => {
        analyzer.registerModule(makeModule('failing', { testCount: 5, testsPassing: 3 }));
        const r = analyzer.generateReport();
        expect(r.issues.some(i => i.issue === 'Failing tests')).toBe(true);
    });

    it('detects issues: high complexity', () => {
        analyzer.registerModule(makeModule('complex', { complexity: 25 }));
        const r = analyzer.generateReport();
        expect(r.issues.some(i => i.issue === 'High complexity')).toBe(true);
    });

    it('detects issues: large module', () => {
        analyzer.registerModule(makeModule('big', { linesOfCode: 600 }));
        const r = analyzer.generateReport();
        expect(r.issues.some(i => i.issue === 'Large module')).toBe(true);
    });
});

describe('CodeQualityAnalyzer — listByQuality', () => {
    it('sorts modules by descending score', () => {
        analyzer.registerModule(makeModule('low', { testCount: 0, testsPassing: 0, complexity: 25 }));
        analyzer.registerModule(makeModule('high', { complexity: 3, coverage: 0.95 }));
        const list = analyzer.listByQuality();
        expect(list[0].name).toBe('high');
        expect(list[1].name).toBe('low');
        expect(list[0].score).toBeGreaterThan(list[1].score);
    });
});
