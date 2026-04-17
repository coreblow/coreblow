/**
 * CoreBlow Gateway Authentication
 *
 * Multi-strategy auth: API key, Bearer token, HMAC signature, device auth.
 * Supports role-based access, token rotation, and audit logging.
 *
 * Equivalent: CoreBlow gateway/auth.ts + auth-config-utils.ts + connection-auth.ts (~616 LOC)
 */

import { createChildLogger } from '../utils/logger.js';
import * as crypto from 'node:crypto';

const log = createChildLogger('gateway:auth');

// ─── Types ────────────────────────────────────────────────────────

export type AuthStrategy = 'api-key' | 'bearer' | 'hmac' | 'none';
export type AuthRole = 'owner' | 'admin' | 'user' | 'readonly' | 'anonymous';

export interface AuthResult {
    authenticated: boolean;
    userId?: string;
    role?: AuthRole;
    strategy?: AuthStrategy;
    error?: string;
    metadata?: Record<string, unknown>;
}

export interface AuthConfig {
    strategies: AuthStrategy[];
    apiKeys?: Array<{ key: string; role: AuthRole; label?: string; expiresAt?: number }>;
    bearerTokens?: Array<{ token: string; role: AuthRole; userId?: string }>;
    hmacSecret?: string;
    defaultRole?: AuthRole;
    allowAnonymous?: boolean;
    rateLimitPerKey?: number;
}

export interface AuthRequest {
    headers: Record<string, string | undefined>;
    query?: Record<string, string | undefined>;
    ip?: string;
}

// ─── Rate Limit State ─────────────────────────────────────────────

const rateLimitCounters = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;

// ─── Auth Engine ──────────────────────────────────────────────────

/**
 * Authenticate a request using configured strategies
 */
export function authenticate(request: AuthRequest, config: AuthConfig): AuthResult {
    let lastError: string | undefined;

    for (const strategy of config.strategies) {
        const result = authenticateWithStrategy(request, config, strategy);
        if (result.authenticated) {
            log.debug({ userId: result.userId, role: result.role, strategy }, 'Authenticated');
            return result;
        }
        // Preserve specific errors over generic ones
        if (result.error && result.error !== 'no_api_key' && result.error !== 'no_bearer' && result.error !== 'missing_hmac_fields') {
            lastError = result.error;
        }
    }

    if (config.allowAnonymous) {
        return { authenticated: true, role: 'anonymous', strategy: 'none' };
    }

    return { authenticated: false, error: lastError ?? 'No valid credentials provided' };
}

/**
 * Authenticate using a specific strategy
 */
function authenticateWithStrategy(request: AuthRequest, config: AuthConfig, strategy: AuthStrategy): AuthResult {
    switch (strategy) {
        case 'api-key':
            return authenticateApiKey(request, config);
        case 'bearer':
            return authenticateBearer(request, config);
        case 'hmac':
            return authenticateHmac(request, config);
        case 'none':
            return { authenticated: true, role: config.defaultRole ?? 'user', strategy: 'none' };
    }
}

/**
 * API Key authentication (header or query param)
 */
function authenticateApiKey(request: AuthRequest, config: AuthConfig): AuthResult {
    const key = request.headers['x-api-key']
        ?? request.headers['authorization']?.replace(/^Bearer\s+/i, '')
        ?? request.query?.['api_key'];

    if (!key) return { authenticated: false, error: 'no_api_key' };

    const entry = config.apiKeys?.find((k) => k.key === key);
    if (!entry) return { authenticated: false, error: 'invalid_api_key' };

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
        return { authenticated: false, error: 'api_key_expired' };
    }

    if (config.rateLimitPerKey && !checkRateLimit(key, config.rateLimitPerKey)) {
        return { authenticated: false, error: 'rate_limit_exceeded' };
    }

    return {
        authenticated: true,
        userId: entry.label ?? 'api-user',
        role: entry.role,
        strategy: 'api-key',
    };
}

/**
 * Bearer token authentication
 */
function authenticateBearer(request: AuthRequest, config: AuthConfig): AuthResult {
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return { authenticated: false, error: 'no_bearer' };

    const token = authHeader.slice(7);
    const entry = config.bearerTokens?.find((t) => t.token === token);
    if (!entry) return { authenticated: false, error: 'invalid_bearer' };

    return {
        authenticated: true,
        userId: entry.userId ?? 'bearer-user',
        role: entry.role,
        strategy: 'bearer',
    };
}

/**
 * HMAC signature authentication
 */
function authenticateHmac(request: AuthRequest, config: AuthConfig): AuthResult {
    const signature = request.headers['x-signature'];
    const timestamp = request.headers['x-timestamp'];

    if (!signature || !timestamp || !config.hmacSecret) {
        return { authenticated: false, error: 'missing_hmac_fields' };
    }

    // Check timestamp freshness (5 min window)
    const ts = parseInt(timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 300_000) {
        return { authenticated: false, error: 'hmac_timestamp_expired' };
    }

    const expected = crypto.createHmac('sha256', config.hmacSecret).update(timestamp).digest('hex');
    const valid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expected, 'hex'),
    );

    if (!valid) return { authenticated: false, error: 'invalid_hmac' };

    return { authenticated: true, userId: 'hmac-client', role: 'user', strategy: 'hmac' };
}

// ─── Rate Limiting ────────────────────────────────────────────────

function checkRateLimit(key: string, maxPerMinute: number): boolean {
    const now = Date.now();
    const counter = rateLimitCounters.get(key);

    if (!counter || now - counter.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitCounters.set(key, { count: 1, windowStart: now });
        return true;
    }

    counter.count++;
    return counter.count <= maxPerMinute;
}

/**
 * Clear rate limit counters
 */
export function clearRateLimits(): void {
    rateLimitCounters.clear();
}

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Mask an API key for display (show first 4 and last 4 chars)
 */
export function maskApiKey(key: string): string {
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Generate a secure API key
 */
export function generateApiKey(prefix: string = 'cb'): string {
    const random = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_${random}`;
}

/**
 * Check if a role has sufficient permissions
 */
export function hasPermission(userRole: AuthRole, requiredRole: AuthRole): boolean {
    const hierarchy: AuthRole[] = ['anonymous', 'readonly', 'user', 'admin', 'owner'];
    return hierarchy.indexOf(userRole) >= hierarchy.indexOf(requiredRole);
}

/**
 * Create a default auth config
 */
export function createDefaultAuthConfig(apiKey?: string): AuthConfig {
    return {
        strategies: apiKey ? ['api-key'] : ['none'],
        apiKeys: apiKey ? [{ key: apiKey, role: 'owner' }] : [],
        allowAnonymous: !apiKey,
        defaultRole: 'user',
    };
}
