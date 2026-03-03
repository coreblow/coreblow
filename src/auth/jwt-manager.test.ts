import { describe, it, expect, beforeEach } from 'vitest';
import { JWTManager } from './jwt-manager.js';

describe('JWTManager', () => {
    let jwt: JWTManager;

    beforeEach(() => {
        jwt = new JWTManager({ issuer: 'coreblow-test' });
    });

    describe('issue', () => {
        it('issues a token with correct payload', () => {
            const { token, payload } = jwt.issue('user1');
            expect(token).toBeTruthy();
            expect(payload.sub).toBe('user1');
            expect(payload.iss).toBe('coreblow-test');
            expect(payload.jti).toMatch(/^jwt-/);
            expect(payload.exp).toBeGreaterThan(Date.now());
            expect(payload.iat).toBeLessThanOrEqual(Date.now());
        });

        it('includes roles and claims', () => {
            const { payload } = jwt.issue('user1', ['admin'], { org: 'coreblow' });
            expect(payload.roles).toEqual(['admin']);
            expect(payload.claims).toEqual({ org: 'coreblow' });
        });

        it('generates unique JTIs', () => {
            const t1 = jwt.issue('u1');
            const t2 = jwt.issue('u2');
            expect(t1.payload.jti).not.toBe(t2.payload.jti);
        });
    });

    describe('verify', () => {
        it('verifies a valid token', () => {
            const { token } = jwt.issue('user1');
            const result = jwt.verify(token);
            expect(result.valid).toBe(true);
            expect(result.payload!.sub).toBe('user1');
        });

        it('rejects invalid token', () => {
            const result = jwt.verify('garbage-data');
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('rejects expired token', () => {
            const shortJwt = new JWTManager({ issuer: 'test', expiresInMs: 1 });
            const { token } = shortJwt.issue('user1');
            const start = Date.now();
            while (Date.now() - start < 5) {}
            const result = shortJwt.verify(token);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('expired');
        });

        it('rejects revoked token', () => {
            const { token } = jwt.issue('user1');
            jwt.revoke(token);
            const result = jwt.verify(token);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('revoked');
        });

        it('rejects wrong issuer', () => {
            const otherJwt = new JWTManager({ issuer: 'other-service' });
            const { token } = otherJwt.issue('user1');
            const result = jwt.verify(token);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('issuer');
        });
    });

    describe('refresh', () => {
        it('refreshes a valid token', () => {
            const { token: oldToken } = jwt.issue('user1', ['admin']);
            const result = jwt.refresh(oldToken);
            expect(result).not.toBeNull();
            expect(result!.payload.sub).toBe('user1');
            expect(result!.payload.roles).toEqual(['admin']);
            expect(result!.token).not.toBe(oldToken);
        });

        it('revokes old token after refresh', () => {
            const { token: oldToken } = jwt.issue('user1');
            jwt.refresh(oldToken);
            expect(jwt.verify(oldToken).valid).toBe(false);
        });

        it('returns null for invalid token', () => {
            expect(jwt.refresh('garbage')).toBeNull();
        });
    });

    describe('revoke', () => {
        it('revokes a token', () => {
            const { token } = jwt.issue('user1');
            expect(jwt.revoke(token)).toBe(true);
        });

        it('returns false for malformed token', () => {
            expect(jwt.revoke('bad')).toBe(false);
        });
    });

    describe('stats', () => {
        it('tracks all operations', () => {
            const { token } = jwt.issue('user1');
            jwt.verify(token);
            jwt.revoke(token);
            const t2 = jwt.issue('user2');
            jwt.refresh(t2.token);
            const stats = jwt.getStats();
            expect(stats.issued).toBe(3); // issue + issue + refresh re-issues
            expect(stats.verified).toBe(2); // verify + refresh verifies
            expect(stats.revoked).toBe(2); // revoke + refresh revokes old
            expect(stats.refreshed).toBe(1);
        });
    });
});
