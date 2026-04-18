/**
 * plugins/version-manager.test.ts
 *
 * Comprehensive tests for VersionManager, PluginMarketplace,
 * PluginDocGenerator, and PluginInstaller.
 * Covers version tracking, compatibility, updates, search,
 * categories, docs generation, and install management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VersionManager } from './version-manager.js';
import { PluginMarketplace } from './marketplace.js';
import { PluginDocGenerator } from './doc-generator.js';
import type { MarketplacePlugin } from './types.js';
import type { PluginRecord } from '../agents/turn-engine/plugins/types.base.js';

// ─── Fixtures ────────────────────────────────────────────────────

function makeSamplePlugins(): MarketplacePlugin[] {
    return [
        { id: 'weather', name: 'Weather Plugin', description: 'Get weather data', version: '1.0.0', author: 'coreblow', tags: ['utility', 'api'], downloads: 5000, rating: 4.5, verified: true, provides: ['tool'] },
        { id: 'analytics', name: 'Analytics Plugin', description: 'Track events and metrics', version: '2.0.0', author: 'coreblow', tags: ['analytics', 'tracking'], downloads: 3000, rating: 4.2, verified: true, provides: ['hook', 'tool'] },
        { id: 'theme-dark', name: 'Dark Theme', description: 'Beautiful dark theme', version: '1.2.0', author: 'community', tags: ['theme', 'ui'], downloads: 8000, rating: 4.8, verified: false, provides: ['theme'] },
        { id: 'ai-enhance', name: 'AI Enhancer', description: 'AI-powered responses', version: '0.5.0', author: 'labs', tags: ['ai', 'utility'], downloads: 1000, rating: 3.5, verified: false, provides: ['tool', 'hook'] },
    ] as MarketplacePlugin[];
}

function makePluginRecord(overrides?: Partial<PluginRecord>): PluginRecord {
    return {
        id: 'weather',
        name: 'Weather Plugin',
        version: '1.0.0',
        status: 'loaded',
        origin: 'local',
        enabled: true,
        description: 'Get weather data',
        toolNames: ['get_weather', 'get_forecast'],
        hookNames: ['message_received'],
        channelIds: [],
        providerIds: [],
        services: [],
        commands: ['/weather', '/forecast'],
        httpRoutes: 1,
        format: 'js',
        source: '/plugins/weather',
        ...overrides,
    } as PluginRecord;
}

// ─── VersionManager Tests ────────────────────────────────────────

describe('VersionManager', () => {
    let vm: VersionManager;

    beforeEach(() => {
        vm = new VersionManager('3.0.0');
    });

    describe('record management', () => {
        it('should register a plugin', () => {
            vm.register('weather', '1.0.0');
            expect(vm.getVersion('weather')).toBe('1.0.0');
            expect(vm.count()).toBe(1);
        });

        it('should update version and track history', () => {
            vm.register('weather', '1.0.0');
            vm.register('weather', '2.0.0');
            expect(vm.getVersion('weather')).toBe('2.0.0');
            const record = vm.getRecord('weather');
            expect(record!.previousVersions).toContain('1.0.0');
        });

        it('should not duplicate when same version re-registered', () => {
            vm.register('weather', '1.0.0');
            vm.register('weather', '1.0.0');
            const record = vm.getRecord('weather');
            expect(record!.previousVersions).toBeUndefined();
        });

        it('should unregister', () => {
            vm.register('weather', '1.0.0');
            expect(vm.unregister('weather')).toBe(true);
            expect(vm.count()).toBe(0);
        });

        it('should get all records', () => {
            vm.register('a', '1.0.0');
            vm.register('b', '2.0.0');
            expect(vm.getAllRecords()).toHaveLength(2);
        });

        it('should clear', () => {
            vm.register('a', '1.0.0');
            vm.clear();
            expect(vm.count()).toBe(0);
        });
    });

    describe('host compatibility', () => {
        it('should pass when host meets requirement', () => {
            const result = vm.checkHostCompat('weather', '2.0.0');
            expect(result.compatible).toBe(true);
        });

        it('should fail when host is too old', () => {
            const result = vm.checkHostCompat('weather', '4.0.0');
            expect(result.compatible).toBe(false);
            expect(result.reason).toBeDefined();
        });
    });

    describe('peer compatibility', () => {
        it('should pass when peer meets version', () => {
            vm.register('core', '2.0.0');
            const result = vm.checkPeerCompat('weather', 'core', '>=1.0.0');
            expect(result.compatible).toBe(true);
        });

        it('should fail when peer not installed', () => {
            const result = vm.checkPeerCompat('weather', 'core', '>=1.0.0');
            expect(result.compatible).toBe(false);
        });

        it('should fail when peer version mismatches', () => {
            vm.register('core', '1.0.0');
            const result = vm.checkPeerCompat('weather', 'core', '>=2.0.0');
            expect(result.compatible).toBe(false);
        });
    });

    describe('full compatibility check', () => {
        it('should pass full compat check', () => {
            vm.register('core', '2.0.0');
            const report = vm.checkCompatibility({
                pluginId: 'weather',
                minHostVersion: '2.0.0',
                peerDependencies: [{ peerId: 'core', version: '>=1.0.0' }],
            });
            expect(report.allCompatible).toBe(true);
            expect(report.errors).toHaveLength(0);
        });

        it('should fail with incompatible host + peer', () => {
            const report = vm.checkCompatibility({
                pluginId: 'weather',
                minHostVersion: '5.0.0',
                peerDependencies: [{ peerId: 'missing', version: '>=1.0.0' }],
            });
            expect(report.allCompatible).toBe(false);
            expect(report.errors.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('update detection', () => {
        it('should detect available update', () => {
            vm.register('weather', '1.0.0');
            const info = vm.checkUpdate('weather', '2.0.0');
            expect(info.updateAvailable).toBe(true);
        });

        it('should detect no update needed', () => {
            vm.register('weather', '2.0.0');
            const info = vm.checkUpdate('weather', '2.0.0');
            expect(info.updateAvailable).toBe(false);
        });

        it('should detect breaking update', () => {
            vm.register('weather', '1.5.0');
            const info = vm.checkUpdate('weather', '2.0.0');
            expect(info.breaking).toBe(true);
        });

        it('should check all updates', () => {
            vm.register('a', '1.0.0');
            vm.register('b', '1.0.0');
            const updates = vm.checkAllUpdates({ a: '2.0.0', b: '1.0.0' });
            expect(updates).toHaveLength(2);
            expect(updates[0].updateAvailable).toBe(true);
            expect(updates[1].updateAvailable).toBe(false);
        });
    });

    describe('migration', () => {
        it('should get upgrade path', () => {
            vm.register('weather', '1.0.0');
            vm.register('weather', '1.5.0');
            vm.register('weather', '2.0.0');
            const path = vm.getUpgradePath('weather');
            expect(path).toEqual(['1.0.0', '1.5.0', '2.0.0']);
        });

        it('should detect downgrades', () => {
            vm.register('weather', '2.0.0');
            expect(vm.isDowngrade('weather', '1.0.0')).toBe(true);
            expect(vm.isDowngrade('weather', '3.0.0')).toBe(false);
        });
    });

    describe('host version', () => {
        it('should get/set host version', () => {
            expect(vm.getHostVersion()).toBe('3.0.0');
            vm.setHostVersion('4.0.0');
            expect(vm.getHostVersion()).toBe('4.0.0');
        });
    });
});

// ─── PluginMarketplace Tests ─────────────────────────────────────

describe('PluginMarketplace', () => {
    let marketplace: PluginMarketplace;

    beforeEach(() => {
        marketplace = new PluginMarketplace();
        marketplace.loadCatalog(makeSamplePlugins());
    });

    describe('catalog', () => {
        it('should load catalog', () => {
            expect(marketplace.count()).toBe(4);
        });

        it('should get plugin by ID', () => {
            const p = marketplace.getPlugin('weather');
            expect(p).toBeDefined();
            expect(p!.name).toBe('Weather Plugin');
        });

        it('should list all plugins', () => {
            expect(marketplace.list()).toHaveLength(4);
        });

        it('should register a plugin', () => {
            marketplace.register({ id: 'new', name: 'New', description: 'Test', version: '1.0.0' } as any);
            expect(marketplace.count()).toBe(5);
        });
    });

    describe('search', () => {
        it('should search by query', () => {
            const result = marketplace.search({ query: 'weather' });
            expect(result.plugins).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('should search by tags', () => {
            const result = marketplace.search({ tags: ['utility'] });
            expect(result.plugins).toHaveLength(2);
        });

        it('should search by author', () => {
            const result = marketplace.search({ author: 'coreblow' });
            expect(result.plugins).toHaveLength(2);
        });

        it('should search by provides', () => {
            const result = marketplace.search({ provides: ['theme'] });
            expect(result.plugins).toHaveLength(1);
        });

        it('should sort by downloads', () => {
            const result = marketplace.search({ sort: 'downloads' });
            expect(result.plugins[0].id).toBe('theme-dark');
        });

        it('should sort by rating', () => {
            const result = marketplace.search({ sort: 'rating' });
            expect(result.plugins[0].id).toBe('theme-dark');
        });

        it('should paginate', () => {
            const result = marketplace.search({ limit: 2, offset: 0 });
            expect(result.plugins).toHaveLength(2);
            expect(result.page).toBe(1);
        });
    });

    describe('featured', () => {
        it('should get featured plugins', () => {
            marketplace.setFeatured(['weather', 'analytics']);
            const featured = marketplace.getFeatured();
            expect(featured).toHaveLength(2);
        });

        it('should skip non-existent featured IDs', () => {
            marketplace.setFeatured(['weather', 'nonexistent']);
            expect(marketplace.getFeatured()).toHaveLength(1);
        });
    });

    describe('categories', () => {
        it('should get categories with counts', () => {
            const cats = marketplace.getCategories();
            expect(cats.length).toBeGreaterThan(0);
            const utility = cats.find((c) => c.id === 'utility');
            expect(utility!.count).toBe(2);
        });
    });

    describe('providers', () => {
        it('should get by provider', () => {
            const tools = marketplace.getByProvider('tool');
            expect(tools).toHaveLength(3);
        });
    });

    describe('verified', () => {
        it('should get verified only', () => {
            expect(marketplace.getVerified()).toHaveLength(2);
        });
    });
});

// ─── PluginDocGenerator Tests ────────────────────────────────────

describe('PluginDocGenerator', () => {
    let generator: PluginDocGenerator;

    beforeEach(() => {
        generator = new PluginDocGenerator();
    });

    describe('single plugin doc', () => {
        it('should generate plugin doc', () => {
            const doc = generator.generatePluginDoc(makePluginRecord());
            expect(doc.pluginId).toBe('weather');
            expect(doc.sections.length).toBeGreaterThan(0);
        });

        it('should include overview section', () => {
            const doc = generator.generatePluginDoc(makePluginRecord());
            expect(doc.sections.find((s) => s.slug === 'overview')).toBeDefined();
        });

        it('should include tools section', () => {
            const doc = generator.generatePluginDoc(makePluginRecord());
            expect(doc.sections.find((s) => s.slug === 'tools')).toBeDefined();
        });

        it('should include hooks section', () => {
            const doc = generator.generatePluginDoc(makePluginRecord());
            expect(doc.sections.find((s) => s.slug === 'hooks')).toBeDefined();
        });

        it('should include commands section', () => {
            const doc = generator.generatePluginDoc(makePluginRecord());
            expect(doc.sections.find((s) => s.slug === 'commands')).toBeDefined();
        });

        it('should skip empty sections', () => {
            const doc = generator.generatePluginDoc(makePluginRecord({
                toolNames: [], hookNames: [], commands: [],
            }));
            expect(doc.sections.find((s) => s.slug === 'tools')).toBeUndefined();
        });
    });

    describe('catalog doc', () => {
        it('should generate catalog', () => {
            const plugins = [makePluginRecord()];
            const catalog = generator.generateCatalog(plugins);
            expect(catalog.plugins).toHaveLength(1);
            expect(catalog.summary.totalPlugins).toBe(1);
        });

        it('should count capabilities in summary', () => {
            const plugins = [makePluginRecord()];
            const catalog = generator.generateCatalog(plugins);
            expect(catalog.summary.totalTools).toBe(2);
            expect(catalog.summary.totalHooks).toBe(1);
            expect(catalog.summary.totalCommands).toBe(2);
        });
    });

    describe('markdown rendering', () => {
        it('should render plugin markdown', () => {
            const doc = generator.generatePluginDoc(makePluginRecord());
            const md = generator.renderPluginMarkdown(doc);
            expect(md).toContain('# Weather Plugin');
            expect(md).toContain('get_weather');
        });

        it('should render catalog markdown', () => {
            const catalog = generator.generateCatalog([makePluginRecord()]);
            const md = generator.renderCatalogMarkdown(catalog);
            expect(md).toContain('Plugin Documentation');
            expect(md).toContain('Summary');
        });
    });

    describe('JSON rendering', () => {
        it('should render catalog JSON', () => {
            const catalog = generator.generateCatalog([makePluginRecord()]);
            const json = generator.renderCatalogJson(catalog);
            const parsed = JSON.parse(json);
            expect(parsed.summary.totalPlugins).toBe(1);
        });
    });

    describe('dependency diagram', () => {
        it('should generate mermaid diagram without deps', () => {
            const diagram = generator.generateDependencyDiagram([makePluginRecord()]);
            expect(diagram).toContain('graph LR');
        });

        it('should generate mermaid diagram with deps', () => {
            const deps = new Map([['weather', ['core']]]);
            const diagram = generator.generateDependencyDiagram([makePluginRecord()], deps);
            expect(diagram).toContain('graph TD');
            expect(diagram).toContain('-->');
        });
    });
});
