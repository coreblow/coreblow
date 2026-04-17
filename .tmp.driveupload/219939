/**
 * gateway/gateway-auth.ts — Dual Auth Engine
 *
 * Implements CoreBlow-compatible auth modes (token, password, trusted-proxy, none)
 * alongside existing CoreBlow enterprise modes (api-key, bearer, hmac).
 *
 * The gateway uses this module to resolve which auth mode is active and
 * to authorize WebSocket connect frames from dashboard UI and device clients.
 *
 * Ported from CoreBlow reference src/gateway/auth.ts (494 LOC) — adapted for CoreBlow
 * dual-engine architecture.
 */

import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { createChildLogger } from '../utils/logger.js';
import { safeEqualSecret } from '../security/secret-equal.js';
import type { TailscaleWhoisIdentity } from '../infra/tailscale.js';

const log = createChildLogger('gateway-auth');

// ─── Types ──────────────────────────────────────────────────────────

/** All supported auth modes — CoreBlow enterprise + CoreBlow dashboard */
export type GatewayAuthMode =
    // CoreBlow-compatible modes (dashboard / device pairing)
    | 'none'
    | 'token'
    | 'password'
    | 'trusted-proxy'
    // CoreBlow enterprise modes (API gateway)
    | 'api-key'
    | 'bearer'
    | 'hmac';

export type GatewayAuthModeSource = 'config' | 'override' | 'env' | 'default';

export interface GatewayAuthConfig {
    mode?: GatewayAuthMode;
    token?: string;
    password?: string;
    allowTailscale?: boolean;
    rateLimit?: number;
    trustedProxy?: string[];
}

export interface ResolvedGatewayAuth {
    mode: GatewayAuthMode;
    modeSource: GatewayAuthModeSource;
    token?: string;
    password?: string;
    allowTailscale: boolean;
    trustedProxy: string[];
}

export type GatewayConnectAuthMethod =
    | 'token'
    | 'password'
    | 'trusted-proxy'
    | 'tailscale'
    | 'local-none'
    | 'none';

export interface GatewayConnectAuthResult {
    ok: boolean;
    method: GatewayConnectAuthMethod;
    reason?: string;
    user?: { login?: string; name?: string };
}

// ─── Auth Mode Resolution ───────────────────────────────────────────

/**
 * Resolve the effective gateway auth mode from config, env, and overrides.
 * Priority: override > env > config > default(token)
 *
 * Ported from CoreBlow reference `resolveGatewayAuth()`.
 */
export function resolveGatewayAuth(params: {
    authConfig?: GatewayAuthConfig;
    authOverride?: GatewayAuthConfig;
    env?: NodeJS.ProcessEnv;
}): ResolvedGatewayAuth {
    const env = params.env ?? process.env;
    const authConfig = params.authConfig;
    const authOverride = params.authOverride;

    // Determine mode source and value
    let mode: GatewayAuthMode;
    let modeSource: GatewayAuthModeSource;

    if (authOverride?.mode) {
        mode = authOverride.mode;
        modeSource = 'override';
    } else if (authConfig?.mode) {
        mode = authConfig.mode;
        modeSource = 'config';
    } else {
        // Auto-detect from available credentials
        mode = autoDetectAuthMode({ authConfig, authOverride, env });
        modeSource = 'default';
    }

    // Resolve credentials
    const token = resolveToken({ authConfig, authOverride, env });
    const password = resolvePassword({ authConfig, authOverride, env });

    const allowTailscale =
        authOverride?.allowTailscale ?? authConfig?.allowTailscale ?? false;
    const trustedProxy =
        authOverride?.trustedProxy ?? authConfig?.trustedProxy ?? [];

    // Validate mode has required credentials
    validateModeCredentials(mode, token, password);

    return { mode, modeSource, token, password, allowTailscale, trustedProxy };
}

// ─── Connect Frame Authorization ────────────────────────────────────

/**
 * Authorize a WebSocket connect frame.
 * This is the main auth dispatcher for dashboard UI and device connections.
 *
 * Ported from CoreBlow reference `authorizeGatewayConnect()`.
 */
