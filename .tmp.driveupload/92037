// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { isLoopbackHost, isSecureWebSocketUrl } from './net.js';
import {
    DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS,
    MIN_CONNECT_CHALLENGE_TIMEOUT_MS,
    MAX_CONNECT_CHALLENGE_TIMEOUT_MS,
    clampConnectChallengeTimeoutMs,
    resolveConnectChallengeTimeoutMs,
    getPreauthHandshakeTimeoutMsFromEnv,
    resolveHandshakeTimeout,
    HANDSHAKE_TIMEOUT_MS,
} from './handshake-timeouts.js';
import {
    buildDeviceAuthPayload,
    buildDeviceAuthPayloadV3,
    authenticateDevice,
    generateDeviceToken,
} from './device-auth.js';

describe('Gateway Net & Security — Phase 16', () => {

    // ─── isLoopbackHost ────────────────────────────────────────

    describe('isLoopbackHost', () => {
        it('localhost is loopback', () => expect(isLoopbackHost('localhost')).toBe(true));
        it('127.0.0.1 is loopback', () => expect(isLoopbackHost('127.0.0.1')).toBe(true));
        it('127.0.0.42 is loopback', () => expect(isLoopbackHost('127.0.0.42')).toBe(true));
        it('::1 is loopback', () => expect(isLoopbackHost('::1')).toBe(true));
        it('[::1] is loopback', () => expect(isLoopbackHost('[::1]')).toBe(true));
        it('0.0.0.0 is NOT loopback', () => expect(isLoopbackHost('0.0.0.0')).toBe(false));
        it('192.168.1.1 is NOT loopback', () => expect(isLoopbackHost('192.168.1.1')).toBe(false));
        it('empty is NOT loopback', () => expect(isLoopbackHost('')).toBe(false));
    });

    // ─── isSecureWebSocketUrl ──────────────────────────────────

    describe('isSecureWebSocketUrl', () => {
        it('wss:// is secure', () => expect(isSecureWebSocketUrl('wss://example.com')).toBe(true));
        it('ws://localhost is secure', () => expect(isSecureWebSocketUrl('ws://localhost:18789')).toBe(true));
        it('ws://127.0.0.1 is secure', () => expect(isSecureWebSocketUrl('ws://127.0.0.1:18789')).toBe(true));
        it('ws://remote is NOT secure', () => expect(isSecureWebSocketUrl('ws://example.com')).toBe(false));
        it('invalid URL is NOT secure', () => expect(isSecureWebSocketUrl('not-a-url')).toBe(false));
        it('ws://192.168.1.1 is NOT secure by default', () => expect(isSecureWebSocketUrl('ws://192.168.1.1')).toBe(false));
        it('ws://192.168.1.1 is secure with allowPrivateWs', () => expect(isSecureWebSocketUrl('ws://192.168.1.1', { allowPrivateWs: true })).toBe(true));
    });

    // ─── Handshake Timeouts ────────────────────────────────────

    describe('handshake timeouts', () => {
        it('default is 10 seconds', () => expect(DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS).toBe(10_000));
        it('min is 250ms', () => expect(MIN_CONNECT_CHALLENGE_TIMEOUT_MS).toBe(250));
        it('max equals default', () => expect(MAX_CONNECT_CHALLENGE_TIMEOUT_MS).toBe(10_000));
        it('backward compat alias', () => expect(HANDSHAKE_TIMEOUT_MS).toBe(10_000));

        it('clamp respects bounds', () => {
            expect(clampConnectChallengeTimeoutMs(100)).toBe(250);
            expect(clampConnectChallengeTimeoutMs(5000)).toBe(5000);
            expect(clampConnectChallengeTimeoutMs(99999)).toBe(10_000);
        });

        it('resolve uses default for null/NaN', () => {
            expect(resolveConnectChallengeTimeoutMs(null)).toBe(10_000);
            expect(resolveConnectChallengeTimeoutMs(undefined)).toBe(10_000);
            expect(resolveConnectChallengeTimeoutMs(NaN)).toBe(10_000);
        });

        it('resolve clamps valid value', () => {
            expect(resolveConnectChallengeTimeoutMs(5000)).toBe(5000);
        });

        it('getPreauthHandshakeTimeoutMsFromEnv returns default for empty', () => {
            expect(getPreauthHandshakeTimeoutMsFromEnv({})).toBe(10_000);
        });

        it('getPreauthHandshakeTimeoutMsFromEnv reads env var', () => {
            expect(getPreauthHandshakeTimeoutMsFromEnv({ COREBLOW_HANDSHAKE_TIMEOUT_MS: '5000' })).toBe(5000);
        });

        it('resolveHandshakeTimeout returns default for invalid', () => {
            expect(resolveHandshakeTimeout(undefined)).toBe(10_000);
            expect(resolveHandshakeTimeout(NaN)).toBe(10_000);
            expect(resolveHandshakeTimeout(-1)).toBe(10_000);
        });

        it('resolveHandshakeTimeout returns valid value', () => {
            expect(resolveHandshakeTimeout(8000)).toBe(8000);
        });
    });

    // ─── Device Auth ───────────────────────────────────────────

    describe('device auth', () => {
        it('buildDeviceAuthPayload creates v2 payload', () => {
            const payload = buildDeviceAuthPayload({
                deviceId: 'dev-1', clientId: 'cli', clientMode: 'backend',
                role: 'operator', scopes: ['admin'], signedAtMs: 1000, nonce: 'abc',
            });
            expect(payload).toContain('v2');
            expect(payload).toContain('dev-1');
            expect(payload).toContain('abc');
        });

        it('buildDeviceAuthPayloadV3 creates v3 payload with platform', () => {
            const payload = buildDeviceAuthPayloadV3({
                deviceId: 'dev-1', clientId: 'cli', clientMode: 'backend',
                role: 'operator', scopes: ['admin'], signedAtMs: 1000, nonce: 'xyz',
                platform: 'darwin', deviceFamily: 'macbook',
            });
            expect(payload).toContain('v3');
            expect(payload).toContain('darwin');
            expect(payload).toContain('macbook');
        });

        it('authenticateDevice allows valid token', () => {
            expect(authenticateDevice(['tok-1', 'tok-2'], 'tok-1')).toEqual({ allowed: true });
        });

        it('authenticateDevice rejects missing token', () => {
            expect(authenticateDevice(['tok-1'], undefined)).toEqual({ allowed: false, reason: 'missing device token' });
        });

        it('authenticateDevice rejects unregistered device', () => {
            expect(authenticateDevice(undefined, 'tok-1')).toEqual({ allowed: false, reason: 'device not registered' });
            expect(authenticateDevice([], 'tok-1')).toEqual({ allowed: false, reason: 'device not registered' });
        });

        it('authenticateDevice rejects invalid token', () => {
            expect(authenticateDevice(['tok-1'], 'wrong')).toEqual({ allowed: false, reason: 'invalid device token' });
        });

        it('generateDeviceToken creates unique token', () => {
            const t1 = generateDeviceToken();
            const t2 = generateDeviceToken();
            expect(t1).toMatch(/^dev_[a-f0-9]{32}$/);
            expect(t1).not.toBe(t2);
        });
    });
});
