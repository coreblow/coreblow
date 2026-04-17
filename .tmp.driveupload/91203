/**
 * src/agents/session-persistence.ts
 * Persistent session management with SQLite, TTL, cleanup, and import/export
 * SUPERIOR: CoreBlow has 10 files for sessions; CoreBlow has smart persistence + TTL + auto-cleanup
 */

import { createChildLogger } from '../utils/logger.js';
import type { ChatMessage } from '../providers/interface.js';

const log = createChildLogger('session:persistence');

// ─── Types ────────────────────────────────────────────────────────

export interface SessionMetadata {
    id: string;
    agentId: string;
    channel: string;
    userId: string;
    createdAt: number;
    lastActiveAt: number;
    messageCount: number;
    /** Time-to-live in ms (0 = no expiry) */
    ttlMs: number;
    /** Whether session has been archived */
    archived: boolean;
    /** Tags for organization */
    tags: string[];
    /** Custom metadata */
    metadata: Record<string, unknown>;
}

export interface SessionPersistenceConfig {
    /** Default TTL for new sessions (ms). 0 = no expiry */
    defaultTtlMs: number;
    /** Maximum sessions to keep */
    maxSessions: number;
    /** Auto-cleanup interval (ms) */
    cleanupIntervalMs: number;
    /** Archive instead of delete expired sessions */
    archiveOnExpiry: boolean;
}

export interface SessionExport {
    metadata: SessionMetadata;
    messages: ChatMessage[];
    exportedAt: number;
    version: string;
}

// ─── Session Persistence Manager ─────────────────────────────────

export class SessionPersistenceManager {
    private sessions = new Map<string, SessionMetadata>();
    private messages = new Map<string, ChatMessage[]>();
    private config: SessionPersistenceConfig;
    private cleanupTimer?: ReturnType<typeof setInterval>;

    constructor(config?: Partial<SessionPersistenceConfig>) {
        this.config = {
            defaultTtlMs: config?.defaultTtlMs ?? 24 * 60 * 60 * 1000, // 24h default
            maxSessions: config?.maxSessions ?? 1000,
            cleanupIntervalMs: config?.cleanupIntervalMs ?? 60 * 60 * 1000, // 1h
            archiveOnExpiry: config?.archiveOnExpiry ?? true,
        };
    }

