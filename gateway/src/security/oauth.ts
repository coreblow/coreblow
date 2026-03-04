/**
 * src/security/oauth.ts
 * OAuth2 Flow — PKCE, token refresh, encrypted storage
 */

import crypto from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('security:oauth');

export interface OAuthConfig {
    clientId: string;
    clientSecret?: string;
    authorizeUrl: string;
    tokenUrl: string;
    redirectUri: string;
    scopes: string[];
    usePKCE?: boolean;
}

export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    tokenType: string;
    scope?: string;
}

/**
 * Generate PKCE challenge pair
 */
export function generatePKCE(): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

/**
 * Build authorization URL
 */
export function buildAuthUrl(config: OAuthConfig, state?: string): {
    url: string;
    state: string;
    pkce?: { verifier: string; challenge: string };
} {
    const authState = state || crypto.randomBytes(16).toString('hex');
    const pkce = config.usePKCE ? generatePKCE() : undefined;

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state: authState,
    });

    if (pkce) {
        params.set('code_challenge', pkce.challenge);
        params.set('code_challenge_method', 'S256');
    }

    return {
        url: `${config.authorizeUrl}?${params}`,
        state: authState,
        pkce,
    };
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(
    config: OAuthConfig,
    code: string,
    pkceVerifier?: string,
): Promise<OAuthTokens> {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
    });

    if (config.clientSecret) body.set('client_secret', config.clientSecret);
    if (pkceVerifier) body.set('code_verifier', pkceVerifier);

    const res = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OAuth token exchange failed: ${res.status} ${err}`);
    }

    const data = await res.json() as any;

    log.info('OAuth code exchanged successfully');

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        tokenType: data.token_type || 'Bearer',
        scope: data.scope,
    };
}

/**
 * Refresh an expired token
 */
export async function refreshToken(
    config: OAuthConfig,
    refreshTokenValue: string,
): Promise<OAuthTokens> {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenValue,
        client_id: config.clientId,
    });

    if (config.clientSecret) body.set('client_secret', config.clientSecret);

    const res = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OAuth refresh failed: ${res.status} ${err}`);
    }

    const data = await res.json() as any;

    log.info('OAuth token refreshed');

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshTokenValue,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        tokenType: data.token_type || 'Bearer',
        scope: data.scope,
    };
}

/**
 * Encrypt a token value with AES-256-GCM
 */
export function encryptToken(token: string, secret: string): string {
    const key = crypto.scryptSync(secret, 'coreblow-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(token, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a token value
 */
export function decryptToken(encrypted: string, secret: string): string {
    const [ivHex, authTagHex, data] = encrypted.split(':');
    const key = crypto.scryptSync(secret, 'coreblow-salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(data, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
}

/**
 * Check if tokens need refresh (within 5 mins of expiry)
 */
export function needsRefresh(tokens: OAuthTokens): boolean {
    return Date.now() > tokens.expiresAt - 5 * 60 * 1000;
}
