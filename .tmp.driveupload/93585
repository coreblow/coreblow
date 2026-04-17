/**
 * Wave 16: Plugin Documentation Generator Tests
 *
 * Tests auto-generation of Markdown/JSON docs from plugin records,
 * including tools, hooks, commands, config, dependency diagrams, and catalogs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    PluginDocGenerator,
    type PluginDoc,
    type CatalogDoc,
} from '../../src/plugins/doc-generator.js';
import { createPluginRecord } from '../../src/agents/turn-engine/plugins/types.base.js';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function makePlugin(id: string, overrides: Record<string, unknown> = {}) {
    const record = createPluginRecord({ id, name: id, description: `Plugin: ${id}`, version: '1.0.0', source: 'test', origin: 'workspace' as const, enabled: true, ...overrides });
    // Apply overrides to mutable fields
    if (overrides.toolNames) (record as Record<string, unknown>).toolNames = overrides.toolNames;
    if (overrides.hookNames) (record as Record<string, unknown>).hookNames = overrides.hookNames;
    if (overrides.commands) (record as Record<string, unknown>).commands = overrides.commands;
    if (overrides.channelIds) (record as Record<string, unknown>).channelIds = overrides.channelIds;
    if (overrides.providerIds) (record as Record<string, unknown>).providerIds = overrides.providerIds;
    if (overrides.services) (record as Record<string, unknown>).services = overrides.services;
    if (overrides.httpRoutes !== undefined) (record as Record<string, unknown>).httpRoutes = overrides.httpRoutes;
    if (overrides.configSchema !== undefined) (record as Record<string, unknown>).configSchema = overrides.configSchema;
    if (overrides.configJsonSchema) (record as Record<string, unknown>).configJsonSchema = overrides.configJsonSchema;
    if (overrides.configUiHints) (record as Record<string, unknown>).configUiHints = overrides.configUiHints;
    return record;
}

// ═══════════════════════════════════════════════════════════════════
// Single Plugin Doc
// ═══════════════════════════════════════════════════════════════════

describe('PluginDocGenerator — Single Plugin', () => {
    let gen: PluginDocGenerator;

    beforeEach(() => { gen = new PluginDocGenerator(); });

    it('generates overview section', () => {
        const plugin = makePlugin('weather', { description: 'Weather forecasts' });
        const doc = gen.generatePluginDoc(plugin);

        expect(doc.pluginId).toBe('weather');
        expect(doc.name).toBe('weather');
        expect(doc.version).toBe('1.0.0');
        expect(doc.sections.length).toBeGreaterThanOrEqual(1);
        expect(doc.sections[0].title).toBe('Overview');
        expect(doc.sections[0].content).toContain('weather');
    });

    it('generates tools section', () => {
        const plugin = makePlugin('tools-plugin', { toolNames: ['get_weather', 'get_forecast'] });
        const doc = gen.generatePluginDoc(plugin);

        const toolSection = doc.sections.find(s => s.slug === 'tools');
        expect(toolSection).toBeDefined();
        expect(toolSection!.content).toContain('get_weather');
        expect(toolSection!.content).toContain('get_forecast');
        expect(toolSection!.content).toContain('2');
    });

    it('generates hooks section', () => {
        const plugin = makePlugin('hook-plugin', { hookNames: ['message_received', 'before_tool_call'] });
        const doc = gen.generatePluginDoc(plugin);

        const hookSection = doc.sections.find(s => s.slug === 'hooks');
        expect(hookSection).toBeDefined();
        expect(hookSection!.content).toContain('message_received');
        expect(hookSection!.content).toContain('Fires when a message is received');
    });

    it('generates commands section', () => {
        const plugin = makePlugin('cmd-plugin', { commands: ['help', 'status', 'config'] });
        const doc = gen.generatePluginDoc(plugin);

        const cmdSection = doc.sections.find(s => s.slug === 'commands');
        expect(cmdSection).toBeDefined();
        expect(cmdSection!.content).toContain('/help');
        expect(cmdSection!.content).toContain('/status');
    });

    it('generates channels section', () => {
        const plugin = makePlugin('channel-plugin', { channelIds: ['discord', 'telegram'] });
        const doc = gen.generatePluginDoc(plugin);

        const chSection = doc.sections.find(s => s.slug === 'channels');
        expect(chSection).toBeDefined();
        expect(chSection!.content).toContain('discord');
        expect(chSection!.content).toContain('telegram');
    });

    it('generates providers section', () => {
        const plugin = makePlugin('provider-plugin', { providerIds: ['openai', 'anthropic'] });
        const doc = gen.generatePluginDoc(plugin);

        const provSection = doc.sections.find(s => s.slug === 'providers');
        expect(provSection).toBeDefined();
        expect(provSection!.content).toContain('openai');
    });

    it('generates services section', () => {
        const plugin = makePlugin('svc-plugin', { services: ['auth-service', 'db-service'] });
        const doc = gen.generatePluginDoc(plugin);

        const svcSection = doc.sections.find(s => s.slug === 'services');
        expect(svcSection).toBeDefined();
        expect(svcSection!.content).toContain('auth-service');
    });

    it('generates config section with JSON schema', () => {
        const plugin = makePlugin('config-plugin', {
            configSchema: true,
            configJsonSchema: { type: 'object', properties: { apiKey: { type: 'string' } } },
        });
        const doc = gen.generatePluginDoc(plugin);

        const cfgSection = doc.sections.find(s => s.slug === 'configuration');
        expect(cfgSection).toBeDefined();
        expect(cfgSection!.content).toContain('apiKey');
    });

    it('generates config section with UI hints', () => {
        const plugin = makePlugin('ui-config', {
            configSchema: true,
            configUiHints: { apiKey: { label: 'API Key', help: 'Key for auth', sensitive: true } },
        });
        const doc = gen.generatePluginDoc(plugin);

        const cfgSection = doc.sections.find(s => s.slug === 'configuration');
        expect(cfgSection).toBeDefined();
        expect(cfgSection!.content).toContain('API Key');
        expect(cfgSection!.content).toContain('Key for auth');
    });

    it('skips empty sections', () => {
        const plugin = makePlugin('minimal');
        const doc = gen.generatePluginDoc(plugin);

        // Only overview should exist
        expect(doc.sections.length).toBe(1);
        expect(doc.sections[0].slug).toBe('overview');
    });

    it('orders sections correctly', () => {
        const plugin = makePlugin('full', {
            toolNames: ['tool1'],
            hookNames: ['message_received'],
            commands: ['cmd1'],
            channelIds: ['ch1'],
        });
        const doc = gen.generatePluginDoc(plugin);

        const slugs = doc.sections.map(s => s.slug);
        expect(slugs).toEqual(['overview', 'tools', 'hooks', 'commands', 'channels']);
        for (let i = 0; i < doc.sections.length - 1; i++) {
            expect(doc.sections[i].order).toBeLessThan(doc.sections[i + 1].order);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════
// Markdown Rendering
// ═══════════════════════════════════════════════════════════════════

describe('PluginDocGenerator — Markdown', () => {
    let gen: PluginDocGenerator;

    beforeEach(() => { gen = new PluginDocGenerator(); });

    it('renders plugin markdown with header', () => {
        const plugin = makePlugin('my-plugin', { description: 'My awesome plugin' });
        const doc = gen.generatePluginDoc(plugin);
        const md = gen.renderPluginMarkdown(doc);

        expect(md).toContain('# my-plugin');
        expect(md).toContain('**Version:** 1.0.0');
        expect(md).toContain('**ID:** `my-plugin`');
    });

    it('renders table of contents when multiple sections', () => {
        const plugin = makePlugin('toc-plugin', { toolNames: ['t1'], hookNames: ['h1'] });
        const doc = gen.generatePluginDoc(plugin);
        const md = gen.renderPluginMarkdown(doc);

        expect(md).toContain('## Table of Contents');
        expect(md).toContain('[Overview](#overview)');
        expect(md).toContain('[Tools](#tools)');
    });

    it('skips table of contents for single section', () => {
        const plugin = makePlugin('simple');
        const doc = gen.generatePluginDoc(plugin);
        const md = gen.renderPluginMarkdown(doc);

        expect(md).not.toContain('## Table of Contents');
    });
});

// ═══════════════════════════════════════════════════════════════════
// Catalog Doc
// ═══════════════════════════════════════════════════════════════════

describe('PluginDocGenerator — Catalog', () => {
    let gen: PluginDocGenerator;

    beforeEach(() => { gen = new PluginDocGenerator({ title: 'Test Catalog' }); });

    it('generates catalog with summary', () => {
        const plugins = [
            makePlugin('alpha', { toolNames: ['t1', 't2'], hookNames: ['h1'] }),
            makePlugin('beta', { commands: ['cmd1'], channelIds: ['discord'] }),
        ];

        const catalog = gen.generateCatalog(plugins);

        expect(catalog.title).toBe('Test Catalog');
        expect(catalog.plugins).toHaveLength(2);
        expect(catalog.summary.totalPlugins).toBe(2);
        expect(catalog.summary.totalTools).toBe(2);
        expect(catalog.summary.totalHooks).toBe(1);
        expect(catalog.summary.totalCommands).toBe(1);
        expect(catalog.summary.totalChannels).toBe(1);
    });

    it('renders catalog markdown with index table', () => {
        const plugins = [
            makePlugin('alpha', { toolNames: ['t1'] }),
            makePlugin('beta', { hookNames: ['h1'] }),
        ];

        const catalog = gen.generateCatalog(plugins);
        const md = gen.renderCatalogMarkdown(catalog);

        expect(md).toContain('# Test Catalog');
        expect(md).toContain('## Summary');
        expect(md).toContain('## Plugin Index');
        expect(md).toContain('[alpha](#alpha)');
        expect(md).toContain('[beta](#beta)');
        expect(md).toContain('Generated at:');
    });

    it('renders catalog as JSON', () => {
        const plugins = [makePlugin('json-test')];
        const catalog = gen.generateCatalog(plugins);
        const json = gen.renderCatalogJson(catalog);

        const parsed = JSON.parse(json);
        expect(parsed.title).toBe('Test Catalog');
        expect(parsed.plugins).toHaveLength(1);
        expect(parsed.summary.totalPlugins).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Dependency Diagram
// ═══════════════════════════════════════════════════════════════════

describe('PluginDocGenerator — Dependency Diagram', () => {
    let gen: PluginDocGenerator;

    beforeEach(() => { gen = new PluginDocGenerator(); });

    it('generates mermaid diagram without dependencies', () => {
        const plugins = [makePlugin('standalone')];
        const diagram = gen.generateDependencyDiagram(plugins);

        expect(diagram).toContain('graph LR');
        expect(diagram).toContain('standalone');
    });

    it('generates diagram with dependency edges', () => {
        const plugins = [
            makePlugin('core'),
            makePlugin('auth'),
            makePlugin('api'),
        ];
        const deps = new Map<string, string[]>();
        deps.set('auth', ['core']);
        deps.set('api', ['core', 'auth']);

        const diagram = gen.generateDependencyDiagram(plugins, deps);

        expect(diagram).toContain('graph TD');
        expect(diagram).toContain('auth --> core');
        expect(diagram).toContain('api --> core');
        expect(diagram).toContain('api --> auth');
    });

    it('includes diagram in catalog markdown', () => {
        const plugins = [makePlugin('a'), makePlugin('b')];
        const deps = new Map<string, string[]>();
        deps.set('b', ['a']);

        const catalog = gen.generateCatalog(plugins, deps);
        const md = gen.renderCatalogMarkdown(catalog);

        expect(md).toContain('## Dependency Graph');
        expect(md).toContain('```mermaid');
        expect(md).toContain('b --> a');
    });

    it('sanitizes special characters in plugin IDs for mermaid', () => {
        const plugins = [makePlugin('my-special.plugin')];
        const diagram = gen.generateDependencyDiagram(plugins);

        // Should replace special chars
        expect(diagram).not.toContain('my-special.plugin[');
        expect(diagram).toContain('my_special_plugin');
    });
});

// ═══════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════

describe('PluginDocGenerator — Edge Cases', () => {
    let gen: PluginDocGenerator;

    beforeEach(() => { gen = new PluginDocGenerator(); });

    it('handles plugin with no description', () => {
        const plugin = createPluginRecord({ id: 'no-desc', source: 'test', origin: 'workspace' as const, enabled: true });
        const doc = gen.generatePluginDoc(plugin);

        expect(doc.description).toBe('');
        expect(doc.sections[0].content).toContain('no-desc');
    });

    it('handles plugin with no version', () => {
        const plugin = createPluginRecord({ id: 'no-ver', source: 'test', origin: 'workspace' as const, enabled: true });
        const doc = gen.generatePluginDoc(plugin);

        expect(doc.version).toBe('0.0.0');
    });

    it('handles empty plugin catalog', () => {
        const catalog = gen.generateCatalog([]);

        expect(catalog.plugins).toHaveLength(0);
        expect(catalog.summary.totalPlugins).toBe(0);

        const md = gen.renderCatalogMarkdown(catalog);
        expect(md).toContain('| Plugins | 0 |');
    });

    it('handles all capabilities at once', () => {
        const plugin = makePlugin('full-featured', {
            toolNames: ['t1', 't2'],
            hookNames: ['message_received', 'message_sent'],
            commands: ['cmd1'],
            channelIds: ['discord'],
            providerIds: ['openai'],
            services: ['auth'],
            httpRoutes: 3,
            configSchema: true,
            configJsonSchema: { type: 'object' },
        });

        const doc = gen.generatePluginDoc(plugin);
        const md = gen.renderPluginMarkdown(doc);

        expect(doc.sections.length).toBe(8); // overview + 7 capability sections
        expect(md).toContain('2 tools');
        expect(md).toContain('2 hooks');
        expect(md).toContain('3 HTTP routes');
    });

    it('custom title and description', () => {
        const gen2 = new PluginDocGenerator({
            title: 'My Project Plugins',
            description: 'Custom docs for my project.',
        });

        const catalog = gen2.generateCatalog([makePlugin('test')]);
        const md = gen2.renderCatalogMarkdown(catalog);

        expect(md).toContain('# My Project Plugins');
        expect(md).toContain('Custom docs for my project.');
    });
});
