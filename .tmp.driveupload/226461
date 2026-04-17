/**
 * CoreBlow Phase 24 — Deployment & Distribution Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigExporter } from '../../src/config/config-exporter.js';
import { HealthDashboard } from '../../src/observability/health-dashboard.js';
import { MigrationSystem } from '../../src/infra/migration-system.js';
import { BackupManager } from '../../src/infra/backup-manager.js';
import { ApiVersioning } from '../../src/gateway/api-versioning.js';

// ================================================================
// Config Exporter Tests
// ================================================================
describe('ConfigExporter', () => {
    const exporter = new ConfigExporter();
    const config = { provider: { name: 'openai', apiKey: 'sk-12345' }, server: { port: 3000 } };

    it('should export JSON', () => {
        const result = exporter.export(config, { format: 'json' });
        expect(JSON.parse(result).provider.name).toBe('openai');
    });

    it('should export env', () => {
        const result = exporter.export(config, { format: 'env' });
        expect(result).toContain('SERVER_PORT');
    });

    it('should export YAML', () => {
        const result = exporter.export(config, { format: 'yaml' });
        expect(result).toContain('provider:');
    });

    it('should export Docker Compose', () => {
        const result = exporter.export(config, { format: 'docker-compose' });
        expect(result).toContain('coreblow');
    });

    it('should export TOML', () => {
        const result = exporter.export(config, { format: 'toml' });
        expect(result).toContain('[provider]');
    });

    it('should redact secrets', () => {
        const result = exporter.export(config, { format: 'json', redactSecrets: true });
        expect(result).toContain('****');
        expect(result).not.toContain('sk-12345');
    });

    it('should import env', () => {
        const result = exporter.importEnv('PORT=3000\nHOST="localhost"\n# comment');
        expect(result.PORT).toBe('3000');
        expect(result.HOST).toBe('localhost');
    });

    it('should merge configs', () => {
        const merged = exporter.merge({ a: 1, b: { c: 2 } }, { b: { d: 3 } });
        expect((merged.b as any).c).toBe(2);
        expect((merged.b as any).d).toBe(3);
    });

    it('should diff configs', () => {
        const diffs = exporter.diff({ a: 1, b: 2 }, { a: 1, b: 3 });
        expect(diffs).toHaveLength(1);
        expect(diffs[0]!.key).toBe('b');
    });
});

// ================================================================
// Health Dashboard Tests
// ================================================================
describe('HealthDashboard', () => {
    let dashboard: HealthDashboard;
    beforeEach(() => { dashboard = new HealthDashboard(); });

    it('should register checks', () => {
        dashboard.register('db', () => ({ name: 'db', status: 'healthy', lastCheck: Date.now() }));
        expect(dashboard.count()).toBe(1);
    });

    it('should run all checks', async () => {
        dashboard.register('api', () => ({ name: 'api', status: 'healthy', lastCheck: Date.now() }));
        const snap = await dashboard.checkAll();
        expect(snap.overall).toBe('healthy');
        expect(snap.services).toHaveLength(1);
    });

    it('should detect degraded', async () => {
        dashboard.register('ok', () => ({ name: 'ok', status: 'healthy', lastCheck: Date.now() }));
        dashboard.register('slow', () => ({ name: 'slow', status: 'degraded', lastCheck: Date.now() }));
        const snap = await dashboard.checkAll();
        expect(snap.overall).toBe('degraded');
    });

    it('should detect unhealthy', async () => {
        dashboard.register('down', () => ({ name: 'down', status: 'unhealthy', lastCheck: Date.now() }));
        const snap = await dashboard.checkAll();
        expect(snap.overall).toBe('unhealthy');
    });

    it('should track uptime', () => {
        expect(dashboard.getUptime()).toBeGreaterThanOrEqual(0);
    });

    it('should track history', async () => {
        dashboard.register('svc', () => ({ name: 'svc', status: 'healthy', lastCheck: Date.now() }));
        await dashboard.checkAll();
        await dashboard.checkAll();
        expect(dashboard.getHistory()).toHaveLength(2);
    });

    it('should list checks', () => {
        dashboard.register('a', () => ({ name: 'a', status: 'healthy', lastCheck: Date.now() }));
        expect(dashboard.list()).toContain('a');
    });
});

// ================================================================
// Migration System Tests
// ================================================================
describe('MigrationSystem', () => {
    let migrations: MigrationSystem;
    beforeEach(() => { migrations = new MigrationSystem(); });

    it('should register migrations', () => {
        migrations.register({ version: '1.0.0', name: 'init', up: async () => {} });
        expect(migrations.count()).toBe(1);
    });

    it('should run pending migrations', async () => {
        let ran = false;
        migrations.register({ version: '1.0.0', name: 'init', up: async () => { ran = true; } });
        await migrations.migrate();
        expect(ran).toBe(true);
    });

    it('should track version', async () => {
        migrations.register({ version: '1.0.0', name: 'init', up: async () => {} });
        await migrations.migrate();
        expect(migrations.getVersion()).toBe('1.0.0');
    });

    it('should rollback', async () => {
        let state = 0;
        migrations.register({ version: '1.0.0', name: 'init', up: async () => { state = 1; }, down: async () => { state = 0; } });
        await migrations.migrate();
        await migrations.rollback();
        expect(state).toBe(0);
    });

    it('should skip applied', async () => {
        let count = 0;
        migrations.register({ version: '1.0.0', name: 'init', up: async () => { count++; } });
        await migrations.migrate();
        await migrations.migrate();
        expect(count).toBe(1);
    });

    it('should get pending', async () => {
        migrations.register({ version: '1.0.0', name: 'a', up: async () => {} });
        migrations.register({ version: '2.0.0', name: 'b', up: async () => {} });
        await migrations.migrate();
        expect(migrations.getPending()).toHaveLength(0);
    });

    it('should get history', async () => {
        migrations.register({ version: '1.0.0', name: 'init', up: async () => {} });
        await migrations.migrate();
        expect(migrations.getHistory()).toHaveLength(1);
    });
});

// ================================================================
// Backup Manager Tests
// ================================================================
describe('BackupManager', () => {
    let manager: BackupManager;
    beforeEach(() => { manager = new BackupManager(); });

    it('should create backups', () => {
        const bk = manager.create('test', 'config', { key: 'value' });
        expect(bk.id).toBeTruthy();
        expect(manager.count()).toBe(1);
    });

    it('should restore backups', () => {
        const bk = manager.create('test', 'config', { a: 1, b: 2 });
        const result = manager.restore(bk.id);
        expect(result.success).toBe(true);
        expect(result.restoredKeys).toEqual(['a', 'b']);
    });

    it('should fail restore for missing', () => {
        const result = manager.restore('nonexistent');
        expect(result.success).toBe(false);
    });

    it('should track size', () => {
        manager.create('test', 'full', { data: 'x'.repeat(100) });
        expect(manager.getTotalSize()).toBeGreaterThan(0);
    });

    it('should list by type', () => {
        manager.create('a', 'config', {});
        manager.create('b', 'full', {});
        expect(manager.list('config')).toHaveLength(1);
    });

    it('should delete backups', () => {
        const bk = manager.create('temp', 'config', {});
        expect(manager.delete(bk.id)).toBe(true);
    });
});

// ================================================================
// API Versioning Tests
// ================================================================
describe('ApiVersioning', () => {
    let api: ApiVersioning;
    beforeEach(() => { api = new ApiVersioning(); });

    it('should have v1 by default', () => {
        expect(api.count()).toBe(1);
    });

    it('should negotiate current version', () => {
        const result = api.negotiate('v1');
        expect(result.status).toBe('current');
        expect(result.warnings).toHaveLength(0);
    });

    it('should fallback for unknown version', () => {
        const result = api.negotiate('v99');
        expect(result.version).toBe('v1');
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should deprecate versions', () => {
        api.deprecate('v1', Date.now() + 86400_000);
        const result = api.negotiate('v1');
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should get routes', () => {
        const routes = api.getRoutes('v1');
        expect(routes.length).toBeGreaterThanOrEqual(5);
    });

    it('should resolve routes', () => {
        const route = api.resolveRoute('v1', '/chat');
        expect(route?.method).toBe('POST');
    });

    it('should list versions', () => {
        expect(api.list()).toHaveLength(1);
    });
});
