/**
 * src/security/audit.ts
 * JSONL audit logger — records all tool executions and auth events
 */

import fs from 'node:fs';
import path from 'node:path';
import { getHomeDir } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('audit');

export type AuditEvent = 'tool_exec' | 'auth_success' | 'auth_fail' | 'channel_connect' | 'channel_disconnect' | 'config_change';

export interface AuditEntry {
    timestamp: string;
    event: AuditEvent;
    agent?: string;
    session?: string;
    channel?: string;
    tool?: string;
    args?: Record<string, any>;
    result?: string;
    ip?: string;
    metadata?: Record<string, any>;
}

let auditStream: fs.WriteStream | null = null;

function getAuditStream(): fs.WriteStream {
    if (auditStream) return auditStream;

    const auditDir = path.join(getHomeDir(), 'audit');
    fs.mkdirSync(auditDir, { recursive: true });

    // Rotate by date
    const date = new Date().toISOString().slice(0, 10);
    const filePath = path.join(auditDir, `${date}.jsonl`);

    auditStream = fs.createWriteStream(filePath, { flags: 'a' });
    log.debug({ path: filePath }, 'Audit log opened');

    return auditStream;
}

/**
 * Write an audit entry
 */
export function audit(entry: Omit<AuditEntry, 'timestamp'>) {
    const full: AuditEntry = {
        timestamp: new Date().toISOString(),
        ...entry,
    };

    const stream = getAuditStream();
    stream.write(JSON.stringify(full) + '\n');
}

/**
 * Read audit entries for a given date
 */
export function readAuditLog(date?: string): AuditEntry[] {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const filePath = path.join(getHomeDir(), 'audit', `${targetDate}.jsonl`);

    if (!fs.existsSync(filePath)) return [];

    try {
        return fs
            .readFileSync(filePath, 'utf-8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line));
    } catch {
        return [];
    }
}

/**
 * Close the audit stream
 */
export function closeAudit() {
    if (auditStream) {
        auditStream.end();
        auditStream = null;
    }
}
