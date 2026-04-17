/**
 * plugins/audit-log.ts
 *
 * Plugin audit logging — records all security-relevant plugin actions
 * for compliance, debugging, and forensic analysis.
 *
 * Following CoreBlow's audit-channel.ts + audit-extra.ts pattern
 * adapted for CoreBlow's plugin sandbox model.
 */

import { createChildLogger } from '../utils/logger.js';
import type { Permission } from './sandbox.js';

const log = createChildLogger('plugin:audit');

// ─── Types ───────────────────────────────────────────────────────

/** Audit event severity */
export type AuditSeverity = 'info' | 'warn' | 'critical';

/** Audit event category */
export type AuditCategory =
    | 'permission'     // Permission grant/deny
    | 'lifecycle'      // Plugin load/unload/enable/disable
    | 'resource'       // Resource limit events
    | 'filesystem'     // File read/write/delete
    | 'network'        // Network requests
    | 'exec'           // Command execution
    | 'config'         // Config changes
    | 'security'       // Security-relevant events
    | 'hook'           // Hook execution
    | 'registration';  // Tool/command/provider registration

/** A single audit event */
export interface AuditEvent {
    id: string;
    pluginId: string;
    category: AuditCategory;
    severity: AuditSeverity;
    action: string;
    detail?: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
}

/** Audit query options */
export interface AuditQueryOptions {
    pluginId?: string;
    category?: AuditCategory;
    severity?: AuditSeverity;
    since?: number;
    until?: number;
    limit?: number;
    offset?: number;
}

/** Audit statistics */
export interface AuditStats {
    totalEvents: number;
    byCategory: Record<AuditCategory, number>;
    bySeverity: Record<AuditSeverity, number>;
    byPlugin: Record<string, number>;
    oldestEvent?: number;
    newestEvent?: number;
}

/** Security audit finding (CoreBlow-style) */
export interface SecurityAuditFinding {
    checkId: string;
    severity: AuditSeverity;
    title: string;
    detail?: string;
    remediation?: string;
}

// ─── AuditLog ────────────────────────────────────────────────────

/**
 * CoreBlow Plugin Audit Log
 *
 * Records all security-relevant plugin actions with structured events.
 * Supports querying, filtering, statistics, and export for compliance.
 */
export class AuditLog {
    private events: AuditEvent[] = [];
    private maxEvents: number;
    private idCounter = 0;
    private listeners: Array<(event: AuditEvent) => void> = [];

    constructor(options?: { maxEvents?: number }) {
        this.maxEvents = options?.maxEvents ?? 10_000;
    }

    // ─── Recording ───────────────────────────────────────────────

    /**
     * Record an audit event.
     */
    record(params: {
        pluginId: string;
        category: AuditCategory;
        severity: AuditSeverity;
        action: string;
        detail?: string;
        metadata?: Record<string, unknown>;
    }): AuditEvent {
        const event: AuditEvent = {
            id: `audit-${++this.idCounter}`,
            pluginId: params.pluginId,
            category: params.category,
            severity: params.severity,
            action: params.action,
            detail: params.detail,
            metadata: params.metadata,
            timestamp: Date.now(),
        };

        this.events.push(event);
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        // Notify listeners
        for (const listener of this.listeners) {
            try { listener(event); } catch { /* skip */ }
        }

        // Log critical events
        if (params.severity === 'critical') {
            log.warn({ ...event }, `CRITICAL: ${params.action}`);
        }

        return event;
    }

    // ─── Convenience Recorders ───────────────────────────────────

    /** Record a permission check */
    recordPermissionCheck(pluginId: string, permission: Permission, granted: boolean, action: string): AuditEvent {
        return this.record({
            pluginId,
            category: 'permission',
            severity: granted ? 'info' : 'warn',
            action: `permission:${permission}:${granted ? 'granted' : 'denied'}`,
            detail: action,
            metadata: { permission, granted },
        });
    }

    /** Record a plugin lifecycle event */
    recordLifecycle(pluginId: string, action: string, detail?: string): AuditEvent {
        return this.record({
            pluginId,
            category: 'lifecycle',
            severity: 'info',
            action: `lifecycle:${action}`,
            detail,
        });
    }

    /** Record a resource limit violation */
    recordResourceViolation(pluginId: string, resource: string, limit: number, actual: number, action: string): AuditEvent {
        return this.record({
            pluginId,
            category: 'resource',
            severity: 'warn',
            action: `resource:${resource}:exceeded`,
            detail: `${action} — limit: ${limit}, actual: ${actual}`,
            metadata: { resource, limit, actual },
        });
    }

    /** Record a filesystem operation */
    recordFilesystem(pluginId: string, operation: string, targetPath: string, allowed: boolean): AuditEvent {
        return this.record({
            pluginId,
            category: 'filesystem',
            severity: allowed ? 'info' : 'warn',
            action: `fs:${operation}:${allowed ? 'allowed' : 'blocked'}`,
            detail: targetPath,
            metadata: { operation, path: targetPath, allowed },
        });
    }

