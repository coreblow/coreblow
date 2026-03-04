/**
 * src/security/auth.ts
 * Gateway authentication — token-based
 */

import crypto from 'node:crypto';
import { getConfig } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('auth');

/**
 * Validate a request token
 */
export function validateToken(token: string): boolean {
    const config = getConfig();
    if (!config.token) return true; // No token configured = open access
    return crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(config.token)
    );
}

/**
 * Extract token from request headers
 */
export function extractToken(headers: Record<string, string | undefined>): string | null {
    // Bearer token
    const auth = headers.authorization || headers.Authorization;
    if (auth?.startsWith('Bearer ')) {
        return auth.slice(7);
    }

    // X-Gateway-Token header
    const gatewayToken = headers['x-gateway-token'];
    if (gatewayToken) return gatewayToken;

    return null;
}

/**
 * Generate a secure random token
 */
export function generateToken(): string {
    return `cb_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Hash a token for storage
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}
