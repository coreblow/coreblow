/**
 * CoreBlow Security — AuditTrail Test Suite
 *
 * Covers: log(), query methods (getByActor, getByAction, getByResource),
 * getRecent(), hash-chain verifyIntegrity(), search(), count(),
 * buffer eviction, and SHA-256 based tamper detection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import { AuditTrail, type AuditEvent } from './audit-trail.js';

// Mock crypto to make hash values deterministic in tests
vi.mock('node:crypto', async () => {
    const actual = await vi.importActual<typeof crypto>('node:crypto');
    let callCount = 0;
    return {
        ...actual,
        createHash: vi.fn(() => {
            callCount++;
            const hash = actual.createHash('sha256');
            return hash;
        }),
    };
});

describe('AuditTrail', () => {
    let trail: AuditTrail;

    beforeEach(() => {
        trail = new AuditTrail();
        vi.clearAllMocks();
    });

    // ─── log() ──────────────────────────────────────────────────

    describe('log()', () => {
        it('creates an event with auto-generated id, hash, and previousHash', () => {
            const event = trail.log('login', 'admin', '/auth');

            expect(event.id).toBe('audit-1');
            expect(event.action).toBe('login');
            expect(event.actor).toBe('admin');
            expect(event.resource).toBe('/auth');
            expect(event.previousHash).toBe('0');
            expect(event.hash).toBeTruthy();
            expect(typeof event.hash).toBe('string');
            expect(event.hash.length).toBe(16); // SHA-256 sliced to 16 chars
            expect(event.timestamp).toBeGreaterThan(0);
        });

        it('increments id counter', () => {
            const e1 = trail.log('a', 'u', 'r');
            const e2 = trail.log('b', 'u', 'r');
            const e3 = trail.log('c', 'u', 'r');

            expect(e1.id).toBe('audit-1');
            expect(e2.id).toBe('audit-2');
            expect(e3.id).toBe('audit-3');
        });

        it('chains hashes — event N previousHash equals event N-1 hash', () => {
            const e1 = trail.log('a', 'u', 'r');
            const e2 = trail.log('b', 'u', 'r');
            const e3 = trail.log('c', 'u', 'r');

            expect(e2.previousHash).toBe(e1.hash);
            expect(e3.previousHash).toBe(e2.hash);
        });

        it('preserves optional details and ip', () => {
            const event = trail.log('access', 'user', '/api', { method: 'GET' }, '10.0.0.1');

            expect(event.details).toEqual({ method: 'GET' });
            expect(event.ip).toBe('10.0.0.1');
        });

        it('sets details and ip to undefined when omitted', () => {
            const event = trail.log('login', 'user', '/auth');

            expect(event.details).toBeUndefined();
            expect(event.ip).toBeUndefined();
        });

        it('evicts oldest events when exceeding maxEvents (10_000)', () => {
            (trail as any).maxEvents = 5;

            for (let i = 0; i < 8; i++) {
                trail.log(`action-${i}`, 'user', 'resource');
            }

            expect(trail.count()).toBe(5);
            const recent = trail.getRecent(10);
            expect(recent[0]!.action).toBe('action-3');
        });
    });

    // ─── getByActor() ───────────────────────────────────────────

    describe('getByActor()', () => {
        beforeEach(() => {
            trail.log('login', 'alice', '/auth');
            trail.log('query', 'bob', '/api');
            trail.log('logout', 'alice', '/auth');
            trail.log('delete', 'charlie', '/data');
        });

        it('returns events matching the actor', () => {
            const aliceEvents = trail.getByActor('alice');
            expect(aliceEvents.length).toBe(2);
            expect(aliceEvents.every(e => e.actor === 'alice')).toBe(true);
        });

        it('returns empty array for unknown actor', () => {
            expect(trail.getByActor('unknown')).toEqual([]);
        });

        it('respects limit parameter', () => {
            const limited = trail.getByActor('alice', 1);
            expect(limited.length).toBe(1);
            expect(limited[0]!.action).toBe('logout'); // Last one (slice from end)
        });

        it('defaults limit to 50', () => {
            // No error even when asking more than exists
            const all = trail.getByActor('alice');
            expect(all.length).toBeLessThanOrEqual(50);
        });
    });

    // ─── getByAction() ──────────────────────────────────────────

    describe('getByAction()', () => {
        beforeEach(() => {
            trail.log('login', 'a', 'r1');
            trail.log('login', 'b', 'r2');
            trail.log('logout', 'a', 'r1');
        });

        it('filters events by action', () => {
            const logins = trail.getByAction('login');
            expect(logins.length).toBe(2);
        });

        it('returns empty for non-existent action', () => {
            expect(trail.getByAction('delete')).toEqual([]);
        });

        it('respects limit', () => {
            expect(trail.getByAction('login', 1).length).toBe(1);
        });
    });

    // ─── getByResource() ────────────────────────────────────────

    describe('getByResource()', () => {
        beforeEach(() => {
            trail.log('read', 'a', '/api/users');
            trail.log('write', 'b', '/api/users');
            trail.log('delete', 'c', '/api/config');
        });

        it('filters events by resource', () => {
            const userEvents = trail.getByResource('/api/users');
            expect(userEvents.length).toBe(2);
        });

        it('returns empty for non-existent resource', () => {
            expect(trail.getByResource('/missing')).toEqual([]);
        });

        it('respects limit', () => {
            expect(trail.getByResource('/api/users', 1).length).toBe(1);
        });
    });

    // ─── getRecent() ────────────────────────────────────────────

    describe('getRecent()', () => {
        it('returns the most recent events', () => {
            trail.log('a', 'u', 'r');
            trail.log('b', 'u', 'r');
            trail.log('c', 'u', 'r');

            const recent = trail.getRecent(2);
            expect(recent.length).toBe(2);
            expect(recent[0]!.action).toBe('b');
            expect(recent[1]!.action).toBe('c');
        });

        it('defaults to 50 entries', () => {
            for (let i = 0; i < 60; i++) trail.log(`a${i}`, 'u', 'r');
            expect(trail.getRecent().length).toBe(50);
        });

        it('returns empty array for empty trail', () => {
            expect(trail.getRecent()).toEqual([]);
        });
    });

    // ─── verifyIntegrity() ──────────────────────────────────────

    describe('verifyIntegrity()', () => {
        it('returns valid for an untampered chain', () => {
            trail.log('a', 'u', 'r');
            trail.log('b', 'u', 'r');
            trail.log('c', 'u', 'r');

            expect(trail.verifyIntegrity()).toEqual({ valid: true });
        });

        it('returns valid for empty trail', () => {
            expect(trail.verifyIntegrity()).toEqual({ valid: true });
        });

        it('returns valid for single event', () => {
            trail.log('a', 'u', 'r');
            expect(trail.verifyIntegrity()).toEqual({ valid: true });
        });

        it('detects tampered hash chain', () => {
            trail.log('a', 'u', 'r');
            trail.log('b', 'u', 'r');
            trail.log('c', 'u', 'r');

            // Tamper with event[1].hash
            const events = (trail as any).events as AuditEvent[];
            events[1]!.hash = 'TAMPERED';

            const result = trail.verifyIntegrity();
            expect(result.valid).toBe(false);
            expect(result.brokenAt).toBe(2);
        });

        it('detects insertion — broken previousHash', () => {
            trail.log('a', 'u', 'r');
            trail.log('b', 'u', 'r');

            const events = (trail as any).events as AuditEvent[];
            // Insert a rogue event
            events.splice(1, 0, {
                id: 'rogue',
                action: 'steal',
                actor: 'evil',
                resource: '/secrets',
                timestamp: Date.now(),
                hash: 'fake',
                previousHash: 'fake',
            });

            const result = trail.verifyIntegrity();
            expect(result.valid).toBe(false);
        });
    });

    // ─── search() ───────────────────────────────────────────────

    describe('search()', () => {
        beforeEach(() => {
            trail.log('LOGIN', 'admin', '/auth/session');
            trail.log('query', 'admin', '/api/users');
            trail.log('delete', 'bot', '/api/data');
        });

        it('searches case-insensitively in action field', () => {
            const results = trail.search('login');
            expect(results.length).toBe(1);
            expect(results[0]!.action).toBe('LOGIN');
        });

        it('searches in actor field', () => {
            const results = trail.search('admin');
            expect(results.length).toBe(2);
        });

        it('searches in resource field', () => {
            const results = trail.search('/api');
            expect(results.length).toBe(2);
        });

        it('returns empty for no match', () => {
            expect(trail.search('nonexistent')).toEqual([]);
        });

        it('matches partial strings', () => {
            const results = trail.search('auth');
            expect(results.length).toBe(1);
        });
    });

    // ─── count() ────────────────────────────────────────────────

    describe('count()', () => {
        it('returns 0 for empty trail', () => {
            expect(trail.count()).toBe(0);
        });

        it('returns correct count after logging', () => {
            trail.log('a', 'u', 'r');
            trail.log('b', 'u', 'r');
            expect(trail.count()).toBe(2);
        });
    });
});
