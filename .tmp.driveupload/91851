/**
 * extensions/extension-loader.test.ts — Extension loader tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExtensionLoader } from './extension-loader.js';
import type { ExtensionManifest } from './types.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Extension Loader', () => {
    let tmpDir: string;
    let loader: ExtensionLoader;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-test-'));
        loader = new ExtensionLoader();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const manifest: ExtensionManifest = {
        id: 'test-ext',
        name: 'Test Extension',
        version: '1.0.0',
        type: 'tool-provider',
        entrypoint: 'index.js',
    };

    describe('load', () => {
        it('loads extension', async () => {
            const instance = await loader.load(manifest);
            expect(instance.manifest.id).toBe('test-ext');
            expect(instance.enabled).toBe(true);
        });

        it('returns same on duplicate', async () => {
            const a = await loader.load(manifest);
            const b = await loader.load(manifest);
            expect(a).toBe(b);
        });

        it('rejects missing dependency', async () => {
            const depManifest = { ...manifest, id: 'with-dep', dependencies: ['missing'] };
            await expect(loader.load(depManifest)).rejects.toThrow('missing');
        });
    });

    describe('unload', () => {
        it('unloads extension', async () => {
            await loader.load(manifest);
            expect(await loader.unload('test-ext')).toBe(true);
            expect(loader.get('test-ext')).toBeUndefined();
        });

        it('rejects if dependent', async () => {
            await loader.load(manifest);
            await loader.load({ ...manifest, id: 'child', dependencies: ['test-ext'] });
            await expect(loader.unload('test-ext')).rejects.toThrow('child');
        });
    });

    describe('setEnabled', () => {
        it('disables/enables', async () => {
            await loader.load(manifest);
            loader.setEnabled('test-ext', false);
            expect(loader.get('test-ext')!.enabled).toBe(false);
            loader.setEnabled('test-ext', true);
            expect(loader.get('test-ext')!.enabled).toBe(true);
        });

        it('returns false for unknown', () => {
            expect(loader.setEnabled('nope', false)).toBe(false);
        });
    });

    describe('list / listByType', () => {
        it('lists all', async () => {
            await loader.load(manifest);
            await loader.load({ ...manifest, id: 'ext-2', type: 'response-hook' });
            expect(loader.list()).toHaveLength(2);
        });

        it('filters by type', async () => {
            await loader.load(manifest);
            await loader.load({ ...manifest, id: 'ext-2', type: 'response-hook' });
            expect(loader.listByType('tool-provider')).toHaveLength(1);
        });
    });

    describe('discover', () => {
        it('discovers from directory', async () => {
            const extDir = path.join(tmpDir, 'my-ext');
            fs.mkdirSync(extDir, { recursive: true });
            fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest));

            const manifests = await loader.discover(tmpDir);
            expect(manifests).toHaveLength(1);
            expect(manifests[0].id).toBe('test-ext');
        });

        it('returns empty for missing dir', async () => {
            expect(await loader.discover('/nonexistent')).toEqual([]);
        });

        it('skips invalid manifests', async () => {
            const extDir = path.join(tmpDir, 'bad-ext');
            fs.mkdirSync(extDir, { recursive: true });
            fs.writeFileSync(path.join(extDir, 'manifest.json'), 'INVALID JSON');

            const manifests = await loader.discover(tmpDir);
            expect(manifests).toHaveLength(0);
        });
    });

    describe('lifecycle callbacks', () => {
        it('fires on load', async () => {
            const events: string[] = [];
            loader.onLifecycle((event, id) => events.push(`${event}:${id}`));
            await loader.load(manifest);
            expect(events).toContain('load:test-ext');
        });

        it('fires on unload', async () => {
            const events: string[] = [];
            loader.onLifecycle((event, id) => events.push(`${event}:${id}`));
            await loader.load(manifest);
            await loader.unload('test-ext');
            expect(events).toContain('unload:test-ext');
        });
    });
});
