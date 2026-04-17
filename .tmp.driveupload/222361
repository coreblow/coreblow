/**
 * CoreBlow — Coverage Reporter
 *
 * Tracks and reports code coverage metrics.
 * Supports file-level, function-level, and overall
 * coverage with thresholds and trend analysis.
 */

/** File coverage */
export interface FileCoverage {
    file: string;
    lines: { total: number; covered: number };
    functions: { total: number; covered: number };
    branches: { total: number; covered: number };
}

/** Coverage summary */
export interface CoverageSummary {
    totalFiles: number;
    lineCoverage: number;
    functionCoverage: number;
    branchCoverage: number;
    overallCoverage: number;
    belowThreshold: string[];
}

/**
 * CoreBlow Coverage Reporter
 */
export class CoverageReporter {
    private files = new Map<string, FileCoverage>();
    private threshold = 80;
    private history: Array<{ timestamp: number; coverage: number }> = [];

    /**
     * Add file coverage.
     */
    addFile(coverage: FileCoverage): void {
        this.files.set(coverage.file, coverage);
    }

    /**
     * Get file coverage.
     */
    getFile(file: string): FileCoverage | null { return this.files.get(file) ?? null; }

    /**
     * Generate summary.
     */
    getSummary(): CoverageSummary {
        const all = Array.from(this.files.values());
        if (all.length === 0) return { totalFiles: 0, lineCoverage: 0, functionCoverage: 0, branchCoverage: 0, overallCoverage: 0, belowThreshold: [] };

        const totals = all.reduce((acc, f) => ({
            lines: acc.lines + f.lines.total, linesCov: acc.linesCov + f.lines.covered,
            fns: acc.fns + f.functions.total, fnsCov: acc.fnsCov + f.functions.covered,
            branches: acc.branches + f.branches.total, branchesCov: acc.branchesCov + f.branches.covered,
        }), { lines: 0, linesCov: 0, fns: 0, fnsCov: 0, branches: 0, branchesCov: 0 });

        const lineCoverage = totals.lines > 0 ? (totals.linesCov / totals.lines) * 100 : 0;
        const functionCoverage = totals.fns > 0 ? (totals.fnsCov / totals.fns) * 100 : 0;
        const branchCoverage = totals.branches > 0 ? (totals.branchesCov / totals.branches) * 100 : 0;
        const overallCoverage = (lineCoverage + functionCoverage + branchCoverage) / 3;

        const belowThreshold = all
            .filter((f) => f.lines.total > 0 && (f.lines.covered / f.lines.total) * 100 < this.threshold)
            .map((f) => f.file);

        // Track history
        this.history.push({ timestamp: Date.now(), coverage: overallCoverage });

        return { totalFiles: all.length, lineCoverage, functionCoverage, branchCoverage, overallCoverage, belowThreshold };
    }

    /**
     * Set threshold.
     */
    setThreshold(threshold: number): void { this.threshold = threshold; }

    /**
     * Get trend.
     */
    getTrend(limit?: number): Array<{ timestamp: number; coverage: number }> {
        return this.history.slice(-(limit ?? 10));
    }

    /**
     * Generate markdown report.
     */
    generateReport(): string {
        const summary = this.getSummary();
        const lines = [
            '# Coverage Report',
            '',
            `| Metric | Coverage |`,
            `|--------|----------|`,
            `| Lines | ${summary.lineCoverage.toFixed(1)}% |`,
            `| Functions | ${summary.functionCoverage.toFixed(1)}% |`,
            `| Branches | ${summary.branchCoverage.toFixed(1)}% |`,
            `| **Overall** | **${summary.overallCoverage.toFixed(1)}%** |`,
        ];
        if (summary.belowThreshold.length > 0) {
            lines.push('', `## Below ${this.threshold}% Threshold`, '');
            for (const f of summary.belowThreshold) lines.push(`- ${f}`);
        }
        return lines.join('\n');
    }

    /** Count files */
    count(): number { return this.files.size; }
}
