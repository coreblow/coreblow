/**
 * CoreBlow — Session Manager
 *
 * Manages user sessions across channels. Tracks active sessions,
 * session metadata, timeouts, and cross-channel session linking.
 */

import * as crypto from 'node:crypto';

/** Session */
export interface Session {
    id: string;
    userId: string;
    channelId: string;
    channelType: string;
    conversationId?: string;
    personaId?: string;
    activeSkills: string[];
    metadata: Record<string, unknown>;
    createdAt: number;
    lastActivity: number;
    expiresAt: number;
}

/** Session options */
export interface SessionManagerOptions {
    /** Default session TTL in ms */
    defaultTTL?: number;
    /** Max sessions per user */
    maxPerUser?: number;
}

/**
 * CoreBlow Session Manager
 */
export class SessionManager {
    private sessions = new Map<string, Session>();
    private userIndex = new Map<string, Set<string>>(); // userId → sessionIds
    private options: Required<SessionManagerOptions>;
    private cleanupTimer: ReturnType<typeof setInterval>;

    constructor(opts?: SessionManagerOptions) {
        this.options = {
            defaultTTL: opts?.defaultTTL ?? 30 * 60 * 1000, // 30 min
            maxPerUser: opts?.maxPerUser ?? 5,
        };
        this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    }

    /**
     * Create a new session.
     */
    create(userId: string, channelId: string, channelType: string, ttlMs?: number): Session {
        const ttl = ttlMs ?? this.options.defaultTTL;
        const session: Session = {
            id: crypto.randomBytes(16).toString('hex'),
            userId,
            channelId,
            channelType,
            activeSkills: [],
            metadata: {},
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + ttl,
        };

        this.sessions.set(session.id, session);

        // Index by user
        if (!this.userIndex.has(userId)) this.userIndex.set(userId, new Set());
        this.userIndex.get(userId)!.add(session.id);

        // Enforce per-user limit
        this.enforceUserLimit(userId);

        return session;
    }

    /**
     * Get a session by ID.
     */
    get(sessionId: string): Session | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        if (Date.now() > session.expiresAt) {
            this.destroy(sessionId);
            return null;
        }
        return session;
    }

    /**
     * Touch a session (refresh activity).
     */
    touch(sessionId: string): boolean {
        const session = this.get(sessionId);
        if (!session) return false;
        session.lastActivity = Date.now();
        session.expiresAt = Date.now() + this.options.defaultTTL;
        return true;
    }

    /**
     * Get sessions for a user.
     */
    getUserSessions(userId: string): Session[] {
        const ids = this.userIndex.get(userId);
        if (!ids) return [];
        return Array.from(ids).map((id) => this.get(id)).filter((s): s is Session => s !== null);
    }

    /**
     * Find session by channel.
     */
    findByChannel(userId: string, channelType: string): Session | null {
        const sessions = this.getUserSessions(userId);
        return sessions.find((s) => s.channelType === channelType) ?? null;
    }

    /**
     * Destroy a session.
     */
    destroy(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        this.sessions.delete(sessionId);
        this.userIndex.get(session.userId)?.delete(sessionId);
        return true;
    }

    /**
     * Get stats.
     */
    getStats(): { activeSessions: number; uniqueUsers: number } {
        return {
            activeSessions: this.sessions.size,
            uniqueUsers: this.userIndex.size,
        };
    }

    /**
     * Count active sessions.
     */
    count(): number {
        return this.sessions.size;
    }

    /**
     * List all active sessions.
     */
    listSessions(): Session[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Delete a session by ID (alias for destroy).
     */
    deleteSession(sessionId: string): boolean {
        return this.destroy(sessionId);
    }

    /**
     * Stop the cleanup timer.
     */
    shutdown(): void {
        clearInterval(this.cleanupTimer);
    }

    // === Private ===

    private enforceUserLimit(userId: string): void {
        const ids = this.userIndex.get(userId);
        if (!ids || ids.size <= this.options.maxPerUser) return;

        const sessions = Array.from(ids)
            .map((id) => this.sessions.get(id))
            .filter((s): s is Session => s !== undefined)
            .sort((a, b) => a.lastActivity - b.lastActivity);

        while (sessions.length > this.options.maxPerUser) {
            const oldest = sessions.shift()!;
            this.destroy(oldest.id);
        }
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [id, session] of Array.from(this.sessions)) {
            if (now > session.expiresAt) this.destroy(id);
        }
    }
}
