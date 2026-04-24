import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './session.js';

describe('SessionManager', () => {
    let mgr: SessionManager;

    beforeEach(() => {
        mgr = new SessionManager({ ttlMs: 60_000, maxSessions: 5 });
    });

    describe('create', () => {
        it('creates a session with UUID', () => {
            const session = mgr.create('user1');
            expect(session.id).toBeTruthy();
            expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
            expect(session.userId).toBe('user1');
            expect(session.expiresAt).toBeGreaterThan(Date.now());
        });

        it('creates session without userId', () => {
            const session = mgr.create();
            expect(session.userId).toBeUndefined();
        });

        it('stores custom data', () => {
            const session = mgr.create('u', { role: 'admin', theme: 'dark' });
            expect(session.data.role).toBe('admin');
            expect(session.data.theme).toBe('dark');
        });

        it('defaults data to empty object', () => {
            const session = mgr.create('u');
            expect(session.data).toEqual({});
        });

        it('enforces maxSessions by evicting oldest', () => {
            const sessions = [];
            for (let i = 0; i < 6; i++) {
                sessions.push(mgr.create(`user${i}`));
            }
            // First session should be evicted
            expect(mgr.get(sessions[0].id)).toBeNull();
            expect(mgr.getActiveCount()).toBe(5);
        });
    });

    describe('get', () => {
        it('returns existing session', () => {
            const session = mgr.create('u');
            expect(mgr.get(session.id)).not.toBeNull();
            expect(mgr.get(session.id)!.userId).toBe('u');
        });

        it('returns null for unknown ID', () => {
            expect(mgr.get('nonexistent')).toBeNull();
        });

        it('returns null and deletes expired session', () => {
            const shortMgr = new SessionManager({ ttlMs: 1 });
            const session = shortMgr.create('u');
            const start = Date.now();
            while (Date.now() - start < 5) {}
            expect(shortMgr.get(session.id)).toBeNull();
        });
    });

    describe('validate', () => {
        it('validates a valid session', () => {
            const session = mgr.create('u');
            expect(mgr.validate(session.id)).not.toBeNull();
        });

        it('returns null for invalid session', () => {
            expect(mgr.validate('bad-id')).toBeNull();
        });
    });

    describe('destroy', () => {
        it('destroys an existing session', () => {
            const session = mgr.create('u');
            expect(mgr.destroy(session.id)).toBe(true);
            expect(mgr.get(session.id)).toBeNull();
        });

        it('returns false for unknown session', () => {
            expect(mgr.destroy('nonexistent')).toBe(false);
        });
    });

    describe('update', () => {
        it('updates session data', () => {
            const session = mgr.create('u', { count: 0 });
            expect(mgr.update(session.id, { count: 1, newField: 'hello' })).toBe(true);
            const updated = mgr.get(session.id)!;
            expect(updated.data.count).toBe(1);
            expect(updated.data.newField).toBe('hello');
        });

        it('returns false for unknown session', () => {
            expect(mgr.update('bad', { x: 1 })).toBe(false);
        });
    });

    describe('touch', () => {
        it('extends session expiry', () => {
            const session = mgr.create('u');
            const origExpiry = session.expiresAt;
            // Small delay to ensure time advances
            const start = Date.now();
            while (Date.now() - start < 2) {}
            expect(mgr.touch(session.id)).toBe(true);
            const updated = mgr.get(session.id)!;
            expect(updated.expiresAt).toBeGreaterThanOrEqual(origExpiry);
        });

        it('returns false for unknown session', () => {
            expect(mgr.touch('bad')).toBe(false);
        });
    });

    describe('buildCookie', () => {
        it('builds cookie with default name', () => {
            const session = mgr.create('u');
            const cookie = mgr.buildCookie(session.id);
            expect(cookie).toContain(`cb-session=${session.id}`);
            expect(cookie).toContain('Path=/');
            expect(cookie).toContain('HttpOnly');
            expect(cookie).toContain('SameSite=Lax');
            expect(cookie).toContain('Max-Age=');
        });

        it('includes Secure flag when configured', () => {
            const secureMgr = new SessionManager({ secure: true });
            const session = secureMgr.create('u');
            const cookie = secureMgr.buildCookie(session.id);
            expect(cookie).toContain('Secure');
        });

        it('omits Secure flag when not configured', () => {
            const cookie = mgr.buildCookie('test-id');
            expect(cookie).not.toContain('Secure');
        });

        it('uses custom cookie name', () => {
            const custom = new SessionManager({ cookieName: 'my-app' });
            const session = custom.create('u');
            const cookie = custom.buildCookie(session.id);
            expect(cookie).toContain('my-app=');
        });
    });

    describe('buildClearCookie', () => {
        it('builds clear cookie with Max-Age=0', () => {
            const cookie = mgr.buildClearCookie();
            expect(cookie).toContain('cb-session=');
            expect(cookie).toContain('Max-Age=0');
            expect(cookie).toContain('HttpOnly');
        });
    });

    describe('extractFromCookie', () => {
        it('extracts session ID from cookie header', () => {
            const id = mgr.extractFromCookie('cb-session=abc-123; other=value');
            expect(id).toBe('abc-123');
        });

        it('handles single cookie', () => {
            const id = mgr.extractFromCookie('cb-session=xyz');
            expect(id).toBe('xyz');
        });

        it('returns null when cookie not found', () => {
            expect(mgr.extractFromCookie('other=value')).toBeNull();
        });

        it('returns null for undefined header', () => {
            expect(mgr.extractFromCookie(undefined)).toBeNull();
        });

        it('uses custom cookie name', () => {
            const custom = new SessionManager({ cookieName: 'my-sess' });
            const id = custom.extractFromCookie('my-sess=test-id');
            expect(id).toBe('test-id');
        });
    });

    describe('getActiveCount', () => {
        it('returns 0 initially', () => {
            expect(mgr.getActiveCount()).toBe(0);
        });

        it('counts active sessions', () => {
            mgr.create('u1');
            mgr.create('u2');
            expect(mgr.getActiveCount()).toBe(2);
        });

        it('excludes expired sessions', () => {
            const shortMgr = new SessionManager({ ttlMs: 1 });
            shortMgr.create('u');
            const start = Date.now();
            while (Date.now() - start < 5) {}
            expect(shortMgr.getActiveCount()).toBe(0);
        });
    });
});
