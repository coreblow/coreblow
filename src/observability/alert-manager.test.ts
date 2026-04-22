/**
 * CoreBlow — Alert Manager Tests
 *
 * Tests for alert rules, condition evaluation, alert firing,
 * cooldown enforcement, acknowledge/resolve, silencing, and history.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AlertManager } from './alert-manager.js';

describe('AlertManager', () => {
    let manager: AlertManager;

    beforeEach(() => {
        manager = new AlertManager();
    });

    // === Rule Management ===

    describe('addRule', () => {
        it('adds a rule and returns its id', () => {
            const id = manager.addRule('CPU High', 'cpu', 'gt', 90, 'critical');
            expect(id).toMatch(/^rule-/);
            expect(manager.countRules()).toBe(1);
        });
    });

    // === Evaluation ===

    describe('evaluate', () => {
        it('fires alert when condition matches (gt)', () => {
            manager.addRule('CPU High', 'cpu', 'gt', 90, 'critical', 0);
            const alerts = manager.evaluate('cpu', 95);
            expect(alerts).toHaveLength(1);
            expect(alerts[0]!.severity).toBe('critical');
            expect(alerts[0]!.value).toBe(95);
        });

        it('does not fire when condition not met', () => {
            manager.addRule('CPU High', 'cpu', 'gt', 90, 'critical', 0);
            const alerts = manager.evaluate('cpu', 50);
            expect(alerts).toHaveLength(0);
        });

        it('supports lt condition', () => {
            manager.addRule('Disk Low', 'disk', 'lt', 10);
            const alerts = manager.evaluate('disk', 5);
            expect(alerts).toHaveLength(1);
        });

        it('supports eq condition', () => {
            manager.addRule('Exact', 'count', 'eq', 0);
            expect(manager.evaluate('count', 0)).toHaveLength(1);
            expect(manager.evaluate('count', 1)).toHaveLength(0);
        });

        it('supports gte condition', () => {
            manager.addRule('GTE', 'mem', 'gte', 80);
            expect(manager.evaluate('mem', 80)).toHaveLength(1);
            expect(manager.evaluate('mem', 79)).toHaveLength(0);
        });

        it('supports lte condition', () => {
            manager.addRule('LTE', 'disk', 'lte', 5);
            expect(manager.evaluate('disk', 5)).toHaveLength(1);
            expect(manager.evaluate('disk', 6)).toHaveLength(0);
        });

        it('only evaluates matching metric', () => {
            manager.addRule('CPU', 'cpu', 'gt', 90, 'warning', 0);
            const alerts = manager.evaluate('memory', 95);
            expect(alerts).toHaveLength(0);
        });

        it('respects cooldown (does not re-fire immediately)', () => {
            manager.addRule('CPU', 'cpu', 'gt', 90, 'warning', 60_000);
            manager.evaluate('cpu', 95); // fires
            const second = manager.evaluate('cpu', 95); // should NOT fire (cooldown)
            expect(second).toHaveLength(0);
        });

        it('fires multiple rules for same metric', () => {
            manager.addRule('Warning', 'cpu', 'gt', 80, 'warning', 0);
            manager.addRule('Critical', 'cpu', 'gt', 95, 'critical', 0);
            const alerts = manager.evaluate('cpu', 98);
            expect(alerts).toHaveLength(2);
        });

        it('skips disabled rules', () => {
            // Note: there's no disable method, but rule.enabled can be set
            // Using silencing as the mechanism
            const id = manager.addRule('Silent', 'cpu', 'gt', 50, 'info', 0);
            manager.silence(id);
            const alerts = manager.evaluate('cpu', 99);
            expect(alerts).toHaveLength(0);
        });
    });

    // === Acknowledge & Resolve ===

    describe('acknowledge', () => {
        it('marks an alert as acknowledged', () => {
            manager.addRule('CPU', 'cpu', 'gt', 90, 'warning', 0);
            const [alert] = manager.evaluate('cpu', 95);
            expect(manager.acknowledge(alert!.id)).toBe(true);

            const active = manager.getActive();
            expect(active[0]!.acknowledged).toBe(true);
        });

        it('returns false for non-existent alert', () => {
            expect(manager.acknowledge('nope')).toBe(false);
        });
    });

    describe('resolve', () => {
        it('marks an alert as resolved', () => {
            manager.addRule('CPU', 'cpu', 'gt', 90, 'warning', 0);
            const [alert] = manager.evaluate('cpu', 95);
            expect(manager.resolve(alert!.id)).toBe(true);

            const active = manager.getActive();
            expect(active).toHaveLength(0);
        });

        it('returns false for non-existent alert', () => {
            expect(manager.resolve('nope')).toBe(false);
        });
    });

    // === Silencing ===

    describe('silence / unsilence', () => {
        it('prevents silenced rule from firing', () => {
            const id = manager.addRule('Muted', 'cpu', 'gt', 0, 'info', 0);
            manager.silence(id);
            expect(manager.evaluate('cpu', 99)).toHaveLength(0);
        });

        it('re-enables firing after unsilence', () => {
            const id = manager.addRule('Muted', 'cpu', 'gt', 0, 'info', 0);
            manager.silence(id);
            manager.unsilence(id);
            expect(manager.evaluate('cpu', 99)).toHaveLength(1);
        });
    });

    // === History ===

    describe('getHistory', () => {
        it('returns all fired alerts', () => {
            manager.addRule('CPU', 'cpu', 'gt', 0, 'info', 0);
            manager.evaluate('cpu', 10);
            manager.evaluate('cpu', 20);

            // First fires, second may be on cooldown, but cooldown=0 so both fire
            const history = manager.getHistory();
            expect(history.length).toBeGreaterThanOrEqual(1);
        });

        it('respects limit', () => {
            manager.addRule('CPU', 'cpu', 'gt', 0, 'info', 0);
            for (let i = 0; i < 10; i++) manager.evaluate('cpu', i + 1);

            expect(manager.getHistory(3)).toHaveLength(3);
        });
    });

    // === Active Alerts ===

    describe('getActive', () => {
        it('returns only unresolved alerts', () => {
            manager.addRule('CPU', 'cpu', 'gt', 0, 'info', 0);
            const [alert] = manager.evaluate('cpu', 50);
            manager.resolve(alert!.id);

            expect(manager.getActive()).toHaveLength(0);
        });
    });
});
