// @ts-nocheck
/**
 * Phase 27: DevOps & Reliability Test Suite
 *
 * Covers: BackupManager, BlueGreenDeployer, DeploymentManager,
 *         RollbackManager, MigrationSystem, HealthProbe
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { BackupManager } from './backup-manager.js';
import { BlueGreenDeployer } from './blue-green-deployer.js';
import { DeploymentManager } from './deployment-manager.js';
import { RollbackManager } from './rollback-manager.js';
import { MigrationSystem } from './migration-system.js';
import { HealthProbe } from './health-probe.js';

describe('DevOps & Reliability Suite', () => {

    // ═══════════════════════════════════════
    // BackupManager
    // ═══════════════════════════════════════
    describe('BackupManager', () => {
        let bm: BackupManager;
        beforeEach(() => { bm = new BackupManager(); });

        it('creates and retrieves a backup', () => {
            const backup = bm.create('daily', 'config', { theme: 'dark', lang: 'id' });
            expect(backup.id).toMatch(/^bk-/);
            expect(backup.name).toBe('daily');
            expect(backup.type).toBe('config');
            expect(backup.size).toBeGreaterThan(0);

            const retrieved = bm.get(backup.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.data.theme).toBe('dark');
        });

        it('restores from a backup', () => {
            const backup = bm.create('snap', 'full', { users: [1, 2, 3], settings: { a: 1 } });
            const result = bm.restore(backup.id);
            expect(result.success).toBe(true);
            expect(result.restoredKeys).toContain('users');
            expect(result.restoredKeys).toContain('settings');
        });

        it('restore fails for nonexistent backup', () => {
            const result = bm.restore('bk-999');
            expect(result.success).toBe(false);
            expect(result.restoredKeys).toHaveLength(0);
        });

        it('lists backups filtered by type', () => {
            bm.create('b1', 'config', {});
            bm.create('b2', 'conversations', {});
            bm.create('b3', 'config', {});

            expect(bm.list('config')).toHaveLength(2);
            expect(bm.list('conversations')).toHaveLength(1);
            expect(bm.list()).toHaveLength(3);
        });

        it('tracks total size across backups', () => {
            bm.create('a', 'config', { x: 'hello' });
            bm.create('b', 'config', { y: 'world' });
            expect(bm.getTotalSize()).toBeGreaterThan(0);
            expect(bm.count()).toBe(2);
        });
    });

    // ═══════════════════════════════════════
    // BlueGreenDeployer
    // ═══════════════════════════════════════
    describe('BlueGreenDeployer', () => {
        let bg: BlueGreenDeployer;
        beforeEach(() => { bg = new BlueGreenDeployer(); });

        it('deploys to standby slot', async () => {
            const result = await bg.deploy('v1.0.0');
            expect(result.success).toBe(true);
            expect(result.slot).toBe('green'); // blue is active by default, so deploy goes to green
        });

        it('switches traffic from active to standby', async () => {
            await bg.deploy('v2.0.0');
            const switchResult = bg.switchTraffic();
            expect(switchResult.success).toBe(true);
            expect(switchResult.activeSlot).toBe('green');

            const status = bg.getStatus();
            expect(status.activeSlot).toBe('green');
        });

        it('routes canary traffic to standby percentage', async () => {
            await bg.deploy('v2.0.0');
            bg.setCanary(50);

            // Run 100 routes — should see a mix
            let canaryCount = 0;
            for (let i = 0; i < 100; i++) {
                if (bg.routeRequest() === 'green') canaryCount++;
            }
            expect(canaryCount).toBeGreaterThan(10);   // statistically should be ~50
            expect(canaryCount).toBeLessThan(90);
        });

        it('rollback switches traffic back', async () => {
            // Deploy v1 to green (standby)
            await bg.deploy('v1.0.0');
            bg.switchTraffic(); // blue → green (green is now active)
            expect(bg.getStatus().activeSlot).toBe('green');

            // Deploy v2 to blue (now standby) so rollback has a version to switch to
            await bg.deploy('v2.0.0');

            bg.rollback(); // green → blue
            expect(bg.getStatus().activeSlot).toBe('blue');
            expect(bg.getHistory()).toHaveLength(2); // 2 switches tracked
        });

        it('health check gates deployment', async () => {
            bg.setHealthCheck('green', async () => false); // unhealthy
            const result = await bg.deploy('v3.0.0');
            expect(result.success).toBe(false);
        });
    });

    // ═══════════════════════════════════════
    // DeploymentManager
    // ═══════════════════════════════════════
    describe('DeploymentManager', () => {
        let dm: DeploymentManager;
        beforeEach(() => { dm = new DeploymentManager(); });

        it('full lifecycle: create → deploy → markDeployed', () => {
            const dep = dm.create('v1.0', 'production', ['api.js', 'worker.js']);
            expect(dep.status).toBe('pending');

            expect(dm.deploy(dep.id)).toBe(true);
            expect(dm.get(dep.id)!.status).toBe('deploying');

            expect(dm.markDeployed(dep.id)).toBe(true);
            expect(dm.get(dep.id)!.status).toBe('deployed');
        });

        it('markFailed transitions any status to failed', () => {
            const dep = dm.create('v2.0', 'staging', []);
            dm.deploy(dep.id);
            dm.markFailed(dep.id);
            expect(dm.get(dep.id)!.status).toBe('failed');
        });

        it('getCurrent returns a deployed version for environment', () => {
            const d1 = dm.create('v1.0', 'prod', []);
            dm.deploy(d1.id); dm.markDeployed(d1.id);

            const current = dm.getCurrent('prod');
            expect(current).not.toBeNull();
            expect(current!.version).toBe('v1.0');
            expect(current!.status).toBe('deployed');

            // Staging has no deployments
            expect(dm.getCurrent('staging')).toBeNull();
        });

        it('getHistory filters by environment', () => {
            dm.create('v1', 'prod', []);
            dm.create('v2', 'staging', []);
            dm.create('v3', 'prod', []);

            expect(dm.getHistory('prod')).toHaveLength(2);
            expect(dm.getHistory('staging')).toHaveLength(1);
        });
    });

    // ═══════════════════════════════════════
    // RollbackManager
    // ═══════════════════════════════════════
    describe('RollbackManager', () => {
        let rm: RollbackManager;
        beforeEach(() => { rm = new RollbackManager(); });

        it('creates and retrieves rollback points', () => {
            const point = rm.create('deployment', 'Before v2.0 release', { version: 'v1.0', config: {} });
            expect(point.id).toMatch(/^rb-/);
            expect(point.size).toBeGreaterThan(0);
            expect(rm.get(point.id)).not.toBeNull();
        });

        it('rollback by ID restores state', () => {
            const pt = rm.create('config', 'backup config', { theme: 'dark' });
            const result = rm.rollback(pt.id, 'user requested');
            expect(result.success).toBe(true);
            expect(result.state!.theme).toBe('dark');
            expect(rm.getHistory()).toHaveLength(1);
        });

        it('rollbackLatest finds a migration type point', () => {
            rm.create('migration', 'v1', { schema: 1 });
            rm.create('config', 'cfg', { x: 1 });

            const result = rm.rollbackLatest('migration');
            expect(result.success).toBe(true);
            expect(result.state!.schema).toBe(1);

            // config type rollback
            const cfgResult = rm.rollbackLatest('config');
            expect(cfgResult.success).toBe(true);
            expect(cfgResult.state!.x).toBe(1);
        });

        it('rollback fails for nonexistent point', () => {
            expect(rm.rollback('rb-999').success).toBe(false);
        });
    });

    // ═══════════════════════════════════════
    // MigrationSystem
    // ═══════════════════════════════════════
    describe('MigrationSystem', () => {
        let ms: MigrationSystem;
        beforeEach(() => { ms = new MigrationSystem(); });

        it('registers and runs migrations in version order', async () => {
            const log: string[] = [];
            ms.register({ version: '1.1.0', name: 'Add users', up: async () => { log.push('1.1'); } });
            ms.register({ version: '1.0.0', name: 'Init', up: async () => { log.push('1.0'); } });
            ms.register({ version: '1.2.0', name: 'Add roles', up: async () => { log.push('1.2'); } });

            const results = await ms.migrate();
            expect(results).toHaveLength(3);
            expect(log).toEqual(['1.0', '1.1', '1.2']); // sorted by version
            expect(ms.getVersion()).toBe('1.2.0');
        });

        it('skips already-applied migrations', async () => {
            let count = 0;
            ms.register({ version: '1.0.0', name: 'Init', up: async () => { count++; } });

            await ms.migrate();
            await ms.migrate(); // second run should skip
            expect(count).toBe(1);
        });

        it('rollback reverses last migration', async () => {
            const state = { users: true };
            ms.register({
                version: '1.0.0', name: 'Add users',
                up: async () => { state.users = true; },
                down: async () => { state.users = false; },
            });

            await ms.migrate();
            expect(state.users).toBe(true);

            const rollback = await ms.rollback();
            expect(rollback!.status).toBe('rolled-back');
            expect(state.users).toBe(false);
        });

        it('getPending returns unapplied migrations', async () => {
            ms.register({ version: '1.0.0', name: 'A', up: async () => {} });
            ms.register({ version: '2.0.0', name: 'B', up: async () => {} });

            expect(ms.getPending()).toHaveLength(2);
            await ms.migrate();
            expect(ms.getPending()).toHaveLength(0);
        });

        it('handles migration failure gracefully', async () => {
            ms.register({ version: '1.0.0', name: 'Good', up: async () => {} });
            ms.register({ version: '2.0.0', name: 'Bad', up: async () => { throw new Error('schema conflict'); } });
            ms.register({ version: '3.0.0', name: 'Never', up: async () => {} });

            const results = await ms.migrate();
            expect(results).toHaveLength(2); // stops at failure
            expect(results[0].status).toBe('applied');
            expect(results[1].status).toBe('failed');
            expect(results[1].error).toBe('schema conflict');
            expect(ms.getVersion()).toBe('1.0.0'); // stuck at last good
        });
    });

    // ═══════════════════════════════════════
    // HealthProbe
    // ═══════════════════════════════════════
    describe('HealthProbe', () => {
        let hp: HealthProbe;
        beforeEach(() => { hp = new HealthProbe(); });

        it('registers and probes a healthy target', async () => {
            hp.register('db', async () => true);
            const result = await hp.probe('db');
            expect(result.healthy).toBe(true);
            expect(hp.getTarget('db')!.status).toBe('healthy');
        });

        it('tracks consecutive failures up to threshold', async () => {
            hp.register('api', async () => false, 1000, 3);

            await hp.probe('api'); // fail 1
            expect(hp.getTarget('api')!.status).toBe('unknown'); // not yet threshold

            await hp.probe('api'); // fail 2
            expect(hp.getTarget('api')!.status).toBe('unknown');

            await hp.probe('api'); // fail 3 → threshold reached
            expect(hp.getTarget('api')!.status).toBe('unhealthy');
        });

        it('probeAll returns all results', async () => {
            hp.register('db', async () => true);
            hp.register('cache', async () => true);
            hp.register('api', async () => false);

            const results = await hp.probeAll();
            expect(results).toHaveLength(3);
            expect(results.filter(r => r.healthy)).toHaveLength(2);
        });

        it('getOverallHealth reflects worst target', async () => {
            hp.register('db', async () => true);
            hp.register('api', async () => false, 1000, 1);

            await hp.probeAll();
            const health = hp.getOverallHealth();
            expect(health.healthy).toBe(false); // api is unhealthy
        });
    });
});