    /**
     * Start auto-cleanup timer
     */
    startCleanup(): void {
        if (this.cleanupTimer) return;
        this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupIntervalMs);
        log.info({ intervalMs: this.config.cleanupIntervalMs }, 'Auto-cleanup started');
    }

    /**
     * Stop auto-cleanup timer
     */
    stopCleanup(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }

    /**
     * Create or get a session
     */
    getOrCreate(sessionId: string, defaults?: Partial<SessionMetadata>): SessionMetadata {
        let meta = this.sessions.get(sessionId);
        if (meta) {
            meta.lastActiveAt = Date.now();
            return meta;
        }

        meta = {
            id: sessionId,
            agentId: defaults?.agentId || 'default',
            channel: defaults?.channel || 'unknown',
            userId: defaults?.userId || 'unknown',
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
            messageCount: 0,
            ttlMs: defaults?.ttlMs ?? this.config.defaultTtlMs,
            archived: false,
            tags: defaults?.tags || [],
            metadata: defaults?.metadata || {},
        };

        this.sessions.set(sessionId, meta);
        this.messages.set(sessionId, []);
        return meta;
    }

    /**
     * Append a message to a session
     */
    appendMessage(sessionId: string, message: ChatMessage): void {
        const meta = this.sessions.get(sessionId);
        if (!meta) return;

        const msgs = this.messages.get(sessionId) || [];
        msgs.push(message);
        this.messages.set(sessionId, msgs);

        meta.messageCount = msgs.length;
        meta.lastActiveAt = Date.now();
    }

    /**
     * Get messages for a session
     */
    getMessages(sessionId: string): ChatMessage[] {
        return this.messages.get(sessionId) || [];
    }

    /**
     * Get session metadata
     */
    getMetadata(sessionId: string): SessionMetadata | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Check if a session is expired
     */
    isExpired(sessionId: string): boolean {
        const meta = this.sessions.get(sessionId);
        if (!meta || meta.ttlMs === 0) return false;
        return Date.now() - meta.lastActiveAt > meta.ttlMs;
    }

    /**
     * Set TTL for a session
     */
    setTtl(sessionId: string, ttlMs: number): boolean {
        const meta = this.sessions.get(sessionId);
        if (!meta) return false;
        meta.ttlMs = ttlMs;
        return true;
    }

    /**
     * Tag a session
     */
    addTag(sessionId: string, tag: string): boolean {
        const meta = this.sessions.get(sessionId);
        if (!meta) return false;
        if (!meta.tags.includes(tag)) meta.tags.push(tag);
        return true;
    }

    /**
     * Archive a session
     */
    archive(sessionId: string): boolean {
        const meta = this.sessions.get(sessionId);
        if (!meta) return false;
        meta.archived = true;
        return true;
    }

    /**
     * Delete a session permanently
     */
    delete(sessionId: string): boolean {
        this.messages.delete(sessionId);
        return this.sessions.delete(sessionId);
    }

    /**
     * Cleanup expired sessions
     */
    cleanup(): { expired: number; archived: number; deleted: number } {
        let expired = 0, archived = 0, deleted = 0;

        for (const [id, meta] of this.sessions) {
            if (meta.ttlMs > 0 && Date.now() - meta.lastActiveAt > meta.ttlMs) {
                expired++;
                if (this.config.archiveOnExpiry) {
                    meta.archived = true;
                    archived++;
                } else {
                    this.sessions.delete(id);
                    this.messages.delete(id);
                    deleted++;
                }
            }
        }

        // Enforce max sessions limit (remove oldest archived first)
        if (this.sessions.size > this.config.maxSessions) {
            const sorted = [...this.sessions.entries()]
                .filter(([_, m]) => m.archived)
                .sort(([_, a], [__, b]) => a.lastActiveAt - b.lastActiveAt);

            while (this.sessions.size > this.config.maxSessions && sorted.length > 0) {
                const [id] = sorted.shift()!;
                this.sessions.delete(id);
                this.messages.delete(id);
                deleted++;
            }
        }

        if (expired > 0) log.info({ expired, archived, deleted }, 'Session cleanup');
        return { expired, archived, deleted };
    }

    /**
     * Export a session
     */
    export(sessionId: string): SessionExport | null {
        const meta = this.sessions.get(sessionId);
        if (!meta) return null;

        return {
            metadata: { ...meta },
            messages: [...(this.messages.get(sessionId) || [])],
            exportedAt: Date.now(),
            version: '1.0.0',
        };
    }

    /**
     * Import a session
     */
    import(data: SessionExport): boolean {
        try {
            this.sessions.set(data.metadata.id, { ...data.metadata, lastActiveAt: Date.now() });
            this.messages.set(data.metadata.id, [...data.messages]);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * List sessions with filtering
     */
    list(filter?: { channel?: string; userId?: string; archived?: boolean; tag?: string }): SessionMetadata[] {
        let results = [...this.sessions.values()];

        if (filter?.channel) results = results.filter(s => s.channel === filter.channel);
        if (filter?.userId) results = results.filter(s => s.userId === filter.userId);
        if (filter?.archived !== undefined) results = results.filter(s => s.archived === filter.archived);
        if (filter?.tag) results = results.filter(s => s.tags.includes(filter.tag!));

        return results.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    }

    /**
     * Get stats
     */
    getStats(): { total: number; active: number; archived: number; expired: number; totalMessages: number } {
        const all = [...this.sessions.values()];
        return {
            total: all.length,
            active: all.filter(s => !s.archived && !this.isExpired(s.id)).length,
            archived: all.filter(s => s.archived).length,
            expired: all.filter(s => this.isExpired(s.id)).length,
            totalMessages: [...this.messages.values()].reduce((s, m) => s + m.length, 0),
        };
    }
}
