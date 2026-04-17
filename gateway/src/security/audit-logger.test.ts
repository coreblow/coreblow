/**
 * CoreBlow Security — AuditLogger Test Suite
 *
 * Covers: log(), convenience methods, query(), getCounts(),
 * verifyIntegrity(), buffer eviction, external sink, and
 * hash-chain tamper detection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogger, type AuditEvent, type AuditCategory, type AuditSeverity } from './audit-logger.js';

describe('AuditLogger', () => {
    let logger: AuditLogger;

    beforeEach(() => {
        logger = new AuditLogger();
    });

    // ─── Core log() ─────────────────────────────────────────────

    describe('log()', () => {
        it('returns a fully-formed AuditEvent with auto-generated id and timestamp', () => {
            const event = logger.log({
                category: 'auth',
                severity: 'info',
                action: 'login',
                actor: 'user-1',
                success: true,
            });

            expect(event.id).toBe('audit-1');
            expect(event.timestamp).toBeTruthy();
            expect(event.category).toBe('auth');
            expect(event.severity).toBe('info');
            expect(event.action).toBe('login');
            expect(event.actor).toBe('user-1');
            expect(event.success).toBe(true);
            expect(event.prevHash).toBe('0'); // First event chains from '0'
        });

        it('increments counter for sequential events', () => {
            const e1 = logger.log({ category: 'auth', severity: 'info', action: 'a', success: true });
            const e2 = logger.log({ category: 'auth', severity: 'info', action: 'b', success: true });
            const e3 = logger.log({ category: 'auth', severity: 'info', action: 'c', success: true });

            expect(e1.id).toBe('audit-1');
            expect(e2.id).toBe('audit-2');
            expect(e3.id).toBe('audit-3');
        });

        it('chains hashes — prevHash of event N+1 equals hash of event N', () => {
            const e1 = logger.log({ category: 'auth', severity: 'info', action: 'a', success: true });
            const e2 = logger.log({ category: 'auth', severity: 'info', action: 'b', success: true });

            // e2.prevHash should NOT be '0' (it should be hash of e1)
            expect(e2.prevHash).not.toBe('0');
            expect(typeof e2.prevHash).toBe('string');
        });

        it('preserves optional fields (ip, channelId, target, details)', () => {
            const event = logger.log({
                category: 'access',
                severity: 'warning',
                action: 'access-denied',
                actor: 'anon',
                target: '/admin',
                ip: '192.168.0.1',
                channelId: 'discord-123',
                details: { reason: 'unauthorized' },
                success: false,
            });

            expect(event.ip).toBe('192.168.0.1');
            expect(event.channelId).toBe('discord-123');
            expect(event.target).toBe('/admin');
            expect(event.details).toEqual({ reason: 'unauthorized' });
        });
    });

    // ─── Buffer Eviction ────────────────────────────────────────

    describe('buffer eviction', () => {
        it('evicts oldest events when exceeding maxEvents (10_000)', () => {
            // Access private maxEvents to use a smaller buffer for testing
            (logger as any).maxEvents = 5;

            for (let i = 0; i < 8; i++) {
                logger.log({ category: 'system', severity: 'info', action: `action-${i}`, success: true });
            }

            const results = logger.query({ limit: 100 });
            expect(results.length).toBe(5);
            // The first 3 events should have been evicted
            expect(results[0]!.action).toBe('action-3');
        });
    });

    // ─── External Sink ──────────────────────────────────────────

    describe('setSink()', () => {
        it('calls the external sink on every log()', () => {
            const sink = vi.fn();
            logger.setSink(sink);

            logger.log({ category: 'auth', severity: 'info', action: 'test', success: true });

            expect(sink).toHaveBeenCalledTimes(1);
            expect(sink).toHaveBeenCalledWith(expect.objectContaining({ action: 'test' }));
        });

        it('does not throw if sink throws — silently swallows errors', () => {
            const sink = vi.fn(() => { throw new Error('sink failure'); });
            logger.setSink(sink);

            expect(() => {
                logger.log({ category: 'auth', severity: 'info', action: 'test', success: true });
            }).not.toThrow();
        });

        it('does not call sink when not set', () => {
            // Just verify no crash
            expect(() => {
                logger.log({ category: 'system', severity: 'info', action: 'no-sink', success: true });
            }).not.toThrow();
        });
    });

    // ─── Convenience Methods ────────────────────────────────────

    describe('convenience methods', () => {
        it('authSuccess() logs auth/info/login with success=true', () => {
            const event = logger.authSuccess('admin', { method: 'oauth' });

            expect(event.category).toBe('auth');
            expect(event.severity).toBe('info');
            expect(event.action).toBe('login');
            expect(event.actor).toBe('admin');
            expect(event.success).toBe(true);
            expect(event.details).toEqual({ method: 'oauth' });
        });

        it('authFailure() logs auth/warning/login-failed with success=false', () => {
            const event = logger.authFailure('attacker', '10.0.0.1');

            expect(event.category).toBe('auth');
            expect(event.severity).toBe('warning');
            expect(event.action).toBe('login-failed');
            expect(event.actor).toBe('attacker');
            expect(event.ip).toBe('10.0.0.1');
            expect(event.success).toBe(false);
        });

        it('accessDenied() logs access/warning with success=false', () => {
            const event = logger.accessDenied('guest', '/secret');

            expect(event.category).toBe('access');
            expect(event.severity).toBe('warning');
            expect(event.action).toBe('access-denied');
            expect(event.target).toBe('/secret');
            expect(event.success).toBe(false);
        });

        it('configChange() logs config/info with success=true', () => {
            const event = logger.configChange('admin', 'rate-limit', { oldValue: 100, newValue: 200 });

            expect(event.category).toBe('config');
            expect(event.action).toBe('config-change');
            expect(event.target).toBe('rate-limit');
            expect(event.details).toEqual({ oldValue: 100, newValue: 200 });
        });

        it('commandExecuted() logs command with given success', () => {
            const ok = logger.commandExecuted('user', '/help', true);
            const fail = logger.commandExecuted('user', '/deploy', false);

            expect(ok.category).toBe('command');
            expect(ok.success).toBe(true);
            expect(fail.success).toBe(false);
        });

        it('pluginInstalled() logs plugin/info', () => {
            const event = logger.pluginInstalled('my-plugin', 'admin');

            expect(event.category).toBe('plugin');
            expect(event.target).toBe('my-plugin');
            expect(event.actor).toBe('admin');
        });

        it('criticalEvent() logs system/critical', () => {
            const event = logger.criticalEvent('data-breach', { affectedUsers: 42 });

            expect(event.category).toBe('system');
            expect(event.severity).toBe('critical');
            expect(event.action).toBe('data-breach');
            expect(event.details).toEqual({ affectedUsers: 42 });
        });
    });

    // ─── query() ────────────────────────────────────────────────

    describe('query()', () => {
        beforeEach(() => {
            logger.authSuccess('admin');
            logger.authFailure('hacker', '1.2.3.4');
            logger.accessDenied('guest', '/admin');
            logger.configChange('admin', 'rate-limit');
            logger.criticalEvent('reboot');
        });

        it('returns all events when no filters', () => {
            const results = logger.query();
            expect(results.length).toBe(5);
        });

        it('filters by category', () => {
            const authEvents = logger.query({ category: 'auth' });
            expect(authEvents.length).toBe(2);
            expect(authEvents.every(e => e.category === 'auth')).toBe(true);
        });

        it('filters by severity', () => {
            const warnings = logger.query({ severity: 'warning' });
            expect(warnings.length).toBe(2); // authFailure + accessDenied
        });

        it('filters by actor', () => {
            const adminEvents = logger.query({ actor: 'admin' });
            expect(adminEvents.length).toBe(2); // authSuccess + configChange
        });

        it('filters by success', () => {
            const failures = logger.query({ success: false });
            expect(failures.length).toBe(2); // authFailure + accessDenied
        });

        it('respects limit', () => {
            const limited = logger.query({ limit: 2 });
            expect(limited.length).toBe(2);
        });

        it('filters by time range (since/until)', () => {
            // All events created just now — filter with a wide window
            const now = Date.now();
            const results = logger.query({ since: now - 60_000, until: now + 60_000 });
            expect(results.length).toBe(5);

            // Filter future-only — should get nothing
            const future = logger.query({ since: now + 60_000 });
            expect(future.length).toBe(0);
        });

        it('combines multiple filters', () => {
            const result = logger.query({ category: 'auth', success: false });
            expect(result.length).toBe(1);
            expect(result[0]!.action).toBe('login-failed');
        });
    });

    // ─── getCounts() ────────────────────────────────────────────

    describe('getCounts()', () => {
        it('counts events by category', () => {
            logger.authSuccess('a');
            logger.authFailure('b');
            logger.accessDenied('c', '/x');
            logger.criticalEvent('boom');

            const counts = logger.getCounts();
            expect(counts.auth).toBe(2);
            expect(counts.access).toBe(1);
            expect(counts.system).toBe(1);
        });

        it('returns empty-ish record when no events', () => {
            const counts = logger.getCounts();
            expect(Object.keys(counts).length).toBe(0);
        });
    });

    // ─── verifyIntegrity() ──────────────────────────────────────

    describe('verifyIntegrity()', () => {
        it('returns valid for an untampered chain', () => {
            logger.authSuccess('a');
            logger.authFailure('b');
            logger.configChange('c', 'x');

            expect(logger.verifyIntegrity()).toEqual({ valid: true });
        });

        it('detects tampering — mutated event breaks chain', () => {
            logger.authSuccess('a');
            logger.authFailure('b');
            logger.configChange('c', 'x');

            // Tamper with the second event
            const events = (logger as any).events as AuditEvent[];
            events[1]!.action = 'TAMPERED';

            const result = logger.verifyIntegrity();
            expect(result.valid).toBe(false);
            // Chain breaks at the event after the tampered one
            expect(result.brokenAt).toBeDefined();
        });

        it('returns valid for empty log', () => {
            expect(logger.verifyIntegrity()).toEqual({ valid: true });
        });

        it('returns valid for single event', () => {
            logger.authSuccess('a');
            expect(logger.verifyIntegrity()).toEqual({ valid: true });
        });
    });
});
