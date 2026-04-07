/**
 * Wave 8 — Plugin System Integration Tests
 *
 * Cross-system integration tests verifying all plugin subsystems work
 * together: Registry ↔ Hooks ↔ Discovery ↔ Config ↔ Sandbox ↔
 * Dependencies ↔ HotReload ↔ VersionManager ↔ CLI ↔ SDK
 *
 * These tests simulate real-world plugin lifecycle scenarios end-to-end.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Core modules
import { PluginRegistry } from '../../src/plugins/registry.js';
import { HookRunner } from '../../src/plugins/hooks.js';
import { PluginDiscovery } from '../../src/plugins/discovery.js';
import { PluginInstaller } from '../../src/plugins/install.js';
import { PluginConfigState } from '../../src/plugins/config-state.js';
import { PluginStatusReporter } from '../../src/plugins/status.js';
import { PluginServiceManager } from '../../src/plugins/services.js';
import { PluginMarketplace } from '../../src/plugins/marketplace.js';

// Sandbox + security
import { PluginSandbox } from '../../src/plugins/sandbox.js';
import { ResourceLimiter } from '../../src/plugins/resource-limiter.js';
import { PathJail } from '../../src/plugins/path-jail.js';
import { AuditLog } from '../../src/plugins/audit-log.js';

// Infrastructure
import { DependencyGraph } from '../../src/plugins/dependency-graph.js';
import { PluginHotReload } from '../../src/plugins/hot-reload.js';
import { VersionManager } from '../../src/plugins/version-manager.js';

// SDK
import { PluginScaffold } from '../../src/plugin-sdk/cli-scaffold.js';
import { PluginCommands } from '../../src/cli/plugin-commands.js';
import { HooksAPI } from '../../src/plugin-sdk/hooks-api.js';
import { ConfigBuilder } from '../../src/plugin-sdk/config-builder.js';

// Types
import {
    createPluginRecord,
    createEmptyPluginRegistryData,
} from '../../src/plugins/types.js';

// ═══════════════════════════════════════════════════════════════════
// Integration 1: Full Plugin Lifecycle
// Registry → Config → Sandbox → Hooks → Status
// ═══════════════════════════════════════════════════════════════════

describe('Integration: Full Plugin Lifecycle', () => {
    let registry: PluginRegistry;
    let configState: PluginConfigState;
    let statusReporter: PluginStatusReporter;
    let auditLog: AuditLog;

    beforeEach(() => {
        registry = new PluginRegistry();
        configState = new PluginConfigState();
        statusReporter = new PluginStatusReporter();
        auditLog = new AuditLog();
    });

    it('should wire a plugin from registration through to status reporting', async () => {
        // Step 1: Register plugin
        const record = createPluginRecord({
            id: 'weather',
            name: 'Weather',
            source: '/plugins/weather',
            origin: 'workspace',
            enabled: true,
            version: '1.0.0',
        });

        const regData = registry.getData();
        regData.plugins.push(record);

        // Step 2: Register a tool
        registry.registerTool(
            record,
            { name: 'get_weather', description: 'Get weather', parameters: {}, execute: async () => 'sunny' },
        );

        // Step 3: Register a hook
        registry.registerHook(
            record,
            'message_received',
            async (event) => event,
            { priority: 50 },
        );

        // Step 4: Configure
        const normalizedConfig = configState.normalize({ enabled: true });
        const configResult = configState.resolveEnableState('weather', normalizedConfig);
        expect(configResult.enabled).toBe(true);

        // Step 5: Audit
        auditLog.recordLifecycle('weather', 'loaded', 'v1.0.0');
        auditLog.recordPermissionCheck('weather', 'network', true, 'fetch');

        // Step 6: Status report
        const status = statusReporter.formatForCli(registry.getData());
        expect(status).toContain('Plugin Status');

        // Verify everything is wired
        expect(registry.getData().tools).toHaveLength(1);
        const hookRunner = new HookRunner(registry);
        // Just verify hooks are wired and can run
        await hookRunner.runVoidHook('message_received', {}, {});
        expect(auditLog.count()).toBe(2);
    });

    it('should handle multi-plugin registration and hook execution', async () => {
        // Register multiple plugins
        const pluginIds = ['auth', 'logging', 'metrics'];
        const hookEvents = ['session_start', 'session_end', 'message_sent'];
        const records: ReturnType<typeof createPluginRecord>[] = [];
        for (const id of pluginIds) {
            const rec = createPluginRecord({ id, name: id, source: `/plugins/${id}`, origin: 'bundled', enabled: true });
            registry.getData().plugins.push(rec);
            records.push(rec);
        }

        // Each plugin registers a different hook event
        const callOrder: string[] = [];
        for (let i = 0; i < pluginIds.length; i++) {
            registry.registerHook(
                records[i]!,
                hookEvents[i]!,
                async () => { callOrder.push(pluginIds[i]!); },
                { priority: i * 10 },
            );
        }

        // Run each hook — all should fire
        const hookRunnerLocal = new HookRunner(registry);
        for (const event of hookEvents) {
            await hookRunnerLocal.runVoidHook(event as any, {}, {});
        }
        expect(callOrder).toHaveLength(3);
        expect(callOrder).toEqual(pluginIds);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Integration 2: Dependency Graph → Version Manager → Load Order
// ═══════════════════════════════════════════════════════════════════

describe('Integration: Dependencies + Versions', () => {
    let depGraph: DependencyGraph;
    let versionManager: VersionManager;

    beforeEach(() => {
        depGraph = new DependencyGraph();
        versionManager = new VersionManager('2.0.0');
    });

    it('should resolve load order with version compatibility', () => {
        // Register plugins with versions
        versionManager.register('core', '1.0.0');
        versionManager.register('database', '2.1.0');
        versionManager.register('api', '1.5.0');
        versionManager.register('ui', '1.0.0');

        // Build dependency graph
        depGraph.addPlugin('core', '1.0.0');
        depGraph.addPlugin('database', '2.1.0', [
            { pluginId: 'core', versionConstraint: '>=1.0.0' },
        ]);
        depGraph.addPlugin('api', '1.5.0', [
            { pluginId: 'database', versionConstraint: '^2.0.0' },
            { pluginId: 'core', versionConstraint: '>=1.0.0' },
        ]);
        depGraph.addPlugin('ui', '1.0.0', [
            { pluginId: 'api', versionConstraint: '>=1.0.0' },
        ]);

        // Resolve load order
        const loadOrder = depGraph.resolveLoadOrder();
        expect(loadOrder.valid).toBe(true);
        expect(loadOrder.order).toHaveLength(4);

        // Verify core is always loaded first
        expect(loadOrder.order.indexOf('core')).toBeLessThan(loadOrder.order.indexOf('database'));
        expect(loadOrder.order.indexOf('database')).toBeLessThan(loadOrder.order.indexOf('api'));
        expect(loadOrder.order.indexOf('api')).toBeLessThan(loadOrder.order.indexOf('ui'));

        // Cross-check with version manager
        const uiCompat = versionManager.checkCompatibility({
            pluginId: 'ui',
            minHostVersion: '1.0.0',
            peerDependencies: [
                { peerId: 'api', version: '>=1.0.0' },
            ],
        });
        expect(uiCompat.allCompatible).toBe(true);
    });

    it('should detect version incompatibility and cycle together', () => {
        depGraph.addPlugin('a', '1.0.0', [{ pluginId: 'b', versionConstraint: '>=2.0.0' }]);
        depGraph.addPlugin('b', '1.0.0', [{ pluginId: 'a' }]); // cycle

        const result = depGraph.resolveLoadOrder();
        expect(result.valid).toBe(false);
        expect(result.cycles.length).toBeGreaterThan(0);
        expect(result.warnings.some((w) => w.includes('1.0.0'))).toBe(true);
    });

    it('should plan safe unload with version tracking', () => {
        depGraph.addPlugin('core', '1.0.0');
        depGraph.addPlugin('ext', '2.0.0', [{ pluginId: 'core' }]);

        versionManager.register('core', '1.0.0');
        versionManager.register('ext', '2.0.0');

        // Can't unload core while ext depends on it
        expect(depGraph.canUnload('core').safe).toBe(false);

        // Unload order — ext first, then core
        const unloadOrder = depGraph.getUnloadOrder('core');
        expect(unloadOrder[0]).toBe('ext');
        expect(unloadOrder[1]).toBe('core');

        // Version manager tracks the history
        expect(versionManager.getUpgradePath('core')).toEqual(['1.0.0']);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Integration 3: Sandbox → ResourceLimiter → PathJail → AuditLog
// ═══════════════════════════════════════════════════════════════════

describe('Integration: Security Stack', () => {
    let sandbox: PluginSandbox;
    let limiter: ResourceLimiter;
    let jail: PathJail;
    let audit: AuditLog;
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-int-'));
        sandbox = new PluginSandbox({
            pluginName: 'test-plugin',
            permissions: ['network', 'filesystem'],
        });
        limiter = new ResourceLimiter('test-plugin', 'standard');
        jail = PathJail.forPlugin('test-plugin', tmpDir);
        audit = new AuditLog();
    });

    afterEach(() => {
        limiter.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should enforce sandbox permissions and audit the result', () => {
        // Permission check through sandbox
        const hasNetwork = sandbox.hasPermission('network');
        const hasExec = sandbox.hasPermission('exec');

        // Record in audit log
        audit.recordPermissionCheck('test-plugin', 'network', hasNetwork, 'fetch api');
        audit.recordPermissionCheck('test-plugin', 'exec', hasExec, 'run script');

        expect(hasNetwork).toBe(true);
        expect(hasExec).toBe(false);
        expect(audit.count()).toBe(2);
        expect(audit.getWarnings()).toHaveLength(1); // exec denied
    });

    it('should enforce resource limits and audit violations', () => {
        // Use strict limiter
        const strictLimiter = new ResourceLimiter('test-plugin', 'strict');

        // Exhaust concurrent ops
        strictLimiter.acquireOp('op1');
        strictLimiter.acquireOp('op2');
        strictLimiter.acquireOp('op3');
        const denied = !strictLimiter.acquireOp('op4');

        if (denied) {
            audit.recordResourceViolation(
                'test-plugin',
                'maxConcurrentOps',
                3,
                4,
                'concurrent limit exceeded',
            );
        }

        expect(denied).toBe(true);
        expect(audit.getWarnings()).toHaveLength(1);
        strictLimiter.dispose();
    });

    it('should enforce path jail and audit filesystem access', () => {
        // Allowed path
        const okResult = jail.check(path.join(tmpDir, 'data.json'), 'read');
        audit.recordFilesystem('test-plugin', 'read', path.join(tmpDir, 'data.json'), okResult.allowed);

        // Blocked path
        const badResult = jail.check('/etc/passwd', 'read');
        audit.recordFilesystem('test-plugin', 'read', '/etc/passwd', badResult.allowed);

        expect(okResult.allowed).toBe(true);
        expect(badResult.allowed).toBe(false);
        expect(audit.count()).toBe(2);
        expect(audit.getWarnings()).toHaveLength(1);
    });

    it('should provide combined security diagnostics', () => {
        // Run a workflow: sandbox check → limiter check → path check → audit
        audit.recordLifecycle('test-plugin', 'activated');
        audit.recordPermissionCheck('test-plugin', 'network', true, 'api call');
        audit.recordFilesystem('test-plugin', 'write', path.join(tmpDir, 'out.txt'), true);

        const stats = audit.getStats();
        expect(stats.totalEvents).toBe(3);
        expect(stats.byCategory['lifecycle']).toBe(1);
        expect(stats.byCategory['permission']).toBe(1);
        expect(stats.byCategory['filesystem']).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Integration 4: Scaffold → Install → Registry → CLI
// ═══════════════════════════════════════════════════════════════════

describe('Integration: Plugin Creation to CLI', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-int-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should scaffold → verify → register → list via CLI', async () => {
        // Step 1: Scaffold a plugin
        const scaffold = new PluginScaffold();
        const targetDir = path.join(tmpDir, 'my-plugin');
        const scaffoldResult = scaffold.generate({
            name: 'my-plugin',
            targetDir,
            template: 'tool',
            withTests: true,
        });
        expect(scaffoldResult.success).toBe(true);
        expect(scaffoldResult.filesCreated).toContain('src/tools.ts');

        // Step 2: Verify the generated files
        const pluginJson = JSON.parse(fs.readFileSync(path.join(targetDir, 'plugin.json'), 'utf-8'));
        expect(pluginJson.name).toBe('my-plugin');
        expect(pluginJson.version).toBe('0.1.0');

        const pkgJson = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf-8'));
        expect(pkgJson.name).toBe('coreblow-plugin-my-plugin');

        // Step 3: Simulate installation into registry
        const registryData = createEmptyPluginRegistryData();
        registryData.plugins.push(
            createPluginRecord({
                id: 'my-plugin',
                name: 'my-plugin',
                source: targetDir,
                origin: 'workspace',
                enabled: true,
                version: '0.1.0',
            }),
        );

        // Step 4: Use CLI to list
        const commands = new PluginCommands({ registryData });
        const listResult = await commands.execute('list', []);
        expect(listResult.success).toBe(true);
        expect(listResult.output).toContain('my-plugin');

        // Step 5: Use CLI to get status
        const statusResult = await commands.execute('status', ['my-plugin']);
        expect(statusResult.success).toBe(true);
        expect(statusResult.output).toContain('0.1.0');

        // Step 6: Use CLI doctor
        const doctorResult = await commands.execute('doctor', []);
        expect(doctorResult.success).toBe(true);
        expect(doctorResult.output).toContain('Plugin Doctor');
    });
});

// ═══════════════════════════════════════════════════════════════════
// Integration 5: HotReload → DependencyGraph → Audit
// ═══════════════════════════════════════════════════════════════════

describe('Integration: Hot-Reload Pipeline', () => {
    let hotReload: PluginHotReload;
    let depGraph: DependencyGraph;
    let audit: AuditLog;
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-int-'));
        depGraph = new DependencyGraph();
        audit = new AuditLog();
        hotReload = new PluginHotReload({
            watchPaths: [tmpDir],
            debounceMs: 50,
            autoReload: false,
        });
    });

    afterEach(() => {
        hotReload.stop();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should reload a plugin and audit the cycle', async () => {
        // Setup dependency graph
        depGraph.addPlugin('core', '1.0.0');
        depGraph.addPlugin('ext', '1.0.0', [{ pluginId: 'core' }]);
        hotReload.setDependencyGraph(depGraph);

        // Register reload handler that audits
        hotReload.onReload(async (event) => {
            audit.recordLifecycle(event.pluginId, 'reloaded', `${event.changedFiles.length} files`);
            return {
                pluginId: event.pluginId,
                success: true,
                duration: 50,
            };
        });

        // Trigger manual reload
        const result = await hotReload.triggerReload('ext');
        expect(result.success).toBe(true);

        // Verify audit trail
        expect(audit.count()).toBe(1);
        const events = audit.forPlugin('ext');
        expect(events[0]!.action).toContain('reloaded');

        // Verify reload history
        expect(hotReload.getReloadCount()).toBe(1);
        expect(hotReload.getSuccessRate()).toBe(1);
    });

    it('should handle reload failure and audit the error', async () => {
        hotReload.onReload(async (event) => {
            audit.recordLifecycle(event.pluginId, 'reload-failed', 'compilation error');
            return {
                pluginId: event.pluginId,
                success: false,
                duration: 10,
                error: 'TypeScript compilation error',
            };
        });

        const result = await hotReload.triggerReload('broken-plugin');
        expect(result.success).toBe(false);
        expect(audit.count()).toBe(1);
        expect(hotReload.getSuccessRate()).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Integration 6: SDK → Registry → Hooks (Plugin Author Flow)
// ═══════════════════════════════════════════════════════════════════

describe('Integration: Plugin Author SDK Flow', () => {
    it('should use SDK to define a plugin, register hooks, and run them', async () => {
        // Step 1: Author uses ConfigBuilder
        const configBuilder = new ConfigBuilder()
            .string('apiKey', { label: 'API Key', required: true })
            .number('timeout', { label: 'Timeout', default: 30 })
            .boolean('debug', { label: 'Debug Mode', default: false });
        const schema = configBuilder.build();
        expect(configBuilder.getFields().size).toBe(3);

        // Step 2: Author uses HooksAPI
        const hooksApi = new HooksAPI();
        const handlers: string[] = [];
        hooksApi.on('message_received', async () => { handlers.push('msg'); });
        hooksApi.on('session_start', async () => { handlers.push('sess'); });
        const registrations = hooksApi.getHooks();
        expect(registrations).toHaveLength(2);

        // Step 3: Register hooks into registry, then into HookRunner
        const intReg = new PluginRegistry();
        const pluginRec = createPluginRecord({ id: 'my-sdk-plugin', name: 'SDK Plugin', source: '/sdk', origin: 'bundled', enabled: true });
        intReg.getData().plugins.push(pluginRec);
        for (const reg of registrations) {
            intReg.registerHook(pluginRec, reg.event, reg.handler, { priority: reg.priority });
        }
        const intHookRunner = new HookRunner(intReg);

        // Step 4: Execute hooks
        await intHookRunner.runVoidHook('message_received', { text: 'hello' }, {});
        await intHookRunner.runVoidHook('session_start', { sessionId: 'abc' }, {});
        expect(handlers).toEqual(['msg', 'sess']);

        // Step 5: Validate config
        const validResult = schema.validate!({ apiKey: 'sk-123', timeout: 60, debug: true });
        expect(validResult.ok).toBe(true);

        const invalidResult = schema.validate!({ timeout: 'not-a-number' });
        expect(invalidResult.ok).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Integration 7: Discovery → Config → Install → Marketplace
// ═══════════════════════════════════════════════════════════════════

describe('Integration: Discovery + Install Pipeline', () => {
    it('should discover, configure, and marketplace-check plugins', () => {
        const discovery = new PluginDiscovery();
        const configState = new PluginConfigState();
        const marketplace = new PluginMarketplace();

        // Load marketplace catalog
        marketplace.loadCatalog([
            { id: 'weather', name: 'Weather', version: '2.0.0', description: 'Weather data', tags: ['api'], downloads: 5000 },
            { id: 'translate', name: 'Translate', version: '1.0.0', description: 'Translation', tags: ['nlp'], downloads: 3000 },
        ]);

        // Search for plugins
        const searchResult = marketplace.search({ query: 'weather' });
        expect(searchResult.total).toBeGreaterThan(0);
        expect(searchResult.plugins[0]!.id).toBe('weather');

        // Check if locally installed version needs update
        const versionManager = new VersionManager('2.0.0');
        versionManager.register('weather', '1.5.0');
        const updateInfo = versionManager.checkUpdate('weather', '2.0.0');
        expect(updateInfo.updateAvailable).toBe(true);

        // Resolve config state
        const normConfig = configState.normalize({ enabled: true });
        const enableResult = configState.resolveEnableState('weather', normConfig);
        expect(enableResult.enabled).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Integration 8: Services → Status → Doctor
// ═══════════════════════════════════════════════════════════════════

describe('Integration: Service Management + Diagnostics', () => {
    it('should manage services and report combined diagnostics', async () => {
        const serviceManager = new PluginServiceManager();
        const statusReporter = new PluginStatusReporter();
        const audit = new AuditLog();

        // Register service
        const serviceStarted = { value: false };
        serviceManager.register({
            pluginId: 'db-plugin',
            pluginName: 'Database',
            service: {
                id: 'db-service',
                name: 'Database Service',
                start: async () => { serviceStarted.value = true; },
                stop: async () => { serviceStarted.value = false; },
                healthCheck: async () => ({ healthy: true }),
            },
            source: '/plugins/db',
        });

        // Start service
        await serviceManager.startAll();
        expect(serviceStarted.value).toBe(true);
        audit.recordLifecycle('db-plugin', 'service-started', 'db-service');

        // Health check
        const health = await serviceManager.healthCheckAll();
        expect(health[0]?.healthy).toBe(true);

        // Build registry data for status
        const registryData = createEmptyPluginRegistryData();
        registryData.plugins.push(
            createPluginRecord({
                id: 'db-plugin',
                name: 'Database',
                source: '/plugins/db',
                origin: 'bundled',
                enabled: true,
                version: '1.0.0',
            }),
        );
        registryData.services.push({
            pluginId: 'db-plugin',
            pluginName: 'Database',
            service: { id: 'db-service', name: 'Database Service' },
            source: '/plugins/db',
        });

        // Generate CLI status
        const statusOutput = statusReporter.formatForCli(registryData);
        expect(statusOutput).toContain('Plugin Status');

        // Use CLI doctor
        const commands = new PluginCommands({ registryData });
        const doctorResult = await commands.execute('doctor', []);
        expect(doctorResult.success).toBe(true);
        expect(doctorResult.output).toContain('Services: 1');

        // Cleanup
        await serviceManager.stopAll();
        expect(serviceStarted.value).toBe(false);
        audit.recordLifecycle('db-plugin', 'service-stopped', 'db-service');
        expect(audit.count()).toBe(2);
    });
});
