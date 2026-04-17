/**
 * CoreBlow — Safety Report
 *
 * Generates comprehensive safety reports combining
 * content filter, toxicity, PII, and bias results
 * into a unified safety assessment.
 */

/** Safety check result */
export interface SafetyCheck {
    name: string;
    passed: boolean;
    score: number;
    details: string;
    severity: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}

/** Safety report */
export interface SafetyReportData {
    id: string;
    text: string;
    timestamp: number;
    overallSafe: boolean;
    overallScore: number;
    checks: SafetyCheck[];
    recommendation: string;
}

/**
 * CoreBlow Safety Report
 */
export class SafetyReport {
    private reports: SafetyReportData[] = [];
    private maxReports = 500;
    private idCounter = 0;

    /**
     * Generate a safety report from check results.
     */
    generate(text: string, checks: SafetyCheck[]): SafetyReportData {
        const overallSafe = checks.every((c) => c.passed);
        const overallScore = checks.length > 0
            ? checks.reduce((s, c) => s + c.score, 0) / checks.length : 1;

        const failedChecks = checks.filter((c) => !c.passed);
        let recommendation = 'Content passes all safety checks';
        if (failedChecks.length > 0) {
            const critical = failedChecks.filter((c) => c.severity === 'critical');
            if (critical.length > 0) recommendation = `CRITICAL: ${critical.map((c) => c.name).join(', ')} failed. Content must be blocked.`;
            else recommendation = `Warning: ${failedChecks.map((c) => c.name).join(', ')} flagged. Review recommended.`;
        }

        const report: SafetyReportData = {
            id: `safety-${++this.idCounter}`, text: text.slice(0, 200),
            timestamp: Date.now(), overallSafe, overallScore, checks, recommendation,
        };

        this.reports.push(report);
        if (this.reports.length > this.maxReports) this.reports = this.reports.slice(-this.maxReports);
        return report;
    }

    /**
     * Get a report.
     */
    get(id: string): SafetyReportData | null {
        return this.reports.find((r) => r.id === id) ?? null;
    }

    /**
     * Get recent reports.
     */
    getRecent(limit?: number): SafetyReportData[] {
        return this.reports.slice(-(limit ?? 20));
    }

    /**
     * Get safety stats.
     */
    getStats(): { total: number; safe: number; unsafe: number; safeRate: number } {
        const safe = this.reports.filter((r) => r.overallSafe).length;
        return { total: this.reports.length, safe, unsafe: this.reports.length - safe, safeRate: this.reports.length > 0 ? safe / this.reports.length : 1 };
    }

    /**
     * Get reports by severity.
     */
    getBySeverity(severity: SafetyCheck['severity']): SafetyReportData[] {
        return this.reports.filter((r) => r.checks.some((c) => c.severity === severity));
    }

    /** Count */
    count(): number { return this.reports.length; }
}