export function authorizeGatewayConnect(params: {
    resolvedAuth: ResolvedGatewayAuth;
    connectToken?: string;
    connectPassword?: string;
    isLocalRequest: boolean;
    req?: IncomingMessage;
    tailscaleIdentity?: TailscaleWhoisIdentity | null;
}): GatewayConnectAuthResult {
    const { resolvedAuth, connectToken, connectPassword, isLocalRequest } = params;

    // Mode: none — allow everything
    if (resolvedAuth.mode === 'none') {
        return { ok: true, method: 'none' };
    }

    // Mode: trusted-proxy — verify request comes from trusted proxy
    if (resolvedAuth.mode === 'trusted-proxy') {
        return authorizeTrustedProxy(params.req, resolvedAuth.trustedProxy);
    }

    // Tailscale whois auth — if allowTailscale is true and identity was resolved
    if (resolvedAuth.allowTailscale && params.tailscaleIdentity) {
        log.info(
            { login: params.tailscaleIdentity.login, name: params.tailscaleIdentity.name },
            `Tailscale identity verified: ${params.tailscaleIdentity.login}`,
        );
        return {
            ok: true,
            method: 'tailscale',
            user: {
                login: params.tailscaleIdentity.login,
                name: params.tailscaleIdentity.name,
            },
        };
    }

    // Local direct request with no auth configured = auto-approve
    if (isLocalRequest && !resolvedAuth.token && !resolvedAuth.password) {
        log.debug('Local connection auto-approved (no auth configured)');
        return { ok: true, method: 'local-none' };
    }

    // Mode: token — verify timing-safe
    if (resolvedAuth.mode === 'token' && resolvedAuth.token) {
        if (connectToken && safeEqualSecret(connectToken, resolvedAuth.token)) {
            return { ok: true, method: 'token' };
        }
        // Fall through to password check if both configured
    }

    // Mode: password — verify timing-safe
    if (resolvedAuth.mode === 'password' && resolvedAuth.password) {
        if (connectPassword && safeEqualSecret(connectPassword, resolvedAuth.password)) {
            return { ok: true, method: 'password' };
        }
    }

    // Cross-mode fallback: try token even in password mode and vice versa
    if (resolvedAuth.token && connectToken && safeEqualSecret(connectToken, resolvedAuth.token)) {
        return { ok: true, method: 'token' };
    }
    if (resolvedAuth.password && connectPassword && safeEqualSecret(connectPassword, resolvedAuth.password)) {
        return { ok: true, method: 'password' };
    }

    return { ok: false, method: resolvedAuth.mode as GatewayConnectAuthMethod, reason: 'unauthorized' };
}

// ─── Trusted Proxy ───────────────────────────────────────────────────

function authorizeTrustedProxy(
    req: IncomingMessage | undefined,
    trustedProxies: string[],
): GatewayConnectAuthResult {
    if (!req) {
        return { ok: false, method: 'trusted-proxy', reason: 'no_request_context' };
    }

    const remoteAddress = req.socket?.remoteAddress ?? '';
    const allTrusted = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...trustedProxies];

    if (!allTrusted.includes(remoteAddress)) {
        return { ok: false, method: 'trusted-proxy', reason: 'untrusted_source' };
    }

    return { ok: true, method: 'trusted-proxy' };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Check if request originates from loopback address. */
export function isLocalDirectRequest(req?: IncomingMessage): boolean {
    if (!req) return false;
    const addr = req.socket?.remoteAddress ?? '';
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

/** Auto-detect auth mode from available credentials. */
function autoDetectAuthMode(params: {
    authConfig?: GatewayAuthConfig;
    authOverride?: GatewayAuthConfig;
    env?: NodeJS.ProcessEnv;
}): GatewayAuthMode {
    const env = params.env ?? process.env;

    // Password in env or config takes precedence for auto-detection
    if (env.COREBLOW_GATEWAY_PASSWORD || params.authOverride?.password || params.authConfig?.password) {
        return 'password';
    }

    // Default to token mode
    return 'token';
}

/** Resolve token from override > env > config. */
function resolveToken(params: {
    authConfig?: GatewayAuthConfig;
    authOverride?: GatewayAuthConfig;
    env?: NodeJS.ProcessEnv;
}): string | undefined {
    const env = params.env ?? process.env;
    return (
        params.authOverride?.token?.trim() ||
        env.COREBLOW_GATEWAY_TOKEN?.trim() ||
        env.COREBLOW_TOKEN?.trim() ||
        params.authConfig?.token?.trim() ||
        undefined
    );
}

/** Resolve password from override > env > config. */
function resolvePassword(params: {
    authConfig?: GatewayAuthConfig;
    authOverride?: GatewayAuthConfig;
    env?: NodeJS.ProcessEnv;
}): string | undefined {
    const env = params.env ?? process.env;
    return (
        params.authOverride?.password?.trim() ||
        env.COREBLOW_GATEWAY_PASSWORD?.trim() ||
        params.authConfig?.password?.trim() ||
        undefined
    );
}

/** Validate that the mode has the required credentials. */
function validateModeCredentials(mode: GatewayAuthMode, token?: string, password?: string): void {
    if (mode === 'token' && !token) {
        log.debug('Token mode selected but no token configured — will be auto-generated at startup');
    }
    if (mode === 'password' && !password) {
        log.warn('Password mode selected but no password configured');
    }
}
