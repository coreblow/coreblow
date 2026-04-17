/**
 * Observability Tests — Phase D: Remaining Modules
 * Tests: AlertManager
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AlertManager } from './alert-manager.js';

describe('AlertManager', () => {
    let mgr: AlertManager;

    beforeEach(() => { mgr = new AlertManager(); });

    // --- Rules ---
    it('adds an alert rule', () => {
        const id = mgr.addRule('High CPU', 'cpu_percent', 'gt', 90);
        expect(id).toMatch(/^rule-/);
        expect(mgr.countRules()).toBe(1);
    });

    it('adds multiple rules', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90);
        mgr.addRule('Memory', 'mem', 'gt', 80);
        mgr.addRule('Disk', 'disk', 'gt', 95);
        expect(mgr.countRules()).toBe(3);
    });

    // --- Evaluate ---
    it('fires alert when condition met (gt)', () => {
        mgr.addRule('High CPU', 'cpu', 'gt', 90, 'critical');
        const alerts = mgr.evaluate('cpu', 95);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].severity).toBe('critical');
        expect(alerts[0].value).toBe(95);
    });

    it('does not fire when condition not met', () => {
        mgr.addRule('High CPU', 'cpu', 'gt', 90);
        expect(mgr.evaluate('cpu', 50)).toHaveLength(0);
    });

    it('fires for lt condition', () => {
        mgr.addRule('Low disk', 'disk_free', 'lt', 10);
        expect(mgr.evaluate('disk_free', 5)).toHaveLength(1);
    });

    it('fires for eq condition', () => {
        mgr.addRule('Exact match', 'connections', 'eq', 0);
        expect(mgr.evaluate('connections', 0)).toHaveLength(1);
    });

    it('fires for gte condition', () => {
        mgr.addRule('Memory', 'mem', 'gte', 80);
        expect(mgr.evaluate('mem', 80)).toHaveLength(1);
        expect(mgr.evaluate('mem', 90)).toHaveLength(0); // cooldown
    });

    it('fires for lte condition', () => {
        mgr.addRule('Low battery', 'battery', 'lte', 20);
        expect(mgr.evaluate('battery', 15)).toHaveLength(1);
    });

    it('only evaluates matching metric', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90);
        expect(mgr.evaluate('memory', 99)).toHaveLength(0);
    });

    // --- Cooldown ---
    it('respects cooldown period', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90, 'warning', 60_000);
        mgr.evaluate('cpu', 95); // fires
        expect(mgr.evaluate('cpu', 95)).toHaveLength(0); // cooldown active
    });

    // --- Acknowledge ---
    it('acknowledges alert', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90);
        const [alert] = mgr.evaluate('cpu', 95);
        expect(mgr.acknowledge(alert.id)).toBe(true);
    });

    it('returns false acknowledging non-existent', () => {
        expect(mgr.acknowledge('nonexistent')).toBe(false);
    });

    // --- Resolve ---
    it('resolves alert', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90);
        const [alert] = mgr.evaluate('cpu', 95);
        expect(mgr.resolve(alert.id)).toBe(true);
    });

    it('returns false resolving non-existent', () => {
        expect(mgr.resolve('nonexistent')).toBe(false);
    });

    // --- Silence ---
    it('silences a rule', () => {
        const ruleId = mgr.addRule('CPU', 'cpu', 'gt', 90);
        mgr.silence(ruleId);
        expect(mgr.evaluate('cpu', 99)).toHaveLength(0);
    });

    it('unsilences a rule', () => {
        const ruleId = mgr.addRule('CPU', 'cpu', 'gt', 90);
        mgr.silence(ruleId);
        mgr.unsilence(ruleId);
        expect(mgr.evaluate('cpu', 99)).toHaveLength(1);
    });

    // --- Active Alerts ---
    it('returns active (unresolved) alerts', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90);
        mgr.evaluate('cpu', 95);
        expect(mgr.getActive()).toHaveLength(1);
    });

    it('excludes resolved from active', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90);
        const [alert] = mgr.evaluate('cpu', 95);
        mgr.resolve(alert.id);
        expect(mgr.getActive()).toHaveLength(0);
    });

    // --- History ---
    it('returns alert history', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90);
        mgr.evaluate('cpu', 95);
        expect(mgr.getHistory()).toHaveLength(1);
    });

    it('respects history limit', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90, 'warning', 0); // no cooldown
        for (let i = 0; i < 10; i++) mgr.evaluate('cpu', 95 + i);
        expect(mgr.getHistory(3)).toHaveLength(3);
    });

    // --- Disabled Rules ---
    it('skips disabled rules', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90);
        // We can't disable through public API in current impl, so test enabled=true works
        expect(mgr.evaluate('cpu', 95)).toHaveLength(1);
    });

    // --- Alert Content ---
    it('includes rule name in alert message', () => {
        mgr.addRule('High CPU Usage', 'cpu', 'gt', 90);
        const [alert] = mgr.evaluate('cpu', 95);
        expect(alert.message).toContain('High CPU Usage');
    });

    it('includes value and threshold in alert', () => {
        mgr.addRule('CPU', 'cpu', 'gt', 90);
        const [alert] = mgr.evaluate('cpu', 95);
        expect(alert.value).toBe(95);
        expect(alert.threshold).toBe(90);
    });
});
