/**
 * src/security/audit.ts
 *
 * Layer 5: Audit Logger — CoreBlow Pattern
 *
 * File-based JSONL audit logging, one file per day.
 * Every action (tool calls, auth attempts, config changes) is logged
 * to `$STATE_DIR/audit/audit-YYYY-MM-DD.jsonl`.
 *
 * Maintains backward compatibility with existing `audit()` and `getAuditLog()` callers.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('security:audit');

// ─── Types (CoreBlow Pattern) ───────────────────────────────────

export interface AuditEntry {
    /** ISO timestamp */
    timestamp: string;
    /** Agent that performed the action */
    agentId: string;
    /** Action type */
    action: 'tool_call' | 'message_sent' | 'config_change' | 'auth_attempt' | 'approval' | 'system' | string;
    /** Tool name if applicable */
    tool?: string;
    /** Action parameters */
    params?: Record<string, unknown>;
    /** Result of the action */
    result?: 'success' | 'denied' | 'error';
    /** Source channel: "whatsapp:+62xxx" | "dashboard" | "ws:device-id" */
    source?: string;
    /** Duration in milliseconds */
    durationMs?: number;
    /** Additional details */
    details?: string;
    /** Actor identity */
    actor?: string;
    /** Target of the action */
    target?: string;
}

export interface AuditQueryFilters {
    date?: string;
    action?: string;
    agentId?: string;
    result?: string;
    limit?: number;
}

// ─── AuditLogger (CoreBlow Pattern) ─────────────────────────────

/**
 * File-based JSONL audit logger following CoreBlow's AuditLogger pattern.
 *
 * ```typescript
 * const logger = new AuditLogger('/path/to/state');
 * await logger.log({ agentId: 'default', action: 'tool_call', tool: 'exec', result: 'success' });
 * const entries = await logger.query({ date: '2026-04-05', action: 'tool_call' });
 * ```
 */
export class AuditLogger {
    private readonly logPath: string;
    private readonly inMemoryBuffer: AuditEntry[] = [];
    private readonly maxBuffer = 1000;

    constructor(stateDir?: string) {
        const dir = stateDir || process.env.COREBLOW_STATE_DIR || process.env.COREBLOW_HOME || '.';
        this.logPath = path.join(dir, 'audit');
    }

    /**
     * Log an audit entry — appends to JSONL file for today.
     */
    async log(entry: Partial<AuditEntry> & { action: string }): Promise<void> {
        const full: AuditEntry = {
            timestamp: new Date().toISOString(),
            agentId: entry.agentId ?? 'system',
            action: entry.action,
            tool: entry.tool,
            params: entry.params,
            result: entry.result,
            source: entry.source,
            durationMs: entry.durationMs,
            details: entry.details,
            actor: entry.actor,
            target: entry.target,
        };

        // In-memory buffer for fast reads
        this.inMemoryBuffer.push(full);
        if (this.inMemoryBuffer.length > this.maxBuffer) {
            this.inMemoryBuffer.splice(0, this.inMemoryBuffer.length - this.maxBuffer);
        }

        // Write to file
        try {
            await fs.promises.mkdir(this.logPath, { recursive: true });

            const date = full.timestamp.split('T')[0]; // YYYY-MM-DD
            const file = path.join(this.logPath, `audit-${date}.jsonl`);
            const line = JSON.stringify(full) + '\n';

            await fs.promises.appendFile(file, line, 'utf-8');
        } catch (err) {
            // Don't crash on audit write failure — log to console only
            log.error({ err: err instanceof Error ? err.message : String(err) }, 'Failed to write audit log');
        }
    }

    /**
     * Query audit logs — read and filter JSONL entries.
     * CoreBlow 1:1 interface.
     */
    async query(filters?: AuditQueryFilters): Promise<AuditEntry[]> {
        const date = filters?.date || new Date().toISOString().split('T')[0];
        const file = path.join(this.logPath, `audit-${date}.jsonl`);

        try {
            const content = await fs.promises.readFile(file, 'utf-8');
            let entries: AuditEntry[] = content
                .trim()
                .split('\n')
                .filter(line => line.length > 0)
                .map(line => JSON.parse(line) as AuditEntry);

            if (filters?.action) {
                entries = entries.filter(e => e.action === filters.action);
            }
            if (filters?.agentId) {
                entries = entries.filter(e => e.agentId === filters.agentId);
            }
            if (filters?.result) {
                entries = entries.filter(e => e.result === filters.result);
            }

            const limit = filters?.limit ?? 1000;
            return entries.slice(-limit);
        } catch {
            // File doesn't exist yet — return in-memory buffer
            return this.inMemoryBuffer.slice(-(filters?.limit ?? 100));
        }
    }

    /**
     * Get recent entries from in-memory buffer (fast path).
     */
    getRecent(limit = 100): AuditEntry[] {
        return this.inMemoryBuffer.slice(-limit);
    }
}

// ─── Singleton + Backward-Compatible API ────────────────────────

let _auditLogger: AuditLogger | null = null;

function getAuditLogger(): AuditLogger {
    if (!_auditLogger) {
        _auditLogger = new AuditLogger();
    }
    return _auditLogger;
}

/**
 * Backward-compatible audit function.
 * Used by existing callers: `audit({ action, actor, target, details })`.
 */
export function audit(entry: { action: string; actor: string; target?: string; details?: Record<string, unknown> }): void {
    const logger = getAuditLogger();
    logger.log({
        action: entry.action,
        actor: entry.actor,
        target: entry.target,
        params: entry.details,
        agentId: entry.actor,
    }).catch(() => { /* swallow — already logged internally */ });
}

/**
 * Backward-compatible getAuditLog function.
 */
export function getAuditLog(limit = 100): AuditEntry[] {
    return getAuditLogger().getRecent(limit);
}

/**
 * Backward-compatible readAuditLog (used by dashboard).
 */
export function readAuditLog(date?: string): AuditEntry[] {
    // For sync compat, return in-memory buffer
    return getAuditLogger().getRecent(200);
}

/**
 * Initialize audit logger with a specific state directory.
 */
export function initAuditLogger(stateDir: string): AuditLogger {
    _auditLogger = new AuditLogger(stateDir);
    return _auditLogger;
}
