/**
 * CoreBlow Web — Session Management
 *
 * Cookie-based web session management for the dashboard.
 * Supports login/logout flow, session creation/validation,
 * and QR code endpoint for channel pairing.
 */

import * as crypto from 'node:crypto';

/** Web session data */
export interface WebSession {
    id: string;
    userId?: string;
    createdAt: number;
    expiresAt: number;
    data: Record<string, unknown>;
}

/** Session store configuration */
export interface SessionConfig {
    /** Session time-to-live in milliseconds. Default: 24 hours */
    ttlMs?: number;
    /** Cookie name. Default: "cb-session" */
    cookieName?: string;
    /** Cookie secure flag */
    secure?: boolean;
    /** Maximum concurrent sessions */
    maxSessions?: number;
}

/**
 * CoreBlow Session Manager
 */
export class SessionManager {
    private sessions = new Map<string, WebSession>();
    private config: Required<SessionConfig>;

    constructor(config?: SessionConfig) {
        this.config = {
            ttlMs: config?.ttlMs ?? 24 * 60 * 60_000,
            cookieName: config?.cookieName ?? 'cb-session',
            secure: config?.secure ?? false,
            maxSessions: config?.maxSessions ?? 1000,
        };
    }

    /**
     * Create a new session.
     */
    create(userId?: string, data?: Record<string, unknown>): WebSession {
        // Evict expired sessions first
        this.cleanup();

        // Enforce max sessions limit
        if (this.sessions.size >= this.config.maxSessions) {
            // Evict oldest session
            const oldest = this.getOldest();
            if (oldest) this.sessions.delete(oldest.id);
        }

        const session: WebSession = {
            id: crypto.randomUUID(),
            userId,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.ttlMs,
            data: data ?? {},
        };

        this.sessions.set(session.id, session);
        return session;
    }

    /**
     * Get a session by ID.
     */
    get(sessionId: string): WebSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        // Check expiry
        if (Date.now() > session.expiresAt) {
            this.sessions.delete(sessionId);
            return null;
        }

        return session;
    }

    /**
     * Validate a session ID and return the session if valid.
     */
    validate(sessionId: string): WebSession | null {
        return this.get(sessionId);
    }

    /**
     * Destroy a session (logout).
     */
    destroy(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }

    /**
     * Update session data.
     */
    update(sessionId: string, data: Partial<Record<string, unknown>>): boolean {
        const session = this.get(sessionId);
        if (!session) return false;
        Object.assign(session.data, data);
        return true;
    }

    /**
     * Extend session expiry.
     */
    touch(sessionId: string): boolean {
        const session = this.get(sessionId);
        if (!session) return false;
        session.expiresAt = Date.now() + this.config.ttlMs;
        return true;
    }

    /**
     * Build a Set-Cookie header value for a session.
     */
    buildCookie(sessionId: string): string {
        const parts = [
            `${this.config.cookieName}=${sessionId}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
        ];
        if (this.config.secure) parts.push('Secure');
        const maxAge = Math.floor(this.config.ttlMs / 1000);
        parts.push(`Max-Age=${maxAge}`);
        return parts.join('; ');
    }

    /**
     * Build a Set-Cookie header to clear the session cookie.
     */
    buildClearCookie(): string {
        return `${this.config.cookieName}=; Path=/; HttpOnly; Max-Age=0`;
    }

    /**
     * Extract session ID from cookie header.
     */
    extractFromCookie(cookieHeader: string | undefined): string | null {
        if (!cookieHeader) return null;

        const prefix = `${this.config.cookieName}=`;
        const cookies = cookieHeader.split(';').map((c) => c.trim());
        const match = cookies.find((c) => c.startsWith(prefix));

        return match ? match.slice(prefix.length) : null;
    }

    /**
     * Get active session count.
     */
    getActiveCount(): number {
        this.cleanup();
        return this.sessions.size;
    }

    // === Private ===

    private cleanup(): void {
        const now = Date.now();
        for (const [id, session] of Array.from(this.sessions)) {
            if (now > session.expiresAt) {
                this.sessions.delete(id);
            }
        }
    }

    private getOldest(): WebSession | null {
        let oldest: WebSession | null = null;
        for (const session of Array.from(this.sessions.values())) {
            if (!oldest || session.createdAt < oldest.createdAt) {
                oldest = session;
            }
        }
        return oldest;
    }
}
