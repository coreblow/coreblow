/**
 * CoreBlow — Error Reporter
 *
 * Centralized error reporting with deduplication,
 * stack trace analysis, error grouping, and alerting.
 */

/** Error report */
export interface ErrorReport {
    id: string;
    name: string;
    message: string;
    stack?: string;
    source: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    count: number;
    firstSeen: number;
    lastSeen: number;
    metadata?: Record<string, unknown>;
    resolved: boolean;
}

/** Error alert */
export interface ErrorAlert {
    reportId: string;
    severity: string;
    message: string;
    timestamp: number;
}

/**
 * CoreBlow Error Reporter
 */
export class ErrorReporter {
    private reports = new Map<string, ErrorReport>();
    private alerts: ErrorAlert[] = [];
    private maxAlerts = 200;
    private idCounter = 0;

    /**
     * Report an error.
     */
    report(error: Error | string, source: string, severity?: ErrorReport['severity'], metadata?: Record<string, unknown>): ErrorReport {
        const err = typeof error === 'string' ? new Error(error) : error;
        const key = `${err.name}:${err.message}:${source}`;

        // Dedup check
        const existing = this.reports.get(key);
        if (existing) {
            existing.count++;
            existing.lastSeen = Date.now();
            return existing;
        }

        const report: ErrorReport = {
            id: `err-${++this.idCounter}`,
            name: err.name,
            message: err.message,
            stack: err.stack,
            source,
            severity: severity ?? 'medium',
            count: 1,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            metadata,
            resolved: false,
        };

        this.reports.set(key, report);

        // Alert for high/critical
        if (severity === 'high' || severity === 'critical') {
            this.addAlert(report);
        }

        return report;
    }

    /**
     * Resolve an error.
     */
    resolve(reportId: string): boolean {
        for (const report of Array.from(this.reports.values())) {
            if (report.id === reportId) { report.resolved = true; return true; }
        }
        return false;
    }

    /**
     * Get unresolved errors.
     */
    getUnresolved(severity?: ErrorReport['severity']): ErrorReport[] {
        return Array.from(this.reports.values())
            .filter((r) => !r.resolved && (!severity || r.severity === severity))
            .sort((a, b) => b.lastSeen - a.lastSeen);
    }

    /**
     * Get top errors by count.
     */
    getTopErrors(limit?: number): ErrorReport[] {
        return Array.from(this.reports.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, limit ?? 10);
    }

    /**
     * Get alerts.
     */
    getAlerts(limit?: number): ErrorAlert[] {
        return this.alerts.slice(-(limit ?? 50));
    }

    /**
     * Get stats.
     */
    getStats(): { total: number; unresolved: number; critical: number; totalOccurrences: number } {
        const reports = Array.from(this.reports.values());
        return {
            total: reports.length,
            unresolved: reports.filter((r) => !r.resolved).length,
            critical: reports.filter((r) => r.severity === 'critical' && !r.resolved).length,
            totalOccurrences: reports.reduce((s, r) => s + r.count, 0),
        };
    }

    /**
     * Clear resolved errors.
     */
    clearResolved(): number {
        let count = 0;
        for (const [key, report] of Array.from(this.reports)) {
            if (report.resolved) { this.reports.delete(key); count++; }
        }
        return count;
    }

    /** Count */
    count(): number { return this.reports.size; }

    // === Private ===

    private addAlert(report: ErrorReport): void {
        this.alerts.push({ reportId: report.id, severity: report.severity, message: report.message, timestamp: Date.now() });
        if (this.alerts.length > this.maxAlerts) this.alerts = this.alerts.slice(-this.maxAlerts);
    }
}
