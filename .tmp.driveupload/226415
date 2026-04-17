/**
 * CoreBlow Phase 34 — Monitoring & Alerting Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AlertManager } from '../../src/observability/alert-manager.js';
import { MetricAggregator } from '../../src/observability/metric-aggregator.js';
import { LogShipper } from '../../src/observability/log-shipper.js';
import { DashboardWidgets } from '../../src/observability/dashboard-widgets.js';
import { IncidentTracker } from '../../src/observability/incident-tracker.js';

// ================================================================
describe('AlertManager', () => {
    let am: AlertManager;
    beforeEach(() => { am = new AlertManager(); });

    it('should add rules', () => {
        am.addRule('High CPU', 'cpu', 'gt', 90, 'critical');
        expect(am.countRules()).toBe(1);
    });

    it('should fire alerts', () => {
        am.addRule('High CPU', 'cpu', 'gt', 90);
        const fired = am.evaluate('cpu', 95);
        expect(fired).toHaveLength(1);
        expect(fired[0]?.severity).toBe('warning');
    });

    it('should not fire when below threshold', () => {
        am.addRule('High CPU', 'cpu', 'gt', 90);
        expect(am.evaluate('cpu', 50)).toHaveLength(0);
    });

    it('should acknowledge alerts', () => {
        am.addRule('Test', 'mem', 'gt', 80);
        const [alert] = am.evaluate('mem', 90);
        am.acknowledge(alert!.id);
        expect(am.getActive()[0]?.acknowledged).toBe(true);
    });

    it('should resolve alerts', () => {
        am.addRule('Test', 'disk', 'gt', 90);
        const [alert] = am.evaluate('disk', 95);
        am.resolve(alert!.id);
        expect(am.getActive()).toHaveLength(0);
    });

    it('should silence rules', () => {
        const ruleId = am.addRule('Test', 'cpu', 'gt', 50);
        am.silence(ruleId);
        expect(am.evaluate('cpu', 99)).toHaveLength(0);
    });
});

// ================================================================
describe('MetricAggregator', () => {
    let agg: MetricAggregator;
    beforeEach(() => { agg = new MetricAggregator(); });

    it('should record metrics', () => {
        agg.record('latency', 100);
        expect(agg.count()).toBe(1);
    });

    it('should aggregate', () => {
        agg.record('latency', 100);
        agg.record('latency', 200);
        agg.record('latency', 300);
        const result = agg.aggregate('latency', 60_000);
        expect(result.avg).toBe(200);
        expect(result.min).toBe(100);
        expect(result.max).toBe(300);
    });

    it('should calculate rate', () => {
        for (let i = 0; i < 10; i++) agg.record('requests', 1);
        const rate = agg.rate('requests', 60_000);
        expect(rate).toBeGreaterThan(0);
    });

    it('should list metric names', () => {
        agg.record('cpu', 50);
        agg.record('mem', 70);
        expect(agg.listMetrics()).toContain('cpu');
    });

    it('should filter by tags', () => {
        agg.record('req', 1, { host: 'a' });
        agg.record('req', 1, { host: 'b' });
        expect(agg.filterByTag('req', 'host', 'a')).toHaveLength(1);
    });
});

// ================================================================
describe('LogShipper', () => {
    let shipper: LogShipper;
    let shipped: unknown[];
    beforeEach(() => {
        shipper = new LogShipper();
        shipped = [];
        shipper.addDestination('test', async (entries) => { shipped.push(...entries); });
    });

    it('should buffer logs', () => {
        shipper.info('hello');
        expect(shipper.getBufferSize()).toBe(1);
    });

    it('should flush to destinations', async () => {
        shipper.info('msg1');
        shipper.error('msg2');
        const count = await shipper.flush();
        expect(count).toBe(2);
        expect(shipped).toHaveLength(2);
    });

    it('should filter by level', async () => {
        shipper.addDestination('errors-only', async (entries) => { shipped.push(...entries); }, 'error');
        shipper.debug('skip');
        shipper.info('skip');
        await shipper.flush();
        // 'test' dest gets both (minLevel info), 'errors-only' gets none
        expect(shipped).toHaveLength(1); // only info from 'test', debug filtered
    });

    it('should track ship count', async () => {
        shipper.info('a');
        await shipper.flush();
        expect(shipper.getShipCount()).toBe(1);
    });

    it('should list destinations', () => {
        expect(shipper.list()).toHaveLength(1);
    });
});

// ================================================================
describe('DashboardWidgets', () => {
    let dw: DashboardWidgets;
    beforeEach(() => { dw = new DashboardWidgets(); });

    it('should create dashboards', () => {
        dw.createDashboard('Main');
        expect(dw.count()).toBe(1);
    });

    it('should add widgets', () => {
        const dash = dw.createDashboard('Main');
        dw.addWidget(dash.id, 'counter', 'Requests', 1000, { row: 0, col: 0, width: 4, height: 2 });
        expect(dw.getDashboard(dash.id)?.widgets).toHaveLength(1);
    });

    it('should update widget data', () => {
        const dash = dw.createDashboard('Main');
        const widget = dw.addWidget(dash.id, 'counter', 'CPU', 50, { row: 0, col: 0, width: 4, height: 2 });
        dw.updateWidget(dash.id, widget!.id, 75);
        expect(dw.getDashboard(dash.id)?.widgets[0]?.data).toBe(75);
    });

    it('should remove widgets', () => {
        const dash = dw.createDashboard('Main');
        const widget = dw.addWidget(dash.id, 'text', 'Info', 'Hello', { row: 0, col: 0, width: 4, height: 1 });
        dw.removeWidget(dash.id, widget!.id);
        expect(dw.getDashboard(dash.id)?.widgets).toHaveLength(0);
    });

    it('should list dashboards', () => {
        dw.createDashboard('A');
        dw.createDashboard('B');
        expect(dw.list()).toHaveLength(2);
    });
});

// ================================================================
describe('IncidentTracker', () => {
    let tracker: IncidentTracker;
    beforeEach(() => { tracker = new IncidentTracker(); });

    it('should create incidents', () => {
        tracker.create('API Down', 'sev1', 'API returning 500');
        expect(tracker.count()).toBe(1);
    });

    it('should update status', () => {
        const inc = tracker.create('Slow queries', 'sev2', 'DB latency high');
        tracker.updateStatus(inc.id, 'investigating');
        expect(tracker.get(inc.id)?.status).toBe('investigating');
    });

    it('should assign', () => {
        const inc = tracker.create('Bug', 'sev3', 'Bug found');
        tracker.assign(inc.id, 'alice');
        expect(tracker.get(inc.id)?.assignee).toBe('alice');
    });

    it('should track timeline', () => {
        const inc = tracker.create('Issue', 'sev2', 'Something');
        tracker.addTimelineEntry(inc.id, 'Root cause found');
        expect(tracker.get(inc.id)?.timeline).toHaveLength(2);
    });

    it('should add postmortem', () => {
        const inc = tracker.create('Outage', 'sev1', 'Full outage');
        tracker.addPostmortem(inc.id, 'Root cause: deployment failure');
        expect(tracker.get(inc.id)?.postmortem).toContain('deployment');
    });

    it('should get active', () => {
        const inc = tracker.create('A', 'sev3', 'A');
        tracker.create('B', 'sev3', 'B');
        tracker.updateStatus(inc.id, 'resolved');
        expect(tracker.getActive()).toHaveLength(1);
    });

    it('should calculate MTTR', () => {
        const inc = tracker.create('Fast', 'sev3', 'Quick fix');
        tracker.updateStatus(inc.id, 'resolved');
        expect(tracker.getMTTR()).toBeGreaterThanOrEqual(0);
    });
});
