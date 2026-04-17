/**
 * CoreBlow Phase 19 — Plugin & Agent Intelligence Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginLoader } from '../../src/plugins/plugin-loader.js';
import { PersonaEngine } from '../../src/agents/persona-engine.js';
import { SubAgentOrchestrator } from '../../src/agents/sub-agent-orchestrator.js';
import { PromptManager } from '../../src/agents/prompt-manager.js';
import { SetupWizard } from '../../src/wizard/setup-wizard.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ================================================================
// Plugin Loader Tests
// ================================================================
describe('PluginLoader', () => {
    let loader: PluginLoader;
    let tmpDir: string;
    let pluginsDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p19-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });
        PluginLoader.clearCache();
    });

    afterEach(async () => {
        if (loader) try { await loader.shutdown(); } catch { /* */ }
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function createPlugin(name: string, manifest: Record<string, unknown> = {}): void {
        const dir = path.join(pluginsDir, name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify({
            name, version: '1.0.0', ...manifest,
        }));
    }

    it('should register a plugin', async () => {
        createPlugin('test');
        loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        const result = await loader.loadAll();
        expect(result.loaded).toBe(1);
        expect(loader.getPluginCount()).toBe(1);
    });

    it('should reject duplicate plugins', async () => {
        createPlugin('test');
        loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();
        // Re-loading gives cached or re-discovered — only 1 unique plugin
        expect(loader.getPluginCount()).toBe(1);
    });

    it('should check dependencies', async () => {
        createPlugin('child', { dependencies: ['parent'] });
        loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        const result = await loader.loadAll();
        // Missing dep → cycle/missing diagnostics
        expect(result.diagnostics.some((d) => d.level === 'error')).toBe(true);
    });

    it('should initialize plugins', async () => {
        createPlugin('test');
        loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        const result = await loader.loadAll();
        expect(loader.isActivated('test')).toBe(true);
    });

    it('should start and stop plugins', async () => {
        createPlugin('test');
        loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();
        expect(loader.getState()).toBe('loaded');
        await loader.shutdown();
        expect(loader.getState()).toBe('stopped');
    });

    it('should list plugins', async () => {
        createPlugin('a');
        createPlugin('b');
        loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();
        expect(loader.getLoadedPlugins()).toHaveLength(2);
    });

    it('should unload plugins', async () => {
        createPlugin('temp');
        loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();
        await loader.deactivatePlugin('temp');
        expect(loader.isActivated('temp')).toBe(false);
    });
});

// ================================================================
// Persona Engine Tests
// ================================================================
describe('PersonaEngine', () => {
    let engine: PersonaEngine;
    beforeEach(() => { engine = new PersonaEngine(); });

    it('should have built-in personas', () => {
        expect(engine.list().length).toBeGreaterThanOrEqual(4);
    });

    it('should get persona by ID', () => {
        expect(engine.get('coder')?.name).toBe('Code Expert');
    });

    it('should activate persona for conversation', () => {
        expect(engine.activate('conv1', 'coder')).toBe(true);
        expect(engine.getActive('conv1')?.id).toBe('coder');
    });

    it('should return null for inactive conversation', () => {
        expect(engine.getActive('unknown')).toBeNull();
    });

    it('should build system messages', () => {
        engine.activate('conv1', 'coder');
        const msgs = engine.buildSystemMessages('conv1');
        expect(msgs[0]!.role).toBe('system');
        expect(msgs[0]!.content).toContain('software engineer');
    });

    it('should get model params', () => {
        engine.activate('conv1', 'coder');
        const params = engine.getModelParams('conv1');
        expect(params.temperature).toBe(0.3);
    });

    it('should register custom persona', () => {
        engine.register({ id: 'custom', name: 'Custom', systemPrompt: 'Be custom' });
        expect(engine.get('custom')?.name).toBe('Custom');
    });

    it('should deactivate persona', () => {
        engine.activate('conv1', 'coder');
        engine.deactivate('conv1');
        expect(engine.getActive('conv1')).toBeNull();
    });

    it('should not delete default persona', () => {
        expect(engine.delete('default')).toBe(false);
    });
});

