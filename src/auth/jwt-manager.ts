/**
 * CoreBlow — JWT Manager
 *
 * Manages JSON Web Token creation, verification,
 * refresh, and revocation with configurable algorithms.
 */

/** JWT payload */
export interface JWTPayload {
    sub: string;
    iss?: string;
    aud?: string;
    exp: number;
    iat: number;
    jti: string;
    roles?: string[];
    claims?: Record<string, unknown>;
}

/** JWT options */
export interface JWTOptions {
    issuer: string;
    audience?: string;
    expiresInMs: number;
    refreshExpiresInMs: number;
}

/**
 * CoreBlow JWT Manager
 */
export class JWTManager {
    private options: JWTOptions;
    private revoked = new Set<string>();
    private idCounter = 0;
    private stats = { issued: 0, verified: 0, revoked: 0, refreshed: 0 };

    constructor(options: Partial<JWTOptions> = {}) {
        this.options = {
            issuer: options.issuer ?? 'coreblow',
            audience: options.audience,
            expiresInMs: options.expiresInMs ?? 3600_000,
            refreshExpiresInMs: options.refreshExpiresInMs ?? 86400_000 * 7,
        };
    }

    /**
     * Create a token (simulated — real impl would use crypto).
     */
    issue(subject: string, roles?: string[], claims?: Record<string, unknown>): { token: string; payload: JWTPayload } {
        const now = Date.now();
        const jti = `jwt-${++this.idCounter}`;
        const payload: JWTPayload = {
            sub: subject, iss: this.options.issuer, aud: this.options.audience,
            exp: now + this.options.expiresInMs, iat: now, jti, roles, claims,
        };
        const token = Buffer.from(JSON.stringify(payload)).toString('base64');
        this.stats.issued++;
        return { token, payload };
    }

    /**
     * Verify a token.
     */
    verify(token: string): { valid: boolean; payload?: JWTPayload; error?: string } {
        try {
            const payload: JWTPayload = JSON.parse(Buffer.from(token, 'base64').toString());
            if (this.revoked.has(payload.jti)) return { valid: false, error: 'Token revoked' };
            if (Date.now() > payload.exp) return { valid: false, error: 'Token expired' };
            if (payload.iss !== this.options.issuer) return { valid: false, error: 'Invalid issuer' };
            this.stats.verified++;
            return { valid: true, payload };
        } catch {
            return { valid: false, error: 'Invalid token' };
        }
    }

    /**
     * Refresh a token.
     */
    refresh(token: string): { token: string; payload: JWTPayload } | null {
        const result = this.verify(token);
        if (!result.valid || !result.payload) return null;
        this.revoke(token);
        this.stats.refreshed++;
        return this.issue(result.payload.sub, result.payload.roles, result.payload.claims);
    }

    /**
     * Revoke a token.
     */
    revoke(token: string): boolean {
        try {
            const payload: JWTPayload = JSON.parse(Buffer.from(token, 'base64').toString());
            this.revoked.add(payload.jti);
            this.stats.revoked++;
            return true;
        } catch { return false; }
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }
}
