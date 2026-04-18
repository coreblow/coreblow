/**
 * WebSocket connection tests
 */
import { describe, it, expect } from 'vitest';
import { shouldAllowConnection, recordConnection, recordDisconnection, getConnectionStats } from '../gateway/server/ws-connection/connect-policy.js';
import { extractWsToken, authenticateWsConnection } from '../gateway/server/ws-connection/auth-context.js';

describe('connect-policy', () => {
    it('should allow initial connections', () => {
        const result = shouldAllowConnection('192.168.1.1');
        expect(result.allowed).toBe(true);
    });

    it('should track connections', () => {
        recordConnection('10.0.0.1');
        const stats = getConnectionStats();
        expect(stats.total).toBeGreaterThanOrEqual(1);
        recordDisconnection('10.0.0.1');
    });
});

describe('ws-auth', () => {
    it('should extract token from query param', () => {
        expect(extractWsToken('/?token=abc123', {})).toBe('abc123');
    });

    it('should extract token from Authorization header', () => {
        expect(extractWsToken(undefined, { authorization: 'Bearer my-token' })).toBe('my-token');
    });

    it('should return null when no token', () => {
        expect(extractWsToken(undefined, {})).toBeNull();
    });

    it('should authenticate with valid token', () => {
        const ctx = authenticateWsConnection('test-token');
        expect(ctx.authenticated).toBe(true);
        expect(ctx.connectionId).toMatch(/^conn_/);
    });

    // CoreBlow pattern: local connections auto-approved when no auth configured
    it('should auto-approve local connection without token (CoreBlow pattern)', () => {
        const ctx = authenticateWsConnection(null);
        expect(ctx.authenticated).toBe(true); // local + no auth configured = auto-approve
    });

    it('should reject remote connection without token', () => {
        const ctx = authenticateWsConnection(null, '203.0.113.1');
        expect(ctx.authenticated).toBe(false);
    });
});
