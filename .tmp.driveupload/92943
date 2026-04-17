// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionAuth } from './session-auth.js';

describe('Session Auth — Phase 6', () => {
    let auth: SessionAuth;

    beforeEach(() => {
        auth = new SessionAuth(3600_000, 3);
    });

    it('creates a session', () => {
        const session = auth.create('user1');
        expect(session.id).toBeTruthy();
        expect(session.userId).toBe('user1');
        expect(session.expiresAt).toBeGreaterThan(Date.now());
        expect(auth.count()).toBe(1);
    });

    it('validates a valid session', () => {
        const session = auth.create('user1');
        const result = auth.validate(session.id);
        expect(result.valid).toBe(true);
        expect(result.session!.userId).toBe('user1');
    });

    it('rejects unknown session', () => {
        const result = auth.validate('fake-session-id');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not found');
    });

    it('rejects expired session', () => {
        const expiredAuth = new SessionAuth(1);
        const session = expiredAuth.create('user1');
        const start = Date.now();
        while (Date.now() - start < 5) {}
        const result = expiredAuth.validate(session.id);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('expired');
    });

    it('renews session', () => {
        const session = auth.create('user1');
        const oldExpiry = session.expiresAt;
        expect(auth.renew(session.id)).toBe(true);
        const result = auth.validate(session.id);
        expect(result.session!.expiresAt).toBeGreaterThanOrEqual(oldExpiry);
    });

    it('destroys session', () => {
        const session = auth.create('user1');
        expect(auth.destroy(session.id)).toBe(true);
        expect(auth.validate(session.id).valid).toBe(false);
    });

    it('destroyAll removes all user sessions', () => {
        auth.create('user1');
        auth.create('user1');
        auth.create('user2');
        const removed = auth.destroyAll('user1');
        expect(removed).toBe(2);
        expect(auth.count()).toBe(1);
    });

    it('enforces max sessions per user', () => {
        auth.create('user1');
        auth.create('user1');
        auth.create('user1');
        auth.create('user1'); // evicts oldest
        expect(auth.count()).toBe(3);
    });

    it('stores custom data and IP/UA', () => {
        const session = auth.create('user1', { role: 'admin' }, '127.0.0.1', 'CB/1.0');
        expect(session.data.role).toBe('admin');
        expect(session.ipAddress).toBe('127.0.0.1');
    });

    it('getStats tracks operations', () => {
        auth.create('user1');
        const sess = auth.create('user2');
        auth.validate(sess.id);
        auth.destroy(sess.id);
        const stats = auth.getStats();
        expect(stats.created).toBe(2);
        expect(stats.validated).toBe(1);
        expect(stats.destroyed).toBe(1);
    });
});
