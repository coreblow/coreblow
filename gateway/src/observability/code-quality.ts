/**
 * CoreBlow — Code Quality Analyzer
 *
 * Analyzes code quality metrics including complexity,
 * module health, test coverage tracking, and quality
 * score computation.
 */

/** Module metrics */
export interface ModuleMetrics {
    name: string;
    linesOfCode: number;
    exportCount: number;
    complexity: number;
    testCount: number;
    testsPassing: number;
    coverage?: number;
    lastModified?: number;
}

/** Quality report */
export interface QualityReport {
    overallScore: number;
    totalModules: number;
    totalLines: number;
    totalTests: number;
    testPassRate: number;
    averageCoverage: number;
    modules: ModuleMetrics[];
    issues: Array<{ module: string; issue: string; severity: 'info' | 'warning' | 'error' }>;
    generatedAt: number;
}

/**
 * CoreBlow Code Quality Analyzer
 */
export class CodeQualityAnalyzer {
    private modules = new Map<string, ModuleMetrics>();

    /**
     * Register a module with metrics.
     */
    registerModule(metrics: ModuleMetrics): void {
        this.modules.set(metrics.name, metrics);
    }

    /**
     * Generate a quality report.
     */
    generateReport(): QualityReport {
        const mods = Array.from(this.modules.values());
        const totalTests = mods.reduce((s, m) => s + m.testCount, 0);
        const passingTests = mods.reduce((s, m) => s + m.testsPassing, 0);
        const totalLines = mods.reduce((s, m) => s + m.linesOfCode, 0);
        const coverages = mods.filter((m) => m.coverage !== undefined).map((m) => m.coverage!);
        const avgCoverage = coverages.length > 0 ? coverages.reduce((s, c) => s + c, 0) / coverages.length : 0;

        const issues = this.detectIssues(mods);
        const score = this.computeScore(mods, passingTests, totalTests, avgCoverage);

        return {
            overallScore: score,
            totalModules: mods.length,
            totalLines,
            totalTests,
            testPassRate: totalTests > 0 ? passingTests / totalTests : 0,
            averageCoverage: avgCoverage,
            modules: mods,
            issues,
            generatedAt: Date.now(),
        };
    }

    /**
     * Get module metrics.
     */
    getModule(name: string): ModuleMetrics | null {
        return this.modules.get(name) ?? null;
    }

    /**
     * Get quality score for a module.
     */
    getModuleScore(name: string): number {
        const mod = this.modules.get(name);
        if (!mod) return 0;

        let score = 50; // Base
        if (mod.testCount > 0) score += 20;
        if (mod.testsPassing === mod.testCount) score += 15;
        if (mod.coverage !== undefined && mod.coverage > 0.8) score += 10;
        if (mod.complexity < 10) score += 5;
        return Math.min(100, score);
    }

    /**
     * List modules sorted by quality.
     */
    listByQuality(): Array<{ name: string; score: number }> {
        return Array.from(this.modules.keys())
            .map((name) => ({ name, score: this.getModuleScore(name) }))
            .sort((a, b) => b.score - a.score);
    }

    /** Count */
    count(): number { return this.modules.size; }

    // === Private ===

    private detectIssues(mods: ModuleMetrics[]): QualityReport['issues'] {
        const issues: QualityReport['issues'] = [];
        for (const mod of mods) {
            if (mod.testCount === 0) issues.push({ module: mod.name, issue: 'No tests', severity: 'warning' });
            if (mod.testsPassing < mod.testCount) issues.push({ module: mod.name, issue: 'Failing tests', severity: 'error' });
            if (mod.complexity > 20) issues.push({ module: mod.name, issue: 'High complexity', severity: 'warning' });
            if (mod.linesOfCode > 500) issues.push({ module: mod.name, issue: 'Large module', severity: 'info' });
        }
        return issues;
    }

    private computeScore(mods: ModuleMetrics[], passing: number, total: number, coverage: number): number {
        if (mods.length === 0) return 0;
        let score = 0;
        score += (total > 0 ? passing / total : 0) * 40; // Test pass rate
        score += Math.min(coverage, 1) * 30; // Coverage
        score += Math.min(mods.length / 50, 1) * 15; // Module count
        const avgComplexity = mods.reduce((s, m) => s + m.complexity, 0) / mods.length;
        score += Math.max(0, (20 - avgComplexity) / 20) * 15; // Low complexity bonus
        return Math.round(score * 100) / 100;
    }
}
