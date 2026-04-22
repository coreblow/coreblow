import { describe, it, expect, beforeEach } from 'vitest';
import { AuditTrail } from './audit-trail.js';

describe('AuditTrail', () => {
    let trail: AuditTrail;

    beforeEach(() => {
        trail = new AuditTrail();
    });

    describe('log', () => {
        it('should log an event with unique ID', () => {
            const e = trail.log('create', 'admin', 'user:123');
            expect(e.id).toMatch(/^audit-\d+$/);
            expect(e.action).toBe('create');
            expect(e.actor).toBe('admin');
            expect(e.resource).toBe('user:123');
        });

        it('should include optional details and IP', () => {
            const e = trail.log('delete', 'admin', 'file:x', { reason: 'cleanup' }, '10.0.0.1');
            expect(e.details).toEqual({ reason: 'cleanup' });
            expect(e.ip).toBe('10.0.0.1');
        });

        it('should generate hash and previousHash', () => {
            const e = trail.log('action', 'actor', 'res');
            expect(e.hash).toBeTruthy();
            expect(e.hash.length).toBe(16);
            expect(e.previousHash).toBe('0');
        });

        it('should chain hashes across events', () => {
            const e1 = trail.log('a1', 'actor', 'r1');
            const e2 = trail.log('a2', 'actor', 'r2');
            expect(e2.previousHash).toBe(e1.hash);
        });

        it('should increment count', () => {
            trail.log('a', 'b', 'c');
            trail.log('d', 'e', 'f');
            expect(trail.count()).toBe(2);
        });
    });

    describe('query methods', () => {
        beforeEach(() => {
            trail.log('create', 'admin', 'user:1');
            trail.log('delete', 'admin', 'user:2');
            trail.log('create', 'bot', 'session:1');
            trail.log('update', 'admin', 'user:1');
        });

        it('getByActor should filter by actor', () => {
            expect(trail.getByActor('admin')).toHaveLength(3);
            expect(trail.getByActor('bot')).toHaveLength(1);
        });

        it('getByAction should filter by action', () => {
            expect(trail.getByAction('create')).toHaveLength(2);
            expect(trail.getByAction('delete')).toHaveLength(1);
        });

        it('getByResource should filter by resource', () => {
            expect(trail.getByResource('user:1')).toHaveLength(2);
        });

        it('getRecent should return last N events', () => {
            expect(trail.getRecent(2)).toHaveLength(2);
        });

        it('getRecent should default to 50', () => {
            expect(trail.getRecent()).toHaveLength(4);
        });

        it('query with limit should cap results', () => {
            expect(trail.getByActor('admin', 2)).toHaveLength(2);
        });
    });

    describe('search', () => {
        beforeEach(() => {
            trail.log('user.create', 'admin@corp.com', 'user:alice');
            trail.log('session.start', 'bot-agent', 'session:xyz');
        });

        it('should search in action field', () => {
            expect(trail.search('user.create')).toHaveLength(1);
        });

        it('should search in actor field', () => {
            expect(trail.search('admin')).toHaveLength(1);
        });

        it('should search in resource field', () => {
            expect(trail.search('session')).toHaveLength(1);
        });

        it('should be case-insensitive', () => {
            expect(trail.search('ADMIN')).toHaveLength(1);
        });

        it('should return empty for no matches', () => {
            expect(trail.search('nonexistent')).toHaveLength(0);
        });
    });

    describe('verifyIntegrity', () => {
        it('should return valid for empty trail', () => {
            expect(trail.verifyIntegrity().valid).toBe(true);
        });

        it('should return valid for single event', () => {
            trail.log('a', 'b', 'c');
            expect(trail.verifyIntegrity().valid).toBe(true);
        });

        it('should return valid for properly chained events', () => {
            trail.log('a1', 'actor', 'r1');
            trail.log('a2', 'actor', 'r2');
            trail.log('a3', 'actor', 'r3');
            expect(trail.verifyIntegrity().valid).toBe(true);
        });

        it('should detect broken chain (tampered event)', () => {
            trail.log('a1', 'actor', 'r1');
            trail.log('a2', 'actor', 'r2');
            trail.log('a3', 'actor', 'r3');

            // Tamper with the second event's hash
            const recent = trail.getRecent();
            (recent[1] as any).hash = 'tampered';

            const result = trail.verifyIntegrity();
            expect(result.valid).toBe(false);
            expect(result.brokenAt).toBe(2);
        });
    });
});
