/**
 * CoreBlow — Session Auth
 *
 * Session-based authentication with secure session
 * creation, validation, renewal, and cleanup.
 */

/** Session */
export interface Session {
    id: string;
    userId: string;
    data: Record<string, unknown>;
    createdAt: number;
    expiresAt: number;
    lastAccessedAt: number;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * CoreBlow Session Auth
 */
export class SessionAuth {
    private sessions = new Map<string, Session>();
    private userSessions = new Map<string, Set<string>>(); // userId → sessionIds
    private maxAge: number;
    private maxPerUser: number;
    private idCounter = 0;
    private stats = { created: 0, validated: 0, expired: 0, destroyed: 0 };

    constructor(maxAgeMs: number = 3600_000, maxPerUser: number = 5) {
        this.maxAge = maxAgeMs;
        this.maxPerUser = maxPerUser;
    }

    /**
     * Create a session.
     */
    create(userId: string, data?: Record<string, unknown>, ipAddress?: string, userAgent?: string): Session {
        const id = `sess-${++this.idCounter}-${Date.now()}`;
        const session: Session = {
            id, userId, data: data ?? {}, createdAt: Date.now(),
            expiresAt: Date.now() + this.maxAge, lastAccessedAt: Date.now(),
            ipAddress, userAgent,
        };
        this.sessions.set(id, session);

        if (!this.userSessions.has(userId)) this.userSessions.set(userId, new Set());
        this.userSessions.get(userId)!.add(id);

        // Enforce max sessions per user
        const userSess = this.userSessions.get(userId)!;
        if (userSess.size > this.maxPerUser) {
            const oldest = Array.from(userSess).find((sid) => {
                const s = this.sessions.get(sid);
                return s && sid !== id;
            });
            if (oldest) { this.sessions.delete(oldest); userSess.delete(oldest); }
        }

        this.stats.created++;
        return session;
    }

    /**
     * Validate a session.
     */
    validate(sessionId: string): { valid: boolean; session?: Session; error?: string } {
        const session = this.sessions.get(sessionId);
        if (!session) return { valid: false, error: 'Session not found' };
        if (Date.now() > session.expiresAt) {
            this.destroy(sessionId);
            this.stats.expired++;
            return { valid: false, error: 'Session expired' };
        }
        session.lastAccessedAt = Date.now();
        this.stats.validated++;
        return { valid: true, session };
    }

    /**
     * Renew a session.
     */
    renew(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        session.expiresAt = Date.now() + this.maxAge;
        return true;
    }

    /**
     * Destroy a session.
     */
    destroy(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        this.sessions.delete(sessionId);
        this.userSessions.get(session.userId)?.delete(sessionId);
        this.stats.destroyed++;
        return true;
    }

    /**
     * Destroy all sessions for a user.
     */
    destroyAll(userId: string): number {
        const ids = this.userSessions.get(userId);
        if (!ids) return 0;
        let count = 0;
        for (const id of Array.from(ids)) { this.sessions.delete(id); count++; }
        this.userSessions.delete(userId);
        this.stats.destroyed += count;
        return count;
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /** Count */
    count(): number { return this.sessions.size; }
}
