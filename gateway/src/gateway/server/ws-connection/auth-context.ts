/**
 * gateway/server/ws-connection/auth-context.ts
 *
 * Layer 1: Gateway Authentication — CoreBlow Pattern
 *
 * Implements timing-safe token/password verification with SHA256 hashing.
 * Local connections (127.0.0.1) are auto-approved when no auth is configured,
 * following CoreBlow's `GatewayAuth.verifyConnect()` pattern.
 */

import crypto from 'node:crypto';
import { createChildLogger } from '../../../utils/logger.js';
export interface ConnectionContext {
    connectionId: string;
    authenticated: boolean;
    connectedAt: number;
    userId?: string;
}

const log = createChildLogger('ws-auth');

// ─── GatewayAuth (CoreBlow Pattern: src/security/auth.ts) ────────

interface AuthConfig {
    token?: string;
    password?: string;
}

/**
 * Gateway authentication following CoreBlow's GatewayAuth pattern.
 * Uses SHA256 hashing + crypto.timingSafeEqual for timing-safe comparison.
 */
export class GatewayAuth {
    private readonly tokenHash: Buffer | null;
    private readonly passwordHash: Buffer | null;

    constructor(config: AuthConfig) {
        this.tokenHash = config.token
            ? crypto.createHash('sha256').update(config.token).digest()
            : null;
        this.passwordHash = config.password
            ? crypto.createHash('sha256').update(config.password).digest()
            : null;
    }

    /**
     * Timing-safe compare to prevent timing attacks.
     * Returns true if the provided credential matches.
     */
    verify(credential: string, type: 'token' | 'password'): boolean {
        const expected = type === 'token' ? this.tokenHash : this.passwordHash;
        if (!expected) return false;

        const provided = crypto.createHash('sha256').update(credential).digest();
        return crypto.timingSafeEqual(provided, expected);
    }

    /**
     * Verify connect frame from WebSocket client.
     * Local connections (127.0.0.1) auto-approved if no auth configured.
     */
    verifyConnect(frame: { token?: string; password?: string }, isLocal: boolean): boolean {
        // No auth configured + local = allow (CoreBlow pattern)
        if (!this.tokenHash && !this.passwordHash && isLocal) return true;

        if (frame.token && this.verify(frame.token, 'token')) return true;
        if (frame.password && this.verify(frame.password, 'password')) return true;

        return false;
    }

    /** Check if any auth is configured */
    hasAuth(): boolean {
        return this.tokenHash !== null || this.passwordHash !== null;
    }
}

// ─── Singleton (lazy-init from env/config) ──────────────────────

let _gatewayAuth: GatewayAuth | null = null;

function getGatewayAuth(): GatewayAuth {
    if (!_gatewayAuth) {
        _gatewayAuth = new GatewayAuth({
            token: process.env.COREBLOW_TOKEN || process.env.AIGATEWAY_TOKEN,
            password: process.env.COREBLOW_PASSWORD || process.env.AIGATEWAY_PASSWORD,
        });
    }
    return _gatewayAuth;
}

// ─── Connection-level Functions ─────────────────────────────────

/** Validate a WebSocket connection token. */
export function authenticateWsConnection(
    token: string | null,
    remoteAddress?: string,
): ConnectionContext {
    const connectionId = `conn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const ctx: ConnectionContext = {
        connectionId,
        authenticated: false,
        connectedAt: Date.now(),
    };

    const auth = getGatewayAuth();
    const isLocal = !remoteAddress
        || remoteAddress === '127.0.0.1'
        || remoteAddress === '::1'
        || remoteAddress === '::ffff:127.0.0.1';

    const verified = auth.verifyConnect(
        { token: token ?? undefined },
        isLocal,
    );

    if (verified) {
        ctx.authenticated = true;
        ctx.userId = token
            ? `user_${crypto.createHash('sha256').update(token).digest('hex').slice(0, 8)}`
            : `local_${connectionId.slice(-6)}`;
        log.info({ connectionId, userId: ctx.userId, isLocal }, 'WS connection authenticated');
    } else {
        log.warn({ connectionId, isLocal }, 'WS connection auth failed');
    }

    return ctx;
}

/** Extract token from WebSocket upgrade request. */
export function extractWsToken(
    url: string | undefined,
    headers: Record<string, string | string[] | undefined>,
): string | null {
    // Check query param: ?token=xxx
    if (url) {
        try {
            const parsed = new URL(url, 'http://localhost');
            const token = parsed.searchParams.get('token');
            if (token) return token;
        } catch { /* ignore parse errors */ }
    }

    // Check Authorization header
    const auth = headers.authorization;
    if (typeof auth === 'string') {
        const match = /^bearer\s+(.+)$/i.exec(auth);
        if (match) return match[1];
    }

    return null;
}

/** Reset the singleton (for testing) */
export function resetGatewayAuth(): void {
    _gatewayAuth = null;
}
