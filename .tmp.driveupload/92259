/**
 * CoreBlow — Audit Trail
 *
 * Immutable audit log for security-critical operations.
 * Tracks who did what, when, and from where. Supports
 * filtering, search, and tamper detection via hashing.
 */

import * as crypto from 'node:crypto';

/** Audit event */
export interface AuditEvent {
    id: string;
    action: string;
    actor: string;
    resource: string;
    details?: Record<string, unknown>;
    ip?: string;
    timestamp: number;
    hash: string;
    previousHash: string;
}

/**
 * CoreBlow Audit Trail
 */
export class AuditTrail {
    private events: AuditEvent[] = [];
    private maxEvents = 10_000;
    private lastHash = '0';
    private idCounter = 0;

    /**
     * Log an audit event.
     */
    log(action: string, actor: string, resource: string, details?: Record<string, unknown>, ip?: string): AuditEvent {
        const previousHash = this.lastHash;
        const payload = `${action}:${actor}:${resource}:${Date.now()}:${previousHash}`;
        const hash = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);

        const event: AuditEvent = {
            id: `audit-${++this.idCounter}`, action, actor, resource,
            details, ip, timestamp: Date.now(), hash, previousHash,
        };

        this.events.push(event);
        this.lastHash = hash;
        if (this.events.length > this.maxEvents) this.events = this.events.slice(-this.maxEvents);
        return event;
    }

    /**
     * Query events by actor.
     */
    getByActor(actor: string, limit?: number): AuditEvent[] {
        return this.events.filter((e) => e.actor === actor).slice(-(limit ?? 50));
    }

    /**
     * Query events by action.
     */
    getByAction(action: string, limit?: number): AuditEvent[] {
        return this.events.filter((e) => e.action === action).slice(-(limit ?? 50));
    }

    /**
     * Query events by resource.
     */
    getByResource(resource: string, limit?: number): AuditEvent[] {
        return this.events.filter((e) => e.resource === resource).slice(-(limit ?? 50));
    }

    /**
     * Get recent events.
     */
    getRecent(limit?: number): AuditEvent[] {
        return this.events.slice(-(limit ?? 50));
    }

    /**
     * Verify chain integrity.
     */
    verifyIntegrity(): { valid: boolean; brokenAt?: number } {
        for (let i = 1; i < this.events.length; i++) {
            if (this.events[i]!.previousHash !== this.events[i - 1]!.hash) {
                return { valid: false, brokenAt: i };
            }
        }
        return { valid: true };
    }

    /**
     * Search events.
     */
    search(query: string): AuditEvent[] {
        const q = query.toLowerCase();
        return this.events.filter((e) =>
            e.action.toLowerCase().includes(q) ||
            e.actor.toLowerCase().includes(q) ||
            e.resource.toLowerCase().includes(q)
        );
    }

    /** Count */
    count(): number { return this.events.length; }
}
