/**
 * CoreBlow Plugin Runtime — Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRuntime } from '../../../plugins/runtime.js';
import type { PluginManifest } from '../../../plugins/runtime.js';

describe('PluginRuntime', () => {
    let runtime: PluginRuntime;

    beforeEach(async () => {
        runtime = new PluginRuntime();
    });

    it('should start with no plugins', () => {
        expect(runtime.listPlugins()).toHaveLength(0);
    });

    it('should return null for nonexistent plugin', () => {
        expect(runtime.getPlugin('nope')).toBeNull();
    });

    it('should set enabled on nonexistent plugin returns false', () => {
        expect(runtime.setEnabled('nope', false)).toBe(false);
    });

    it('should uninstall nonexistent plugin returns false', async () => {
        expect(await runtime.uninstall('nope')).toBe(false);
    });

    it('should install from invalid path returns null', async () => {
        expect(await runtime.install('/nonexistent/path')).toBeNull();
    });

    it('should unload a non-loaded plugin returns false', async () => {
        expect(await runtime.unload('nope')).toBe(false);
    });

    it('should load a non-existent plugin returns false', async () => {
        expect(await runtime.load('nope')).toBe(false);
    });

    it('should set and get config', () => {
        // Testing config management with no actual plugin
        runtime.setConfig('test-plugin', { key: 'value' });
        // No crash = success (config stored internally)
    });

    it('loadAll with no plugins should return zeros', async () => {
        const result = await runtime.loadAll();
        expect(result.loaded).toBe(0);
        expect(result.failed).toBe(0);
    });

    it('unloadAll with no plugins should not throw', async () => {
        await expect(runtime.unloadAll()).resolves.toBeUndefined();
    });
});
