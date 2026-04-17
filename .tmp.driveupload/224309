/**
 * CoreBlow Security — Audit Logger
 *
 * Security-focused event logging for compliance and forensics.
 * Tracks authentication events, access violations, config changes,
 * and sensitive operations with structured, tamper-evident records.
 */

/** Audit event severity */
export type AuditSeverity = 'info' | 'warning' | 'critical';

/** Audit event categories */
export type AuditCategory =
    | 'auth'
    | 'access'
    | 'config'
    | 'data'
    | 'channel'
    | 'plugin'
    | 'command'
    | 'system';

/** Audit event record */
export interface AuditEvent {
    id: string;
    timestamp: string;
    category: AuditCategory;
    severity: AuditSeverity;
    action: string;
    actor?: string;
    target?: string;
    ip?: string;
    channelId?: string;
    details?: Record<string, unknown>;
    success: boolean;
    /** Hash of previous event for tamper-evidence */
    prevHash?: string;
}

/** Audit log query options */
export interface AuditQuery {
    category?: AuditCategory;
    severity?: AuditSeverity;
    actor?: string;
    since?: number;
    until?: number;
    limit?: number;
    success?: boolean;
}

/**
 * CoreBlow Audit Logger
 */
export class AuditLogger {
    private events: AuditEvent[] = [];
    private maxEvents = 10_000;
    private counter = 0;
    private lastHash = '0';
    private sink: ((event: AuditEvent) => void) | null = null;

    /**
     * Set an external sink (e.g., file or database writer).
     */
    setSink(sink: (event: AuditEvent) => void): void {
        this.sink = sink;
    }

    /**
     * Log an audit event.
     */
    log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'prevHash'>): AuditEvent {
        const record: AuditEvent = {
            ...event,
            id: `audit-${++this.counter}`,
            timestamp: new Date().toISOString(),
            prevHash: this.lastHash,
        };

        this.lastHash = this.hash(record);
        this.events.push(record);

        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        if (this.sink) {
            try { this.sink(record); } catch { /* skip */ }
        }

        return record;
    }

    // === Convenience methods ===

    authSuccess(actor: string, details?: Record<string, unknown>): AuditEvent {
        return this.log({ category: 'auth', severity: 'info', action: 'login', actor, success: true, details });
    }

    authFailure(actor: string, ip?: string): AuditEvent {
        return this.log({ category: 'auth', severity: 'warning', action: 'login-failed', actor, ip, success: false });
    }

    accessDenied(actor: string, target: string, details?: Record<string, unknown>): AuditEvent {
        return this.log({ category: 'access', severity: 'warning', action: 'access-denied', actor, target, success: false, details });
    }

    configChange(actor: string, target: string, details?: Record<string, unknown>): AuditEvent {
        return this.log({ category: 'config', severity: 'info', action: 'config-change', actor, target, success: true, details });
    }

    commandExecuted(actor: string, command: string, success: boolean): AuditEvent {
        return this.log({ category: 'command', severity: 'info', action: command, actor, success });
    }

    pluginInstalled(pluginId: string, actor?: string): AuditEvent {
        return this.log({ category: 'plugin', severity: 'info', action: 'plugin-install', actor, target: pluginId, success: true });
    }

    criticalEvent(action: string, details?: Record<string, unknown>): AuditEvent {
        return this.log({ category: 'system', severity: 'critical', action, success: true, details });
    }

    /**
     * Query audit events.
     */
    query(opts?: AuditQuery): AuditEvent[] {
        let results = [...this.events];

        if (opts?.category) results = results.filter((e) => e.category === opts.category);
        if (opts?.severity) results = results.filter((e) => e.severity === opts.severity);
        if (opts?.actor) results = results.filter((e) => e.actor === opts.actor);
        if (opts?.success !== undefined) results = results.filter((e) => e.success === opts.success);
        if (opts?.since) results = results.filter((e) => new Date(e.timestamp).getTime() >= opts.since!);
        if (opts?.until) results = results.filter((e) => new Date(e.timestamp).getTime() <= opts.until!);

        return results.slice(-(opts?.limit ?? 100));
    }

    /**
     * Get event count by category.
     */
    getCounts(): Record<AuditCategory, number> {
        const counts: Record<string, number> = {};
        for (const event of this.events) {
            counts[event.category] = (counts[event.category] ?? 0) + 1;
        }
        return counts as Record<AuditCategory, number>;
    }

    /**
     * Verify audit trail integrity (check hash chain).
     */
    verifyIntegrity(): { valid: boolean; brokenAt?: number } {
        let prevHash = '0';
        for (let i = 0; i < this.events.length; i++) {
            if (this.events[i]!.prevHash !== prevHash) {
                return { valid: false, brokenAt: i };
            }
            prevHash = this.hash(this.events[i]!);
        }
        return { valid: true };
    }

    // === Private ===

    private hash(event: AuditEvent): string {
        const data = `${event.id}|${event.timestamp}|${event.category}|${event.action}|${event.actor ?? ''}|${event.success}`;
        // Simple hash for tamper evidence (not cryptographic)
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return hash.toString(16);
    }
}
