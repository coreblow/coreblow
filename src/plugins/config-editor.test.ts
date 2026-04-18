/**
 * plugins/config-editor.test.ts
 *
 * Comprehensive test suite for ConfigEditor.
 * Tests schema registration, read/edit, preview/diff, reset,
 * history/undo, presets, export/import, stats, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigEditor } from './config-editor.js';
import type { ManifestConfigField } from './manifest.js';

// ─── Fixtures ────────────────────────────────────────────────────

const SAMPLE_SCHEMA: ManifestConfigField[] = [
    { key: 'apiKey', type: 'password', label: 'API Key', required: true, description: 'Your API key' },
    { key: 'timeout', type: 'number', label: 'Timeout (ms)', default: 5000, validation: { min: 100, max: 60000 } },
    { key: 'debug', type: 'boolean', label: 'Debug Mode', default: false },
    { key: 'region', type: 'select', label: 'Region', options: ['us', 'eu', 'asia'], default: 'us' },
    { key: 'tags', type: 'array', label: 'Tags', default: [] },
];

// ─── Tests ───────────────────────────────────────────────────────

describe('ConfigEditor', () => {
    let editor: ConfigEditor;

    beforeEach(() => {
        editor = new ConfigEditor();
        editor.registerSchema('weather', SAMPLE_SCHEMA);
    });

    // ════════════════════════════════════════════════════════════
    // Schema Registration (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('schema registration', () => {
        it('should register schema', () => {
            expect(editor.hasSchema('weather')).toBe(true);
        });

        it('should return null for unregistered schema', () => {
            expect(editor.getSchema('unknown')).toBeNull();
        });

        it('should get schema fields', () => {
            const schema = editor.getSchema('weather');
            expect(schema).toHaveLength(5);
        });

        it('should get field metadata for UI', () => {
            const metas = editor.getFieldMetas('weather');
            expect(metas).toHaveLength(5);
            expect(metas[0].key).toBe('apiKey');
            expect(metas[0].sensitive).toBe(true);
            expect(metas[0].required).toBe(true);
            expect(metas[1].default).toBe(5000);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Read Config (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('read config', () => {
        it('should return defaults when no config set', () => {
            const config = editor.getConfig('weather');
            expect(config.timeout).toBe(5000);
            expect(config.debug).toBe(false);
            expect(config.region).toBe('us');
        });

        it('should return empty for unknown plugin', () => {
            const config = editor.getConfig('unknown');
            expect(Object.keys(config)).toHaveLength(0);
        });

        it('should get single field', () => {
            expect(editor.getField('weather', 'timeout')).toBe(5000);
        });

        it('should merge user config with defaults', () => {
            editor.setConfig('weather', { apiKey: 'abc123', timeout: 3000 });
            const config = editor.getConfig('weather');
            expect(config.apiKey).toBe('abc123');
            expect(config.timeout).toBe(3000);
            expect(config.debug).toBe(false); // default
        });
    });

    // ════════════════════════════════════════════════════════════
    // Edit Config (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('edit config', () => {
        it('should set full config', () => {
            const result = editor.setConfig('weather', { apiKey: 'key123', timeout: 2000 });
            expect(result.valid).toBe(true);
            expect(editor.getConfig('weather').apiKey).toBe('key123');
        });

        it('should set single field', () => {
            editor.setConfig('weather', { apiKey: 'key123' });
            const result = editor.setField('weather', 'timeout', 8000);
            expect(result.valid).toBe(true);
            expect(editor.getField('weather', 'timeout')).toBe(8000);
        });

        it('should validate on set', () => {
            const result = editor.setConfig('weather', { timeout: -1 });
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should remove single field', () => {
            editor.setConfig('weather', { apiKey: 'key', timeout: 8000 });
            editor.removeField('weather', 'timeout');
            // Should revert to default
            expect(editor.getField('weather', 'timeout')).toBe(5000);
        });

        it('should increment edit count', () => {
            editor.setConfig('weather', { apiKey: 'a' });
            editor.setConfig('weather', { apiKey: 'b' });
            expect(editor.getStats().totalEdits).toBe(2);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Preview & Diff (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('preview and diff', () => {
        it('should preview valid change', () => {
            editor.setConfig('weather', { apiKey: 'old' });
            const preview = editor.preview('weather', { apiKey: 'new', timeout: 3000 });
            expect(preview.valid).toBe(true);
            expect(preview.diff.some((d) => d.field === 'apiKey' && d.type === 'changed')).toBe(true);
        });

        it('should preview invalid change', () => {
            const preview = editor.preview('weather', { timeout: -1 });
            expect(preview.errors.length).toBeGreaterThan(0);
        });

        it('should compute diff', () => {
            editor.setConfig('weather', { apiKey: 'key', timeout: 5000 });
            const diffs = editor.diff('weather', { apiKey: 'key', timeout: 8000 });
            const timeoutDiff = diffs.find((d) => d.field === 'timeout');
            expect(timeoutDiff).toBeDefined();
            expect(timeoutDiff!.type).toBe('changed');
            expect(timeoutDiff!.oldValue).toBe(5000);
            expect(timeoutDiff!.newValue).toBe(8000);
        });

        it('should detect added fields in diff', () => {
            editor.setConfig('weather', { apiKey: 'key' });
            const diffs = editor.diff('weather', { apiKey: 'key', timeout: 5000, newField: 'x' });
            expect(diffs.some((d) => d.field === 'newField' && d.type === 'added')).toBe(true);
        });

        it('should detect unchanged fields', () => {
            editor.setConfig('weather', { apiKey: 'key' });
            const diffs = editor.diff('weather', { apiKey: 'key' });
            expect(diffs.some((d) => d.field === 'apiKey' && d.type === 'unchanged')).toBe(true);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Reset (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('reset', () => {
        it('should reset to defaults', () => {
            editor.setConfig('weather', { apiKey: 'key', timeout: 9999 });
            editor.resetToDefaults('weather');
            expect(editor.getField('weather', 'timeout')).toBe(5000);
            expect(editor.getField('weather', 'debug')).toBe(false);
        });

        it('should reset single field', () => {
            editor.setConfig('weather', { apiKey: 'key', timeout: 9999 });
            const val = editor.resetField('weather', 'timeout');
            expect(val).toBe(5000);
            expect(editor.getField('weather', 'timeout')).toBe(5000);
        });

        it('should return undefined for unknown field reset', () => {
            expect(editor.resetField('weather', 'nonexistent')).toBeUndefined();
        });
    });

    // ════════════════════════════════════════════════════════════
    // History & Undo (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('history and undo', () => {
        it('should track history', () => {
            editor.setConfig('weather', { apiKey: 'v1' });
            editor.setConfig('weather', { apiKey: 'v2' });
            const history = editor.getHistory('weather');
            expect(history.length).toBeGreaterThanOrEqual(2);
        });

        it('should undo last change', () => {
            editor.setConfig('weather', { apiKey: 'v1', timeout: 1000 });
            editor.setConfig('weather', { apiKey: 'v2', timeout: 2000 });
            editor.undo('weather');
            expect(editor.getField('weather', 'apiKey')).toBe('v1');
        });

        it('should revert to specific history entry', () => {
            editor.setConfig('weather', { apiKey: 'v1' });
            editor.setConfig('weather', { apiKey: 'v2' });
            editor.setConfig('weather', { apiKey: 'v3' });
            editor.revertToHistory('weather', 0);
            expect(editor.getField('weather', 'apiKey')).toBe('v1');
        });

        it('should return null for invalid undo', () => {
            expect(editor.undo('unknown')).toBeNull();
        });
    });

    // ════════════════════════════════════════════════════════════
    // Presets (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('presets', () => {
        it('should save preset', () => {
            editor.setConfig('weather', { apiKey: 'key', timeout: 3000 });
            const preset = editor.savePreset('weather', 'fast', 'Fast config');
            expect(preset.name).toBe('fast');
            expect(preset.config.timeout).toBe(3000);
        });

        it('should load preset', () => {
            editor.setConfig('weather', { apiKey: 'key', timeout: 3000 });
            editor.savePreset('weather', 'fast');
            editor.setConfig('weather', { apiKey: 'key', timeout: 9000 });
            editor.loadPreset('weather', 'fast');
            expect(editor.getField('weather', 'timeout')).toBe(3000);
        });

        it('should list presets', () => {
            editor.setConfig('weather', { apiKey: 'key' });
            editor.savePreset('weather', 'a');
            editor.savePreset('weather', 'b');
            expect(editor.getPresets('weather')).toHaveLength(2);
        });

        it('should delete preset', () => {
            editor.savePreset('weather', 'test');
            expect(editor.deletePreset('weather', 'test')).toBe(true);
            expect(editor.getPresets('weather')).toHaveLength(0);
        });

        it('should return null loading nonexistent preset', () => {
            expect(editor.loadPreset('weather', 'nope')).toBeNull();
        });
    });

    // ════════════════════════════════════════════════════════════
    // Export / Import (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('export and import', () => {
        it('should export bundle', () => {
            editor.setConfig('weather', { apiKey: 'key' });
            const bundle = editor.exportBundle();
            expect(bundle.configs['weather']).toBeDefined();
            expect(bundle.version).toBe('1.0.0');
        });

        it('should import bundle', () => {
            const bundle = editor.exportBundle();
            bundle.configs['newPlugin'] = { setting: 'value' };

            const newEditor = new ConfigEditor();
            const result = newEditor.importBundle(bundle);
            expect(result.imported).toBeGreaterThanOrEqual(1);
            expect(newEditor.getConfig('newPlugin').setting).toBe('value');
        });

        it('should import presets from bundle', () => {
            editor.setConfig('weather', { apiKey: 'key' });
            editor.savePreset('weather', 'saved');
            const bundle = editor.exportBundle();

            const newEditor = new ConfigEditor();
            newEditor.registerSchema('weather', SAMPLE_SCHEMA);
            newEditor.importBundle(bundle);
            expect(newEditor.getPresets('weather')).toHaveLength(1);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Stats & Management (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('stats and management', () => {
        it('should get stats', () => {
            editor.setConfig('weather', { apiKey: 'key' });
            const stats = editor.getStats();
            expect(stats.totalPlugins).toBe(1);
            expect(stats.totalEdits).toBe(1);
        });

        it('should get configured plugins', () => {
            editor.setConfig('weather', { apiKey: 'key' });
            expect(editor.getConfiguredPlugins()).toContain('weather');
        });

        it('should remove plugin', () => {
            editor.setConfig('weather', { apiKey: 'key' });
            editor.savePreset('weather', 'test');
            editor.removePlugin('weather');
            expect(editor.hasSchema('weather')).toBe(false);
            expect(editor.getConfiguredPlugins()).not.toContain('weather');
        });

        it('should clear all data', () => {
            editor.setConfig('weather', { apiKey: 'key' });
            editor.clear();
            expect(editor.getConfiguredPlugins()).toHaveLength(0);
            expect(editor.getStats().totalEdits).toBe(0);
        });
    });
});