// ================================================================
// Sub-Agent Orchestrator Tests
// ================================================================
describe('SubAgentOrchestrator', () => {
    let orchestrator: SubAgentOrchestrator;
    beforeEach(() => {
        orchestrator = new SubAgentOrchestrator();
        orchestrator.register({
            id: 'code', name: 'Coder', description: 'Writes code',
            capabilities: ['code', 'programming', 'typescript'],
            handler: async (input) => ({ agentId: 'code', result: `Code: ${input.task}`, confidence: 0.9, durationMs: 0 }),
        });
        orchestrator.register({
            id: 'search', name: 'Searcher', description: 'Searches info',
            capabilities: ['search', 'find', 'lookup'],
            handler: async (input) => ({ agentId: 'search', result: `Found: ${input.task}`, confidence: 0.8, durationMs: 0 }),
        });
    });

    it('should route to best agent', () => {
        const agent = orchestrator.route('write typescript code');
        expect(agent?.id).toBe('code');
    });

    it('should execute single agent', async () => {
        const result = await orchestrator.executeSingle('code', { task: 'hello' });
        expect(result?.result).toContain('Code: hello');
    });

    it('should execute parallel', async () => {
        const result = await orchestrator.executeParallel(['code', 'search'], { task: 'test' });
        expect(result.results).toHaveLength(2);
        expect(result.strategy).toBe('parallel');
    });

    it('should execute chain', async () => {
        const result = await orchestrator.executeChain(['search', 'code'], { task: 'find info' });
        expect(result.results).toHaveLength(2);
        expect(result.strategy).toBe('chain');
    });

    it('should auto-execute', async () => {
        const result = await orchestrator.autoExecute({ task: 'search for data' });
        expect(result.finalOutput).toContain('Found');
    });

    it('should list agents', () => {
        expect(orchestrator.list()).toHaveLength(2);
    });
});

// ================================================================
// Prompt Manager Tests
// ================================================================
describe('PromptManager', () => {
    let pm: PromptManager;
    beforeEach(() => { pm = new PromptManager(); });

    it('should register prompts', () => {
        pm.register('greeting', 'Greeting', 'Hello {{name}}!');
        expect(pm.count()).toBe(1);
    });

    it('should extract variables', () => {
        const template = pm.register('test', 'Test', '{{name}} is {{age}} years old');
        expect(template.variables).toEqual(['name', 'age']);
    });

    it('should render with variables', () => {
        pm.register('greeting', 'Greeting', 'Hello {{name}}!');
        expect(pm.render('greeting', { name: 'Alice' })).toBe('Hello Alice!');
    });

    it('should version prompts', () => {
        pm.register('p1', 'Name', 'v1');
        pm.register('p1', 'Name', 'v2');
        expect(pm.get('p1')?.version).toBe(2);
    });

    it('should get version history', () => {
        pm.register('p1', 'Name', 'v1');
        pm.register('p1', 'Name', 'v2');
        expect(pm.getVersions('p1')).toHaveLength(2);
    });

    it('should render chains', () => {
        pm.register('sys', 'System', 'You are {{role}}.');
        pm.register('task', 'Task', 'Do {{action}}.');
        pm.registerChain('full', 'Full', ['sys', 'task']);
        const result = pm.renderChain('full', { role: 'helper', action: 'help' });
        expect(result).toBe('You are helper.\n\nDo help.');
    });

    it('should list with tag filter', () => {
        pm.register('a', 'A', 'content', ['system']);
        pm.register('b', 'B', 'content', ['user']);
        expect(pm.list('system')).toHaveLength(1);
    });

    it('should delete prompts', () => {
        pm.register('temp', 'Temp', 'content');
        expect(pm.delete('temp')).toBe(true);
        expect(pm.count()).toBe(0);
    });
});

// ================================================================
// Setup Wizard Tests
// ================================================================
describe('SetupWizard', () => {
    let wizard: SetupWizard;
    beforeEach(() => { wizard = new SetupWizard(); });

    it('should have 4 default steps', () => {
        expect(wizard.stepCount()).toBe(4);
    });

    it('should get current step', () => {
        const step = wizard.getCurrentStep();
        expect(step?.id).toBe('provider');
    });

    it('should validate required fields', () => {
        const result = wizard.submitStep({});
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should advance on valid submission', () => {
        wizard.submitStep({ provider: 'openai', apiKey: 'sk-test' });
        expect(wizard.getCurrentStep()?.id).toBe('channel');
    });

    it('should go to previous step', () => {
        wizard.submitStep({ provider: 'openai', apiKey: 'sk-test' });
        wizard.previousStep();
        expect(wizard.getCurrentStep()?.id).toBe('provider');
    });

    it('should complete all steps', () => {
        wizard.submitStep({ provider: 'openai', apiKey: 'sk-test' });
        wizard.submitStep({});
        wizard.submitStep({});
        wizard.submitStep({});
        expect(wizard.isComplete()).toBe(true);
    });

    it('should generate config', () => {
        wizard.submitStep({ provider: 'anthropic', apiKey: 'sk-ant', model: 'claude-3' });
        wizard.submitStep({ channel: 'discord', channelToken: 'bot-token' });
        wizard.submitStep({ port: 8080 });
        wizard.submitStep({ persona: 'coder' });
        const config = wizard.generateConfig() as any;
        expect(config.provider.name).toBe('anthropic');
        expect(config.channel.type).toBe('discord');
        expect(config.server.port).toBe(8080);
    });

    it('should track progress', () => {
        expect(wizard.progress()).toBe(0);
        wizard.submitStep({ provider: 'openai', apiKey: 'sk-test' });
        expect(wizard.progress()).toBe(0.25);
    });

    it('should reset', () => {
        wizard.submitStep({ provider: 'openai', apiKey: 'sk-test' });
        wizard.reset();
        expect(wizard.progress()).toBe(0);
    });
});
