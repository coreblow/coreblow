// @ts-nocheck
/**
 * Phase 30: Final Integration — Analytics × DevOps × Health
 *
 * Verifies: EventTracker + MetricAggregator + PerformanceMonitor
 *           × HealthAggregator + BackupManager + MigrationSystem
 *           × DeploymentManager + BlueGreenDeployer + RollbackManager
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EventTracker } from '../infra/event-tracker.js';
import { MetricAggregator } from '../infra/metric-aggregator.js';
import { PerformanceMonitor } from '../infra/performance-monitor.js';
import { HealthAggregator } from '../infra/health.js';
import { BackupManager } from '../infra/backup-manager.js';
import { MigrationSystem } from '../infra/migration-system.js';
import { DeploymentManager } from '../infra/deployment-manager.js';
import { BlueGreenDeployer } from '../infra/blue-green-deployer.js';
import { RollbackManager } from '../infra/rollback-manager.js';
import { NotificationSystem } from '../infra/notification-system.js';

describe('Integration: Analytics × DevOps × Health', () => {
    let tracker: EventTracker;
    let metrics: MetricAggregator;
    let perf: PerformanceMonitor;
    let health: HealthAggregator;
    let backup: BackupManager;
    let migration: MigrationSystem;
    let deploy: DeploymentManager;
    let bg: BlueGreenDeployer;
    let rollback: RollbackManager;
    let notify: NotificationSystem;

    beforeEach(() => {
        const flushed: any[] = [];
        tracker = new EventTracker({ maxBufferSize: 50, sink: { flush: (e) => flushed.push(...e) } });
        metrics = new MetricAggregator();
        perf = new PerformanceMonitor();
        health = new HealthAggregator('3.0.0');
        backup = new BackupManager();
        migration = new MigrationSystem();
        deploy = new DeploymentManager();
        bg = new BlueGreenDeployer();
        rollback = new RollbackManager();
        notify = new NotificationSystem();
    });

    it('deploy → backup → metrics: full deployment lifecycle tracked', async () => {
        // 1. Create rollback point before deploy
        const rb = rollback.create('deployment', 'Pre v2.0', { version: 'v1.0' });

        // 2. Deploy via DeploymentManager
        const dep = deploy.create('v2.0', 'production', ['api.js', 'worker.js']);
        deploy.deploy(dep.id);
        metrics.increment('deployments');
        tracker.track('deploy_started', { version: 'v2.0', env: 'production' });

        // 3. Deploy via Blue-Green
        const bgResult = await bg.deploy('v2.0');
        expect(bgResult.success).toBe(true);

        // 4. Mark success + switch traffic
        deploy.markDeployed(dep.id);
        bg.switchTraffic();
        metrics.increment('deployments_successful');
        tracker.track('deploy_completed', { version: 'v2.0', slot: 'green' });

        // 5. Create backup of new state
        backup.create('post-v2.0', 'full', { version: 'v2.0', config: { feature: true } });

        // Verify all systems tracked correctly
        expect(metrics.getCounter('deployments')).toBe(1);
        expect(metrics.getCounter('deployments_successful')).toBe(1);
        expect(deploy.getCurrent('production')!.version).toBe('v2.0');
        expect(bg.getStatus().activeSlot).toBe('green');
        expect(backup.count()).toBe(1);
        expect(rollback.count()).toBe(1);
    });

    it('migration → health check → notification: pre-deploy validation', async () => {
        // 1. Run migrations
        migration.register({ version: '1.0.0', name: 'Init schema', up: async () => {} });
        migration.register({ version: '2.0.0', name: 'Add indexes', up: async () => {} });

        const stop = perf.startTimer('migrations');
        const results = await migration.migrate();
        stop();

        expect(results).toHaveLength(2);
        expect(results.every(r => r.status === 'applied')).toBe(true);
        metrics.increment('migrations_applied', 2);

        // 2. Health check post-migration
        health.register('db', async () => ({
            name: 'db', status: 'healthy',
            message: `Schema v${migration.getVersion()}`,
            lastCheckedAt: Date.now(),
        }));

        const systemHealth = await health.check();
        expect(systemHealth.status).toBe('healthy');
        tracker.track('health_check', { status: systemHealth.status });

        // 3. Performance stats
        const migrationPerf = perf.getStats('migrations');
        expect(migrationPerf!.count).toBe(1);
        expect(migrationPerf!.totalMs).toBeGreaterThanOrEqual(0);
    });

    it('deploy failure → rollback → notification → metrics', async () => {
        // 1. Backup current state
        backup.create('pre-deploy', 'config', { version: 'v1.0' });

        // 2. Attempt deploy (fails)
        const dep = deploy.create('v3.0-bad', 'production', ['broken.js']);
        deploy.deploy(dep.id);
        deploy.markFailed(dep.id);
        metrics.increment('deployments');
        metrics.increment('deployments_failed');

        // 3. Rollback
        rollback.create('deployment', 'Pre v3.0', { version: 'v1.0' });
        const rb = rollback.rollbackLatest('deployment', 'deploy failed');
        expect(rb.success).toBe(true);

        // 4. Notify admin
        notify.send('error', 'Deploy Failed', 'v3.0-bad failed, rolled back to v1.0', 'admin');
        tracker.track('deploy_failed', { version: 'v3.0-bad', rolledBack: true });

        // Verify
        const snap = metrics.getSnapshot();
        expect(snap.counters['deployments']).toBe(1);
        expect(snap.counters['deployments_failed']).toBe(1);
        expect(notify.getForUser('admin')).toHaveLength(1);
        expect(rollback.getHistory()).toHaveLength(1);
    });

    it('health aggregator wired to metrics + tracker', async () => {
        // Register health checks that report to metrics
        health.register('api', async () => {
            metrics.setGauge('api_latency', 15);
            return { name: 'api', status: 'healthy', latencyMs: 15, lastCheckedAt: Date.now() };
        });
        health.register('db', async () => {
            metrics.setGauge('db_latency', 5);
            return { name: 'db', status: 'healthy', latencyMs: 5, lastCheckedAt: Date.now() };
        });

        const result = await perf.monitorAsync('health_check', () => health.check());
        tracker.track('health_check_complete', { status: result.status, components: result.components.length });

        expect(result.status).toBe('healthy');
        expect(metrics.getGauge('api_latency')).toBe(15);
        expect(metrics.getGauge('db_latency')).toBe(5);
        expect(perf.getStats('health_check')!.count).toBe(1);
    });

    it('end-to-end: migrate → deploy → health → backup → metrics snapshot', async () => {
        // Phase 1: Migrate
        migration.register({ version: '1.0.0', name: 'Init', up: async () => {} });
        await migration.migrate();
        metrics.increment('migrations', 1);

        // Phase 2: Deploy
        const dep = deploy.create('v1.0', 'prod', ['app.js']);
        deploy.deploy(dep.id);
        deploy.markDeployed(dep.id);
        await bg.deploy('v1.0');
        bg.switchTraffic();
        metrics.increment('deploys', 1);

        // Phase 3: Health check
        health.register('app', async () => ({ name: 'app', status: 'healthy', lastCheckedAt: Date.now() }));
        const h = await health.check();
        expect(h.status).toBe('healthy');

        // Phase 4: Backup
        backup.create('stable-v1.0', 'full', { version: 'v1.0', migration: '1.0.0' });
        rollback.create('deployment', 'Stable v1.0', { version: 'v1.0' });

        // Phase 5: Final metrics
        const snap = metrics.getSnapshot();
        expect(snap.counters['migrations']).toBe(1);
        expect(snap.counters['deploys']).toBe(1);
        expect(deploy.getCurrent('prod')!.status).toBe('deployed');
        expect(bg.getStatus().activeSlot).toBe('green');
        expect(backup.count()).toBe(1);
        expect(rollback.count()).toBe(1);
        expect(migration.getVersion()).toBe('1.0.0');
    });
});
