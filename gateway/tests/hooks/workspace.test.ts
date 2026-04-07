import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    loadHookEntriesFromDir,
    discoverWorkspaceHookEntries,
    buildWorkspaceHookSnapshot,
} from '../../src/hooks/workspace.js';

function createTestHookDir(baseDir: string, hookName: string, opts: {
    frontmatter?: Record<string, string>;
    hasHandler?: boolean;
} = {}): string {
    const hookDir = path.join(baseDir, hookName);
    fs.mkdirSync(hookDir, { recursive: true });

    const fm = opts.frontmatter ?? { name: hookName, events: 'test:event', enabled: 'true' };
    const fmLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
    const content = `---\n${fmLines.join('\n')}\n---\n# ${hookName}\nDo stuff`;
    fs.writeFileSync(path.join(hookDir, 'HOOK.md'), content);

    if (opts.hasHandler !== false) {
        fs.writeFileSync(path.join(hookDir, 'handler.ts'), `export default function() {}`);
    }

    return hookDir;
}

describe('hooks/workspace', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = path.join('/tmp', `hooks-ws-test-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('loadHookEntriesFromDir', () => {
        it('loads hooks from a directory', () => {
            createTestHookDir(tmpDir, 'my-hook');
            const entries = loadHookEntriesFromDir({ dir: tmpDir, source: 'coreblow-bundled' });
            expect(entries).toHaveLength(1);
            expect(entries[0].hook.name).toBe('my-hook');
            expect(entries[0].hook.source).toBe('coreblow-bundled');
        });

        it('skips directories without HOOK.md', () => {
            fs.mkdirSync(path.join(tmpDir, 'empty-dir'), { recursive: true });
            const entries = loadHookEntriesFromDir({ dir: tmpDir, source: 'coreblow-bundled' });
            expect(entries).toHaveLength(0);
        });

        it('skips hooks without handler file', () => {
            createTestHookDir(tmpDir, 'no-handler', { hasHandler: false });
            const entries = loadHookEntriesFromDir({ dir: tmpDir, source: 'coreblow-bundled' });
            expect(entries).toHaveLength(0);
        });

        it('skips hidden directories', () => {
            createTestHookDir(tmpDir, '.hidden-hook');
            const entries = loadHookEntriesFromDir({ dir: tmpDir, source: 'coreblow-bundled' });
            expect(entries).toHaveLength(0);
        });

        it('returns empty for non-existent directory', () => {
            const entries = loadHookEntriesFromDir({ dir: '/nonexistent', source: 'coreblow-bundled' });
            expect(entries).toEqual([]);
        });

        it('resolves metadata from frontmatter', () => {
            createTestHookDir(tmpDir, 'meta-hook', {
                frontmatter: { name: 'Meta Hook', events: 'command:new,session:start', emoji: '🚀' },
            });
            const entries = loadHookEntriesFromDir({ dir: tmpDir, source: 'coreblow-workspace' });
            expect(entries[0].metadata?.events).toEqual(['command:new', 'session:start']);
            expect(entries[0].metadata?.emoji).toBe('🚀');
        });

        it('resolves invocation policy', () => {
            createTestHookDir(tmpDir, 'enabled-hook', {
                frontmatter: { name: 'test', events: 'a', enabled: 'false' },
            });
            const entries = loadHookEntriesFromDir({ dir: tmpDir, source: 'coreblow-bundled' });
            expect(entries[0].invocation?.enabled).toBe(false);
        });

        it('sets pluginId when provided', () => {
            createTestHookDir(tmpDir, 'plugin-hook');
            const entries = loadHookEntriesFromDir({ dir: tmpDir, source: 'coreblow-plugin', pluginId: 'my-plugin' });
            expect(entries[0].hook.pluginId).toBe('my-plugin');
        });
    });

    describe('discoverWorkspaceHookEntries', () => {
        it('discovers hooks from workspace hooks/ directory', () => {
            const hooksDir = path.join(tmpDir, 'hooks');
            createTestHookDir(hooksDir, 'ws-hook');
            const entries = discoverWorkspaceHookEntries(tmpDir);
            const wsEntries = entries.filter(e => e.hook.source === 'coreblow-workspace');
            expect(wsEntries).toHaveLength(1);
            expect(wsEntries[0].hook.name).toBe('ws-hook');
        });

        it('discovers from managed hooks directory', () => {
            const managedDir = path.join(tmpDir, 'managed-hooks');
            createTestHookDir(managedDir, 'managed-hook');
            const entries = discoverWorkspaceHookEntries(tmpDir, { managedHooksDir: managedDir });
            const managedEntries = entries.filter(e => e.hook.source === 'coreblow-managed');
            expect(managedEntries).toHaveLength(1);
        });

        it('discovers from bundled hooks directory', () => {
            const bundledDir = path.join(tmpDir, 'bundled');
            createTestHookDir(bundledDir, 'bundled-hook');
            const entries = discoverWorkspaceHookEntries(tmpDir, { bundledHooksDir: bundledDir });
            const bundledEntries = entries.filter(e => e.hook.source === 'coreblow-bundled');
            expect(bundledEntries).toHaveLength(1);
        });
    });

    describe('buildWorkspaceHookSnapshot', () => {
        it('builds a serializable snapshot', () => {
            const hooksDir = path.join(tmpDir, 'hooks');
            createTestHookDir(hooksDir, 'snap-hook', {
                frontmatter: { name: 'Snap', events: 'test:a', enabled: 'true' },
            });
            const snapshot = buildWorkspaceHookSnapshot(tmpDir, { snapshotVersion: 42 });
            expect(snapshot.version).toBe(42);
            expect(snapshot.hooks).toBeInstanceOf(Array);
        });
    });
});