    /** Record a network request */
    recordNetwork(pluginId: string, method: string, url: string, allowed: boolean): AuditEvent {
        // Sanitize URL to remove passwords/tokens
        const sanitized = this.sanitizeUrl(url);
        return this.record({
            pluginId,
            category: 'network',
            severity: allowed ? 'info' : 'warn',
            action: `network:${method}:${allowed ? 'allowed' : 'blocked'}`,
            detail: sanitized,
            metadata: { method, url: sanitized, allowed },
        });
    }

    /** Record a command execution */
    recordExec(pluginId: string, command: string, allowed: boolean): AuditEvent {
        // Never log full command args (could contain secrets)
        const safeCmd = command.split(' ')[0] ?? command;
        return this.record({
            pluginId,
            category: 'exec',
            severity: allowed ? 'info' : 'critical',
            action: `exec:${allowed ? 'allowed' : 'blocked'}`,
            detail: safeCmd,
            metadata: { command: safeCmd, allowed },
        });
    }

    /** Record a security finding */
    recordFinding(finding: SecurityAuditFinding): AuditEvent {
        return this.record({
            pluginId: finding.checkId.split('.')[0] ?? 'system',
            category: 'security',
            severity: finding.severity,
            action: `finding:${finding.checkId}`,
            detail: `${finding.title}${finding.detail ? ' — ' + finding.detail : ''}`,
            metadata: { checkId: finding.checkId, remediation: finding.remediation },
        });
    }

    // ─── Querying ────────────────────────────────────────────────

    /**
     * Query audit events with filters.
     */
    query(options: AuditQueryOptions = {}): AuditEvent[] {
        let filtered = this.events;

        if (options.pluginId) {
            filtered = filtered.filter((e) => e.pluginId === options.pluginId);
        }
        if (options.category) {
            filtered = filtered.filter((e) => e.category === options.category);
        }
        if (options.severity) {
            filtered = filtered.filter((e) => e.severity === options.severity);
        }
        if (options.since) {
            filtered = filtered.filter((e) => e.timestamp >= options.since!);
        }
        if (options.until) {
            filtered = filtered.filter((e) => e.timestamp <= options.until!);
        }

        const offset = options.offset ?? 0;
        const limit = options.limit ?? 100;
        return filtered.slice(offset, offset + limit);
    }

    /**
     * Get the most recent N events.
     */
    recent(count = 50): AuditEvent[] {
        return this.events.slice(-count);
    }

    /**
     * Get events for a specific plugin.
     */
    forPlugin(pluginId: string, limit = 100): AuditEvent[] {
        return this.events.filter((e) => e.pluginId === pluginId).slice(-limit);
    }

    /**
     * Get all critical events.
     */
    getCritical(): AuditEvent[] {
        return this.events.filter((e) => e.severity === 'critical');
    }

    /**
     * Get all warnings.
     */
    getWarnings(): AuditEvent[] {
        return this.events.filter((e) => e.severity === 'warn');
    }

    // ─── Statistics ──────────────────────────────────────────────

    /**
     * Get audit statistics.
     */
    getStats(): AuditStats {
        const byCategory: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        const byPlugin: Record<string, number> = {};

        for (const event of this.events) {
            byCategory[event.category] = (byCategory[event.category] ?? 0) + 1;
            bySeverity[event.severity] = (bySeverity[event.severity] ?? 0) + 1;
            byPlugin[event.pluginId] = (byPlugin[event.pluginId] ?? 0) + 1;
        }

        return {
            totalEvents: this.events.length,
            byCategory: byCategory as AuditStats['byCategory'],
            bySeverity: bySeverity as AuditStats['bySeverity'],
            byPlugin,
            oldestEvent: this.events[0]?.timestamp,
            newestEvent: this.events[this.events.length - 1]?.timestamp,
        };
    }

    // ─── Listeners ───────────────────────────────────────────────

    /**
     * Subscribe to new audit events.
     */
    onEvent(listener: (event: AuditEvent) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    // ─── Export ───────────────────────────────────────────────────

    /**
     * Export events as JSON lines (one event per line).
     */
    exportJsonLines(options?: AuditQueryOptions): string {
        const events = options ? this.query(options) : this.events;
        return events.map((e) => JSON.stringify(e)).join('\n');
    }

    /**
     * Export events as formatted text for CLI.
     */
    exportText(options?: AuditQueryOptions): string {
        const events = options ? this.query(options) : this.recent(50);
        return events.map((e) => {
            const ts = new Date(e.timestamp).toISOString();
            const icon = e.severity === 'critical' ? '🔴' : e.severity === 'warn' ? '🟡' : '🟢';
            return `${icon} [${ts}] [${e.pluginId}] ${e.action}${e.detail ? ' — ' + e.detail : ''}`;
        }).join('\n');
    }

    // ─── Management ──────────────────────────────────────────────

    /**
     * Total event count.
     */
    count(): number {
        return this.events.length;
    }

    /**
     * Clear all events.
     */
    clear(): void {
        this.events = [];
    }

    // ─── Private ─────────────────────────────────────────────────

    private sanitizeUrl(url: string): string {
        try {
            const parsed = new URL(url);
            if (parsed.password) parsed.password = '***';
            // Remove common token params
            for (const param of ['token', 'key', 'apikey', 'api_key', 'secret', 'password']) {
                if (parsed.searchParams.has(param)) {
                    parsed.searchParams.set(param, '***');
                }
            }
            return parsed.toString();
        } catch {
            return url;
        }
    }
}
