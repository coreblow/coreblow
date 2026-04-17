/**
 * CoreBlow — Audit Logger Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogger } from './audit-logger.js';

describe('AuditLogger', () => {
    let logger: AuditLogger;

    beforeEach(() => {
        logger = new AuditLogger();
    });

    describe('log', () => {
        it('should log an event with auto-generated ID and timestamp', () => {
            const e = logger.log({ category: 'auth', severity: 'info', action: 'login', actor: 'admin', success: true });
            expect(e.id).toMatch(/^audit-\d+$/);
            expect(e.timestamp).toBeDefined();
            expect(e.category).toBe('auth');
            expect(e.action).toBe('login');
            expect(e.success).toBe(true);
        });

        it('should chain prevHash across events', () => {
            const e1 = logger.log({ category: 'auth', severity: 'info', action: 'a1', success: true });
            const e2 = logger.log({ category: 'auth', severity: 'info', action: 'a2', success: true });
            expect(e1.prevHash).toBe('0');
            expect(e2.prevHash).not.toBe('0');
        });

        it('should forward to sink if set', () => {
            const sink = vi.fn();
            logger.setSink(sink);
            logger.log({ category: 'auth', severity: 'info', action: 'test', success: true });
            expect(sink).toHaveBeenCalledOnce();
        });

        it('should not throw if sink throws', () => {
            logger.setSink(() => { throw new Error('sink error'); });
            expect(() => {
                logger.log({ category: 'auth', severity: 'info', action: 'test', success: true });
            }).not.toThrow();
        });
    });

    describe('convenience methods', () => {
        it('authSuccess should log auth/info/login', () => {
            const e = logger.authSuccess('admin');
            expect(e.category).toBe('auth');
            expect(e.severity).toBe('info');
            expect(e.action).toBe('login');
            expect(e.success).toBe(true);
        });

        it('authFailure should log auth/warning/login-failed', () => {
            const e = logger.authFailure('hacker', '1.2.3.4');
            expect(e.category).toBe('auth');
            expect(e.severity).toBe('warning');
            expect(e.success).toBe(false);
            expect(e.ip).toBe('1.2.3.4');
        });

        it('accessDenied should log access/warning', () => {
            const e = logger.accessDenied('user', '/admin');
            expect(e.category).toBe('access');
            expect(e.success).toBe(false);
            expect(e.target).toBe('/admin');
        });

        it('configChange should log config/info', () => {
            const e = logger.configChange('admin', 'theme');
            expect(e.category).toBe('config');
            expect(e.success).toBe(true);
        });

        it('commandExecuted should log command/info', () => {
            const e = logger.commandExecuted('user', 'ls', true);
            expect(e.category).toBe('command');
            expect(e.action).toBe('ls');
        });

        it('pluginInstalled should log plugin/info', () => {
            const e = logger.pluginInstalled('my-plugin', 'admin');
            expect(e.category).toBe('plugin');
            expect(e.target).toBe('my-plugin');
        });

        it('criticalEvent should log system/critical', () => {
            const e = logger.criticalEvent('security-breach');
            expect(e.category).toBe('system');
            expect(e.severity).toBe('critical');
        });
    });

    describe('query', () => {
        beforeEach(() => {
            logger.authSuccess('admin');
            logger.authFailure('hacker');
            logger.accessDenied('user', '/secret');
            logger.configChange('admin', 'theme');
        });

        it('should filter by category', () => {
            expect(logger.query({ category: 'auth' })).toHaveLength(2);
        });

        it('should filter by severity', () => {
            expect(logger.query({ severity: 'warning' })).toHaveLength(2);
        });

        it('should filter by actor', () => {
            expect(logger.query({ actor: 'admin' })).toHaveLength(2);
        });

        it('should filter by success', () => {
            expect(logger.query({ success: false })).toHaveLength(2);
        });

        it('should respect limit', () => {
            expect(logger.query({ limit: 2 })).toHaveLength(2);
        });

        it('should return all with no filters', () => {
            expect(logger.query()).toHaveLength(4);
        });
    });

    describe('getCounts', () => {
        it('should count events by category', () => {
            logger.authSuccess('a');
            logger.authFailure('b');
            logger.configChange('a', 'x');
            const counts = logger.getCounts();
            expect(counts.auth).toBe(2);
            expect(counts.config).toBe(1);
        });
    });

    describe('verifyIntegrity', () => {
        it('should return valid for proper chain', () => {
            logger.authSuccess('a');
            logger.authFailure('b');
            logger.configChange('a', 'x');
            expect(logger.verifyIntegrity().valid).toBe(true);
        });

        it('should return valid for empty log', () => {
            expect(logger.verifyIntegrity().valid).toBe(true);
        });

        it('should detect tampering', () => {
            logger.authSuccess('a');
            logger.authFailure('b');
            logger.configChange('a', 'x');
            const events = logger.query();
            (events[1] as any).prevHash = 'tampered';
            expect(logger.verifyIntegrity().valid).toBe(false);
            expect(logger.verifyIntegrity().brokenAt).toBe(1);
        });
    });
});
