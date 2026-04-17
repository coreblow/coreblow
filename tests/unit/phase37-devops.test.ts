/**
 * CoreBlow Phase 37 — Deployment & DevOps Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DeploymentManager } from '../../src/infra/deployment-manager.js';
import { HealthProbe } from '../../src/infra/health-probe.js';
import { ConfigHotReload } from '../../src/config/config-hot-reload.js';
import { BlueGreenDeployer } from '../../src/infra/blue-green-deployer.js';
import { RollbackManager } from '../../src/infra/rollback-manager.js';

// ================================================================
describe('DeploymentManager', () => {
    let dm: DeploymentManager;
    beforeEach(() => { dm = new DeploymentManager(); });

    it('should create deployments', () => {
        const dep = dm.create('v1.0.0', 'production', ['app.js']);
        expect(dep.status).toBe('pending');
    });

    it('should deploy lifecycle', () => {
        const dep = dm.create('v1.0.0', 'prod', []);
        dm.deploy(dep.id);
        expect(dm.get(dep.id)?.status).toBe('deploying');
        dm.markDeployed(dep.id);
        expect(dm.get(dep.id)?.status).toBe('deployed');
    });

    it('should mark failed', () => {
        const dep = dm.create('v1.0.0', 'prod', []);
        dm.deploy(dep.id);
        dm.markFailed(dep.id);
        expect(dm.get(dep.id)?.status).toBe('failed');
    });

    it('should get current for environment', () => {
        const dep = dm.create('v1.0.0', 'prod', []);
        dm.deploy(dep.id);
        dm.markDeployed(dep.id);
        expect(dm.getCurrent('prod')?.version).toBe('v1.0.0');
    });

    it('should get history', () => {
        dm.create('v1', 'prod', []);
        dm.create('v2', 'staging', []);
        expect(dm.getHistory('prod')).toHaveLength(1);
    });
});

// ================================================================
describe('HealthProbe', () => {
    let probe: HealthProbe;
    beforeEach(() => { probe = new HealthProbe(); });

    it('should register targets', () => {
        probe.register('db', async () => true);
        expect(probe.count()).toBe(1);
    });

    it('should probe healthy', async () => {
        probe.register('db', async () => true);
        const result = await probe.probe('db');
        expect(result.healthy).toBe(true);
        expect(probe.getTarget('db')?.status).toBe('healthy');
    });

    it('should detect unhealthy after threshold', async () => {
        probe.register('api', async () => false, 1000, 2);
        await probe.probe('api');
        await probe.probe('api');
        expect(probe.getTarget('api')?.status).toBe('unhealthy');
    });

    it('should probe all', async () => {
        probe.register('a', async () => true);
        probe.register('b', async () => true);
        const results = await probe.probeAll();
        expect(results).toHaveLength(2);
    });

    it('should get overall health', async () => {
        probe.register('a', async () => true);
        await probe.probeAll();
        expect(probe.getOverallHealth().healthy).toBe(true);
    });
});

// ================================================================
describe('ConfigHotReload', () => {
    let config: ConfigHotReload;
    beforeEach(() => { config = new ConfigHotReload({ port: 3000, debug: false }); });

    it('should get values', () => {
        expect(config.get('port')).toBe(3000);
    });

    it('should update values', () => {
        config.set('port', 8080);
        expect(config.get('port')).toBe(8080);
    });

    it('should notify listeners', () => {
        let notified = false;
        config.onChange(() => { notified = true; }, 'port');
        config.set('port', 9000);
        expect(notified).toBe(true);
    });

    it('should validate updates', () => {
        config.setValidator((c) => (c.port as number) > 0);
        expect(config.set('port', -1).success).toBe(false);
    });

    it('should rollback', () => {
        config.set('port', 8080);
        config.rollback();
        expect(config.get('port')).toBe(3000);
    });

    it('should bulk update', () => {
        config.setMany({ port: 4000, debug: true });
        expect(config.get('port')).toBe(4000);
        expect(config.get('debug')).toBe(true);
    });
});

// ================================================================
describe('BlueGreenDeployer', () => {
    let bg: BlueGreenDeployer;
    beforeEach(() => { bg = new BlueGreenDeployer(); });

    it('should deploy to standby', async () => {
        const result = await bg.deploy('v1.0');
        expect(result.success).toBe(true);
        expect(result.slot).toBe('green'); // blue is active, deploy to green
    });

    it('should switch traffic', async () => {
        await bg.deploy('v1.0');
        const result = bg.switchTraffic();
        expect(result.success).toBe(true);
        expect(result.activeSlot).toBe('green');
    });

    it('should rollback', async () => {
        await bg.deploy('v1.0');
        bg.switchTraffic();
        await bg.deploy('v2.0');
        bg.switchTraffic();
        bg.rollback();
        expect(bg.getStatus().activeSlot).toBe('green');
    });

    it('should set canary', () => {
        bg.setCanary(20);
        expect(bg.getStatus().canaryPercent).toBe(20);
    });

    it('should track history', async () => {
        await bg.deploy('v1.0');
        bg.switchTraffic();
        expect(bg.getHistory()).toHaveLength(1);
    });
});

// ================================================================
describe('RollbackManager', () => {
    let rm: RollbackManager;
    beforeEach(() => { rm = new RollbackManager(); });

    it('should create points', () => {
        rm.create('deployment', 'v1.0', { version: '1.0' });
        expect(rm.count()).toBe(1);
    });

    it('should rollback to point', () => {
        const point = rm.create('config', 'before change', { port: 3000 });
        const result = rm.rollback(point.id, 'bug');
        expect(result.success).toBe(true);
        expect(result.state?.port).toBe(3000);
    });

    it('should rollback to latest of type', () => {
        rm.create('deployment', 'v1', { v: '1' });
        rm.create('deployment', 'v2', { v: '2' });
        const result = rm.rollbackLatest('deployment');
        expect(result.success).toBe(true);
        expect(result.state).toBeTruthy();
    });

    it('should list by type', () => {
        rm.create('deployment', 'a', {});
        rm.create('config', 'b', {});
        expect(rm.listByType('deployment')).toHaveLength(1);
    });

    it('should track history', () => {
        const p = rm.create('config', 'x', {});
        rm.rollback(p.id);
        expect(rm.getHistory()).toHaveLength(1);
    });

    it('should track storage size', () => {
        rm.create('custom', 'big', { data: 'x'.repeat(100) });
        expect(rm.getTotalSize()).toBeGreaterThan(0);
    });
});
