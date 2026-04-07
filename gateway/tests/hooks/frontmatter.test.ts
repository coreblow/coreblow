import { describe, it, expect } from 'vitest';
import { parseFrontmatter, resolveHookMetadata, resolveHookInvocationPolicy, resolveHookKey } from '../../src/hooks/frontmatter.js';

describe('hooks/frontmatter', () => {
    describe('parseFrontmatter', () => {
        it('parses key-value pairs from HOOK.md frontmatter', () => {
            const content = `---
name: Test Hook
description: A test hook
enabled: true
---
# Instructions`;
            const result = parseFrontmatter(content);
            expect(result.name).toBe('Test Hook');
            expect(result.description).toBe('A test hook');
            expect(result.enabled).toBe('true');
        });

        it('returns empty object when no frontmatter', () => {
            const result = parseFrontmatter('Just markdown content');
            expect(Object.keys(result)).toHaveLength(0);
        });

        it('handles missing closing delimiter gracefully', () => {
            const result = parseFrontmatter('---\nname: broken');
            expect(Object.keys(result)).toHaveLength(0);
        });
    });

    describe('resolveHookMetadata', () => {
        it('resolves structured metadata from frontmatter', () => {
            const fm = { name: 'test', events: 'message:received,command:new', os: 'darwin,linux' };
            const meta = resolveHookMetadata(fm);
            expect(meta).toBeDefined();
            expect(meta!.events).toEqual(['message:received', 'command:new']);
            expect(meta!.os).toEqual(['darwin', 'linux']);
        });

        it('returns undefined without name or events', () => {
            const meta = resolveHookMetadata({ description: 'no name or events' });
            expect(meta).toBeUndefined();
        });

        it('resolves always flag', () => {
            const meta = resolveHookMetadata({ name: 'test', always: 'true', events: 'test' });
            expect(meta!.always).toBe(true);
        });

        it('resolves emoji and homepage', () => {
            const meta = resolveHookMetadata({ name: 'test', events: 'a', emoji: '🔥', homepage: 'https://example.com' });
            expect(meta!.emoji).toBe('🔥');
            expect(meta!.homepage).toBe('https://example.com');
        });

        it('resolves hookKey', () => {
            const meta = resolveHookMetadata({ name: 'test', events: 'a', hookKey: 'custom-key' });
            expect(meta!.hookKey).toBe('custom-key');
        });

        it('resolves requires.bins', () => {
            const meta = resolveHookMetadata({ name: 'test', events: 'a', bins: 'git,node' });
            expect(meta!.requires?.bins).toEqual(['git', 'node']);
        });

        it('resolves requires.env', () => {
            const meta = resolveHookMetadata({ name: 'test', events: 'a', env: 'API_KEY,SECRET' });
            expect(meta!.requires?.env).toEqual(['API_KEY', 'SECRET']);
        });

        it('returns empty events array when no events provided', () => {
            const meta = resolveHookMetadata({ name: 'test' });
            expect(meta!.events).toEqual([]);
        });
    });

    describe('resolveHookInvocationPolicy', () => {
        it('returns enabled:true by default', () => {
            const policy = resolveHookInvocationPolicy({});
            expect(policy.enabled).toBe(true);
        });

        it('respects enabled:false', () => {
            const policy = resolveHookInvocationPolicy({ enabled: 'false' });
            expect(policy.enabled).toBe(false);
        });

        it('respects enabled:true', () => {
            const policy = resolveHookInvocationPolicy({ enabled: 'true' });
            expect(policy.enabled).toBe(true);
        });
    });

    describe('resolveHookKey', () => {
        it('returns hookKey from metadata', () => {
            const entry = {
                hook: { name: 'test', description: '', source: 'coreblow-bundled' as const, filePath: '', baseDir: '', handlerPath: '' },
                frontmatter: {},
                metadata: { events: [], hookKey: 'custom' },
            };
            expect(resolveHookKey('test', entry)).toBe('custom');
        });

        it('falls back to hook name', () => {
            expect(resolveHookKey('fallback-name')).toBe('fallback-name');
        });

        it('falls back when metadata has no hookKey', () => {
            const entry = {
                hook: { name: 'test', description: '', source: 'coreblow-bundled' as const, filePath: '', baseDir: '', handlerPath: '' },
                frontmatter: {},
                metadata: { events: [] },
            };
            expect(resolveHookKey('test', entry)).toBe('test');
        });
    });
});
