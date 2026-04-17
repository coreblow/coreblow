/**
 * plugins/status.test.ts
 *
 * Comprehensive tests for PluginStatusReporter and AuditLog.
 * Covers status summarization, diagnostics, CLI formatting,
 * API output, health checks, audit logging, and queries.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PluginStatusReporter } from './status.js';
import { AuditLog } from './audit-log.js';
import type { PluginRegistryData, PluginDiagnostic } from './types.js';

// ─── Fixtures ────────────────────────────────────────────────────

function makeRegistryData(overrides?: Partial<PluginRegistryData>): PluginRegistryData {
    return {
        plugins: [
            {
                id: 'weather',
                name: 'Weather Plugin',
                version: '1.0.0',
                status: 'loaded',
                origin: 'local',
                enabled: true,
                toolNames: ['get_weather'],
                hookNames: ['message_received'],
                channelIds: [],
                providerIds: [],
                services: [],
                commands: ['/weather'],
                httpRoutes: 0,
            },
            {
                id: 'analytics',
                name: 'Analytics Plugin',
                version: '2.0.0',
                status: 'loaded',
                origin: 'npm',
                enabled: true,
                toolNames: ['track_event', 'get_metrics'],
                hookNames: ['message_sent'],
                channelIds: ['slack'],
                providerIds: [],
                services: ['analytics-service'],
                commands: [],
                httpRoutes: 2,
            },
            {
                id: 'broken',
                name: 'Broken Plugin',
                version: '0.1.0',
                status: 'error',
                origin: 'local',
                enabled: false,
                error: 'Failed to load manifest',
                toolNames: [],
                hookNames: [],
                channelIds: [],
                providerIds: [],
                services: [],
                commands: [],
                httpRoutes: 0,
            },
        ] as any[],
        tools: [{ name: 'get_weather' }, { name: 'track_event' }, { name: 'get_metrics' }] as any[],
        hooks: [] as any[],
        typedHooks: [{ name: 'message_received' }, { name: 'message_sent' }] as any[],
        channels: [{ id: 'slack' }] as any[],
        providers: [],
        services: [{ name: 'analytics-service' }] as any[],
        commands: [{ name: '/weather' }] as any[],
        httpRoutes: [{ path: '/api/track' }, { path: '/api/metrics' }] as any[],
        diagnostics: [
            { pluginId: 'broken', level: 'error', message: 'Manifest parse failed', source: 'loader' },
            { pluginId: 'weather', level: 'warn', message: 'Deprecated API usage', source: 'validator' },
            { pluginId: 'analytics', level: 'info', message: 'Analytics initialized', source: 'runtime' },
        ] as PluginDiagnostic[],
        ...overrides,
    };
}

// ─── PluginStatusReporter Tests ──────────────────────────────────

describe('PluginStatusReporter', () => {
    let reporter: PluginStatusReporter;
    let data: PluginRegistryData;

    beforeEach(() => {
        reporter = new PluginStatusReporter();
        data = makeRegistryData();
    });

    describe('summarize', () => {
        it('should count totals', () => {
            const summary = reporter.summarize(data);
            expect(summary.total).toBe(3);
            expect(summary.loaded).toBe(2);
            expect(summary.errored).toBe(1);
        });

        it('should count capabilities', () => {
            const summary = reporter.summarize(data);
            expect(summary.tools).toBe(3);
            expect(summary.hooks).toBe(2);
            expect(summary.channels).toBe(1);
            expect(summary.services).toBe(1);
            expect(summary.commands).toBe(1);
            expect(summary.httpRoutes).toBe(2);
        });

        it('should handle empty data', () => {
            const summary = reporter.summarize(makeRegistryData({
                plugins: [], tools: [], typedHooks: [], channels: [],
                providers: [], services: [], commands: [], httpRoutes: [], diagnostics: [],
            }));
            expect(summary.total).toBe(0);
        });
    });

    describe('plugin statuses', () => {
        it('should return detailed statuses', () => {
            const statuses = reporter.getPluginStatuses(data);
            expect(statuses).toHaveLength(3);
            expect(statuses[0].id).toBe('weather');
            expect(statuses[0].capabilities.tools).toContain('get_weather');
        });

        it('should include errors', () => {
            const statuses = reporter.getPluginStatuses(data);
            const broken = statuses.find((s) => s.id === 'broken');
            expect(broken!.error).toBe('Failed to load manifest');
        });
    });

    describe('diagnostics', () => {
        it('should group by severity', () => {
            const report = reporter.getDiagnosticReport(data);
            expect(report.errors).toHaveLength(1);
            expect(report.warnings).toHaveLength(1);
            expect(report.info).toHaveLength(1);
            expect(report.total).toBe(3);
        });

        it('should filter diagnostics by plugin', () => {
            const diags = reporter.getPluginDiagnostics(data, 'broken');
            expect(diags).toHaveLength(1);
            expect(diags[0].level).toBe('error');
        });
    });

    describe('CLI format', () => {
        it('should format for CLI', () => {
            const output = reporter.formatForCli(data);
            expect(output).toContain('Plugin Status:');
            expect(output).toContain('Weather Plugin');
            expect(output).toContain('✓');
            expect(output).toContain('✗');
        });

        it('should include errors in CLI output', () => {
            const output = reporter.formatForCli(data);
            expect(output).toContain('Errors:');
            expect(output).toContain('Manifest parse failed');
        });

        it('should include warnings', () => {
            const output = reporter.formatForCli(data);
            expect(output).toContain('Warnings:');
        });
    });

    describe('API format', () => {
        it('should format for API', () => {
            const api = reporter.formatForApi(data);
            expect(api.summary).toBeDefined();
            expect(api.plugins).toHaveLength(3);
            expect(api.diagnostics.total).toBe(3);
        });
    });

    describe('health check', () => {
        it('should be unhealthy with errors', () => {
            expect(reporter.isHealthy(data)).toBe(false);
        });

        it('should be healthy without errors', () => {
            const healthyData = makeRegistryData({
                plugins: data.plugins.filter((p: any) => p.status !== 'error') as any,
            });
            expect(reporter.isHealthy(healthyData)).toBe(true);
        });
    });
});

// ─── AuditLog Tests ──────────────────────────────────────────────

describe('AuditLog', () => {
    let audit: AuditLog;

    beforeEach(() => {
        audit = new AuditLog();
    });

    describe('recording', () => {
        it('should record events', () => {
            audit.record({ pluginId: 'weather', category: 'lifecycle', severity: 'info', action: 'plugin.load' });
            expect(audit.count()).toBe(1);
        });

        it('should include timestamps and IDs', () => {
            const event = audit.record({ pluginId: 'weather', category: 'lifecycle', severity: 'info', action: 'load' });
            expect(event.timestamp).toBeGreaterThan(0);
            expect(event.id).toBeDefined();
        });

        it('should record multiple events', () => {
            audit.record({ pluginId: 'a', category: 'lifecycle', severity: 'info', action: 'load' });
            audit.record({ pluginId: 'b', category: 'lifecycle', severity: 'info', action: 'load' });
            audit.record({ pluginId: 'a', category: 'lifecycle', severity: 'info', action: 'unload' });
            expect(audit.count()).toBe(3);
        });
    });

    describe('convenience recorders', () => {
        it('should record permission checks', () => {
            audit.recordPermissionCheck('weather', 'network', true, 'fetch');
            audit.recordPermissionCheck('weather', 'exec', false, 'shell');
            expect(audit.count()).toBe(2);
            const warnings = audit.getWarnings();
            expect(warnings).toHaveLength(1);
        });

        it('should record lifecycle events', () => {
            const event = audit.recordLifecycle('weather', 'loaded', 'Plugin loaded OK');
            expect(event.category).toBe('lifecycle');
        });

        it('should record resource violations', () => {
            const event = audit.recordResourceViolation('weather', 'maxOps', 10, 15, 'api_call');
            expect(event.severity).toBe('warn');
        });

        it('should record filesystem events', () => {
            audit.recordFilesystem('weather', 'read', '/tmp/data.json', true);
            audit.recordFilesystem('weather', 'write', '/etc/passwd', false);
            expect(audit.count()).toBe(2);
        });

        it('should sanitize URLs in network records', () => {
            const event = audit.recordNetwork('weather', 'GET', 'https://user:pass@api.example.com?token=secret', true);
            expect(event.detail).not.toContain('pass');
        });

        it('should sanitize exec commands', () => {
            const event = audit.recordExec('weather', 'curl --header "Authorization: Bearer secret" https://api.com', false);
            expect(event.severity).toBe('critical');
        });

        it('should record findings', () => {
            const event = audit.recordFinding({
                checkId: 'weather.insecure-http',
                severity: 'warn',
                title: 'Uses HTTP instead of HTTPS',
            });
            expect(event.category).toBe('security');
        });
    });

    describe('querying', () => {
        beforeEach(() => {
            audit.record({ pluginId: 'weather', category: 'lifecycle', severity: 'info', action: 'load' });
            audit.record({ pluginId: 'analytics', category: 'permission', severity: 'warn', action: 'denied' });
            audit.record({ pluginId: 'weather', category: 'network', severity: 'info', action: 'fetch' });
        });

        it('should query by plugin', () => {
            expect(audit.query({ pluginId: 'weather' })).toHaveLength(2);
        });

        it('should query by category', () => {
            expect(audit.query({ category: 'permission' })).toHaveLength(1);
        });

        it('should query by severity', () => {
            expect(audit.query({ severity: 'warn' })).toHaveLength(1);
        });

        it('should get recent events', () => {
            expect(audit.recent(2)).toHaveLength(2);
        });

        it('should get events for plugin', () => {
            expect(audit.forPlugin('weather')).toHaveLength(2);
        });

        it('should get critical events', () => {
            audit.recordExec('bad', 'rm -rf /', false);
            expect(audit.getCritical()).toHaveLength(1);
        });

        it('should limit query results', () => {
            expect(audit.query({ limit: 1 })).toHaveLength(1);
        });
    });

    describe('statistics', () => {
        it('should compute stats', () => {
            audit.recordLifecycle('weather', 'loaded');
            audit.recordPermissionCheck('analytics', 'network', false, 'fetch');
            const stats = audit.getStats();
            expect(stats.totalEvents).toBe(2);
            expect(stats.byPlugin['weather']).toBe(1);
        });
    });

    describe('listeners', () => {
        it('should call event listeners', () => {
            const events: any[] = [];
            audit.onEvent((e) => events.push(e));
            audit.recordLifecycle('test', 'loaded');
            expect(events).toHaveLength(1);
        });

        it('should unsubscribe', () => {
            const events: any[] = [];
            const unsub = audit.onEvent((e) => events.push(e));
            unsub();
            audit.recordLifecycle('test', 'loaded');
            expect(events).toHaveLength(0);
        });
    });

    describe('export', () => {
        it('should export as JSON lines', () => {
            audit.recordLifecycle('weather', 'loaded');
            const jsonl = audit.exportJsonLines();
            expect(jsonl.split('\n')).toHaveLength(1);
        });

        it('should export as text', () => {
            audit.recordLifecycle('weather', 'loaded');
            const text = audit.exportText();
            expect(text).toContain('weather');
        });
    });

    describe('management', () => {
        it('should count events', () => {
            audit.recordLifecycle('a', 'loaded');
            audit.recordLifecycle('b', 'loaded');
            expect(audit.count()).toBe(2);
        });

        it('should clear events', () => {
            audit.recordLifecycle('a', 'loaded');
            audit.clear();
            expect(audit.count()).toBe(0);
        });
    });
});
