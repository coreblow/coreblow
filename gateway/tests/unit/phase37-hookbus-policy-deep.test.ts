/**
 * CoreBlow Phase 37 — HookBus & HookPolicy Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - HookBus: on/off, fire, wildcard matching, hasListeners, clear
 *   - HookPolicy: source precedence, enable state, collision resolution
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HookBus } from '../../src/hooks/hook-bus.js';
import {
    getHookSourcePolicy, resolveHookEnableState, resolveHookEntries,
    type PolicyHookEntry,
} from '../../src/hooks/policy.js';
import type { Hook, HookEntry } from '../../src/hooks/types.js';

// ================================================================
describe('HookBus — Extended', () => {
    let bus: HookBus;
    beforeEach(() => { bus = new HookBus(); });

    it('should subscribe and fire exact event', async () => {
        const received: unknown[] = [];
        bus.on('message:received', (data) => { received.push(data); });
        await bus.fire('message:received', { text: 'hello' });
        expect(received).toHaveLength(1);
        expect(received[0]).toEqual({ text: 'hello' });
    });

    it('should support type wildcard matching', async () => {
        const received: unknown[] = [];
        bus.on('message:*', (data) => { received.push(data); });
        await bus.fire('message:received', 'a');
        await bus.fire('message:sent', 'b');
        await bus.fire('session:start', 'c'); // should NOT match
        expect(received).toHaveLength(2);
    });

    it('should support global wildcard', async () => {
        const received: unknown[] = [];
        bus.on('*', (data) => { received.push(data); });
        await bus.fire('message:received', 1);
        await bus.fire('session:end', 2);
        await bus.fire('any:thing', 3);
        expect(received).toHaveLength(3);
    });

    it('should unsubscribe a listener', async () => {
        const fn = () => {};
        bus.on('test', fn);
        expect(bus.off('test', fn)).toBe(true);
        expect(bus.listenerCount('test')).toBe(0);
    });

    it('should return false for unsubscribing unknown', () => {
        expect(bus.off('nope', () => {})).toBe(false);
    });

    it('should report hasListeners correctly', () => {
        expect(bus.hasListeners('test')).toBe(false);
        bus.on('test', () => {});
        expect(bus.hasListeners('test')).toBe(true);
    });

    it('should match wildcard in hasListeners', () => {
        bus.on('message:*', () => {});
        expect(bus.hasListeners('message:anything')).toBe(true);
    });

    it('should return all keys', () => {
        bus.on('a', () => {});
        bus.on('b', () => {});
        bus.on('c', () => {});
        expect(bus.keys()).toEqual(['a', 'b', 'c']);
    });

    it('should clear all listeners', () => {
        bus.on('a', () => {});
        bus.on('b', () => {});
        bus.clear();
        expect(bus.keys()).toHaveLength(0);
    });

    it('should swallow errors in listeners', async () => {
        const received: string[] = [];
        bus.on('test', () => { throw new Error('boom'); });
        bus.on('test', () => { received.push('ok'); });
        await bus.fire('test', null);
        expect(received).toEqual(['ok']);
    });
});

// ================================================================
describe('HookPolicy — Extended', () => {
    const makeHook = (name: string, source: Hook['source']): Hook => ({
        name, description: `${name} hook`, source,
        filePath: `/hooks/${name}/HOOK.md`, baseDir: `/hooks/${name}`,
        handlerPath: `/hooks/${name}/handler.ts`,
    });

    const makeEntry = (name: string, source: Hook['source']): PolicyHookEntry => ({
        hook: makeHook(name, source),
        frontmatter: {},
    });

    it('should return correct precedence for sources', () => {
        expect(getHookSourcePolicy('coreblow-bundled').precedence).toBe(10);
        expect(getHookSourcePolicy('coreblow-plugin').precedence).toBe(20);
        expect(getHookSourcePolicy('coreblow-managed').precedence).toBe(30);
        expect(getHookSourcePolicy('coreblow-workspace').precedence).toBe(40);
    });

    it('should enable bundled hooks by default', () => {
        const entry = makeEntry('fmt', 'coreblow-bundled');
        const state = resolveHookEnableState({ entry });
        expect(state.enabled).toBe(true);
    });

    it('should disable workspace hooks by default (opt-in)', () => {
        const entry = makeEntry('custom', 'coreblow-workspace');
        const state = resolveHookEnableState({ entry });
        expect(state.enabled).toBe(false);
        expect(state.reason).toContain('disabled by default');
    });

    it('should enable workspace hook when explicitly opted in', () => {
        const entry = makeEntry('custom', 'coreblow-workspace');
        const state = resolveHookEnableState({
            entry,
            hookConfig: { enabled: true },
        });
        expect(state.enabled).toBe(true);
    });

    it('should disable any hook when config says disabled', () => {
        const entry = makeEntry('fmt', 'coreblow-bundled');
        const state = resolveHookEnableState({
            entry,
            hookConfig: { enabled: false },
        });
        expect(state.enabled).toBe(false);
        expect(state.reason).toContain('disabled in config');
    });

    it('should always enable plugin hooks', () => {
        const entry = makeEntry('plugin-hook', 'coreblow-plugin');
        const state = resolveHookEnableState({
            entry,
            hookConfig: { enabled: false }, // Even this shouldn't matter
        });
        expect(state.enabled).toBe(true);
    });

    it('should resolve collision — higher precedence wins', () => {
        const bundled = makeEntry('format', 'coreblow-bundled');
        const plugin = makeEntry('format', 'coreblow-plugin');
        const collisions: Array<{ name: string }> = [];

        const resolved = resolveHookEntries([bundled, plugin], {
            onCollisionIgnored: (c) => collisions.push(c),
        });

        expect(resolved).toHaveLength(1);
        expect(resolved[0]!.hook.source).toBe('coreblow-plugin');
    });
});
