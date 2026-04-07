/**
 * Wave 6 — Plugin CLI + Scaffold Tests
 *
 * Tests for: plugin-sdk/cli-scaffold.ts, cli/plugin-commands.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginScaffold } from '../../src/plugin-sdk/cli-scaffold.js';
import { PluginCommands } from '../../src/cli/plugin-commands.js';
import { createPluginRecord, createEmptyPluginRegistryData } from '../../src/plugins/types.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ═══════════════════════════════════════════════════════════════════
// PluginScaffold
// ═══════════════════════════════════════════════════════════════════

describe('PluginScaffold', () => {
    let scaffold: PluginScaffold;
    let tmpDir: string;

    beforeEach(() => {
        scaffold = new PluginScaffold();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('validateName', () => {
        it('should accept valid names', () => {
            expect(scaffold.validateName('my-plugin').valid).toBe(true);
            expect(scaffold.validateName('weather').valid).toBe(true);
            expect(scaffold.validateName('a1b2').valid).toBe(true);
        });

        it('should reject empty names', () => {
            expect(scaffold.validateName('').valid).toBe(false);
        });

        it('should reject uppercase names', () => {
            expect(scaffold.validateName('MyPlugin').valid).toBe(false);
        });

        it('should reject names starting with number', () => {
            expect(scaffold.validateName('1plugin').valid).toBe(false);
        });

        it('should reject coreblow- prefix', () => {
            expect(scaffold.validateName('coreblow-test').valid).toBe(false);
        });

        it('should reject too-long names', () => {
            expect(scaffold.validateName('a'.repeat(51)).valid).toBe(false);
        });
    });

    describe('listTemplates', () => {
        it('should return 5 templates', () => {
            const templates = scaffold.listTemplates();
            expect(templates).toHaveLength(5);
            expect(templates.map((t) => t.name)).toContain('basic');
            expect(templates.map((t) => t.name)).toContain('full');
        });
    });

    describe('generate — basic template', () => {
        it('should generate project files', () => {
            const targetDir = path.join(tmpDir, 'test-plugin');
            const result = scaffold.generate({ name: 'test-plugin', targetDir, template: 'basic' });
            expect(result.success).toBe(true);
            expect(result.filesCreated).toContain('plugin.json');
            expect(result.filesCreated).toContain('package.json');
            expect(result.filesCreated).toContain('tsconfig.json');
            expect(result.filesCreated).toContain('src/index.ts');
            expect(result.filesCreated).toContain('README.md');
        });

        it('should create valid plugin.json', () => {
            const targetDir = path.join(tmpDir, 'test-plugin');
            scaffold.generate({ name: 'test-plugin', targetDir });
            const manifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'plugin.json'), 'utf-8'));
            expect(manifest.name).toBe('test-plugin');
            expect(manifest.version).toBe('0.1.0');
        });

        it('should create valid package.json', () => {
            const targetDir = path.join(tmpDir, 'test-plugin');
            scaffold.generate({ name: 'test-plugin', targetDir });
            const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf-8'));
            expect(pkg.name).toBe('coreblow-plugin-test-plugin');
            expect(pkg.scripts.build).toBe('tsc');
        });
    });

    describe('generate — tool template', () => {
        it('should include tools.ts', () => {
            const targetDir = path.join(tmpDir, 'tool-plugin');
            const result = scaffold.generate({ name: 'tool-plugin', targetDir, template: 'tool' });
            expect(result.success).toBe(true);
            expect(result.filesCreated).toContain('src/tools.ts');
        });
    });

    describe('generate — full template', () => {
        it('should include all optional files', () => {
            const targetDir = path.join(tmpDir, 'full-plugin');
            const result = scaffold.generate({ name: 'full-plugin', targetDir, template: 'full' });
            expect(result.success).toBe(true);
            expect(result.filesCreated).toContain('src/tools.ts');
            expect(result.filesCreated).toContain('src/hooks.ts');
            expect(result.filesCreated).toContain('src/commands.ts');
            expect(result.filesCreated).toContain('src/config.ts');
            expect(result.filesCreated).toContain('tests/plugin.test.ts');
        });
    });

    describe('overwrite', () => {
        it('should fail if directory exists without overwrite', () => {
            const targetDir = path.join(tmpDir, 'existing');
            fs.mkdirSync(targetDir);
            const result = scaffold.generate({ name: 'existing', targetDir });
            expect(result.success).toBe(false);
        });

        it('should succeed with overwrite flag', () => {
            const targetDir = path.join(tmpDir, 'existing');
            fs.mkdirSync(targetDir);
            const result = scaffold.generate({ name: 'existing', targetDir, overwrite: true });
            expect(result.success).toBe(true);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginCommands
// ═══════════════════════════════════════════════════════════════════

describe('PluginCommands', () => {
    let commands: PluginCommands;
    let tmpDir: string;
    let registryData: ReturnType<typeof createEmptyPluginRegistryData>;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-cmd-'));
        registryData = createEmptyPluginRegistryData();
        registryData.plugins.push(
            createPluginRecord({ id: 'weather', name: 'Weather', source: '/tmp', origin: 'bundled', enabled: true, version: '1.0.0' }),
            createPluginRecord({ id: 'translate', name: 'Translate', source: '/tmp', origin: 'workspace', enabled: false, version: '2.0.0' }),
        );
        commands = new PluginCommands({ registryData, pluginsDir: tmpDir });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('help', () => {
        it('should return help text', async () => {
            const result = await commands.execute('help', []);
            expect(result.success).toBe(true);
            expect(result.output).toContain('/plugin create');
            expect(result.output).toContain('/plugin install');
        });

        it('should show help for unknown subcommands', async () => {
            const result = await commands.execute('unknown', []);
            expect(result.success).toBe(true);
            expect(result.output).toContain('Plugin Commands');
        });
    });

    describe('create', () => {
        it('should scaffold a new plugin', async () => {
            // Override workspaceDir so scaffold creates in tmpDir
            const targetName = 'my-cli-test';
            const targetDir = path.join(tmpDir, targetName);
            const scaffold = commands.getScaffold();
            const scaffoldResult = scaffold.generate({ name: targetName, targetDir, template: 'basic' });
            expect(scaffoldResult.success).toBe(true);
            expect(scaffoldResult.filesCreated).toContain('plugin.json');
        });

        it('should fail without name', async () => {
            const result = await commands.execute('create', []);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Usage');
        });

        it('should fail with invalid name', async () => {
            const result = await commands.execute('create', ['INVALID']);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid');
        });
    });

    describe('list', () => {
        it('should list plugins', async () => {
            const result = await commands.execute('list', []);
            expect(result.success).toBe(true);
            expect(result.output).toContain('Weather');
            expect(result.output).toContain('Translate');
        });

        it('should output JSON when --json', async () => {
            const result = await commands.execute('list', [], { json: true });
            expect(result.success).toBe(true);
            const parsed = JSON.parse(result.output);
            expect(parsed).toHaveLength(2);
        });

        it('should show empty state', async () => {
            const emptyCmd = new PluginCommands({ registryData: createEmptyPluginRegistryData() });
            const result = await emptyCmd.execute('list', []);
            expect(result.output).toContain('No plugins');
        });
    });

    describe('status', () => {
        it('should show overall status', async () => {
            const result = await commands.execute('status', []);
            expect(result.success).toBe(true);
            expect(result.output).toContain('Plugin Status');
        });

        it('should show specific plugin status', async () => {
            const result = await commands.execute('status', ['weather']);
            expect(result.success).toBe(true);
            expect(result.output).toContain('Weather');
            expect(result.output).toContain('loaded');
        });

        it('should error for unknown plugin', async () => {
            const result = await commands.execute('status', ['nonexistent']);
            expect(result.success).toBe(false);
        });
    });

    describe('enable / disable', () => {
        it('should enable a disabled plugin', async () => {
            const result = await commands.execute('enable', ['translate']);
            expect(result.success).toBe(true);
            expect(result.output).toContain('enabled');
        });

        it('should disable an enabled plugin', async () => {
            const result = await commands.execute('disable', ['weather']);
            expect(result.success).toBe(true);
            expect(result.output).toContain('disabled');
        });

        it('should error for missing plugin', async () => {
            const result = await commands.execute('enable', ['nonexistent']);
            expect(result.success).toBe(false);
        });
    });

    describe('search', () => {
        it('should search marketplace', async () => {
            commands.getMarketplace().loadCatalog([
                { id: 'weather-pro', name: 'Weather Pro', version: '1.0.0', description: 'Advanced weather', tags: ['weather'], downloads: 100 },
            ]);
            const result = await commands.execute('search', ['weather']);
            expect(result.success).toBe(true);
            expect(result.output).toContain('Weather Pro');
        });

        it('should show no results', async () => {
            const result = await commands.execute('search', ['nonexistent-xyz']);
            expect(result.success).toBe(true);
            expect(result.output).toContain('No plugins found');
        });

        it('should error without query', async () => {
            const result = await commands.execute('search', []);
            expect(result.success).toBe(false);
        });
    });

    describe('info', () => {
        it('should show plugin info', async () => {
            const result = await commands.execute('info', ['weather']);
            expect(result.success).toBe(true);
            expect(result.output).toContain('Weather');
        });

        it('should error for unknown plugin', async () => {
            const result = await commands.execute('info', ['unknown']);
            expect(result.success).toBe(false);
        });
    });

    describe('doctor', () => {
        it('should show diagnostic status', async () => {
            const result = await commands.execute('doctor', []);
            expect(result.success).toBe(true);
            expect(result.output).toContain('Plugin Doctor');
            expect(result.output).toContain('Plugins:');
        });
    });

    describe('templates', () => {
        it('should list templates', async () => {
            const result = await commands.execute('templates', []);
            expect(result.success).toBe(true);
            expect(result.output).toContain('basic');
            expect(result.output).toContain('full');
        });
    });
});
