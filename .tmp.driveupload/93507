/**
 * CoreBlow Phase 37 — Hook Frontmatter Parser Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - parseFrontmatter, resolveHookMetadata, resolveHookInvocationPolicy
 *   - resolveHookKey, edge cases
 */
import { describe, it, expect } from 'vitest';
import {
    parseFrontmatter, resolveHookMetadata,
    resolveHookInvocationPolicy, resolveHookKey,
} from '../../src/hooks/frontmatter.js';

describe('Hook Frontmatter — Extended', () => {

    it('should parse basic frontmatter', () => {
        const content = `---
name: formatter
events: message:received,message:sent
emoji: 🎨
---
# Formatter Hook`;

        const fm = parseFrontmatter(content);
        expect(fm.name).toBe('formatter');
        expect(fm.events).toBe('message:received,message:sent');
        expect(fm.emoji).toBe('🎨');
    });

    it('should return empty object for no frontmatter', () => {
        const fm = parseFrontmatter('No frontmatter here');
        expect(Object.keys(fm)).toHaveLength(0);
    });

    it('should resolve metadata with events', () => {
        const fm = { name: 'test', events: 'a,b,c', emoji: '✅' };
        const meta = resolveHookMetadata(fm);
        expect(meta).toBeDefined();
        expect(meta?.events).toEqual(['a', 'b', 'c']);
        expect(meta?.emoji).toBe('✅');
    });

    it('should resolve metadata with OS requirements', () => {
        const fm = { name: 'darwin-hook', events: 'test', os: 'darwin,linux' };
        const meta = resolveHookMetadata(fm);
        expect(meta?.os).toEqual(['darwin', 'linux']);
    });

    it('should resolve metadata with binary requirements', () => {
        const fm = { name: 'ffmpeg-hook', events: 'media:process', bins: 'ffmpeg,ffprobe' };
        const meta = resolveHookMetadata(fm);
        expect(meta?.requires?.bins).toEqual(['ffmpeg', 'ffprobe']);
    });

    it('should return undefined for missing name and events', () => {
        const fm = { emoji: '🔥' };
        const meta = resolveHookMetadata(fm);
        expect(meta).toBeUndefined();
    });

    it('should resolve invocation policy — enabled by default', () => {
        const policy = resolveHookInvocationPolicy({});
        expect(policy.enabled).toBe(true);
    });

    it('should resolve invocation policy — disabled', () => {
        const policy = resolveHookInvocationPolicy({ enabled: 'false' });
        expect(policy.enabled).toBe(false);
    });

    it('should resolve hook key — from metadata', () => {
        const key = resolveHookKey('fallback-name', {
            hook: { name: 'hook', description: '', source: 'coreblow-bundled', filePath: '', baseDir: '', handlerPath: '' },
            frontmatter: {},
            metadata: { events: [], hookKey: 'custom-key' },
        });
        expect(key).toBe('custom-key');
    });

    it('should resolve hook key — fallback to name', () => {
        const key = resolveHookKey('my-hook');
        expect(key).toBe('my-hook');
    });
});
