/**
 * channels/thread-bindings.test.ts — Thread binding tests
 */
import { describe, it, expect } from 'vitest';
import { ThreadBindingRegistry, resolveThreadBindingLifecycle } from './thread-bindings.js';

describe('Thread Binding Registry', () => {
    it('binds and resolves', () => {
        const registry = new ThreadBindingRegistry();
        registry.bind({ threadId: 't1', channelId: 'discord', targetId: 'session-1' });
        const binding = registry.resolve('discord', 't1');
        expect(binding).not.toBeNull();
        expect(binding!.targetId).toBe('session-1');
        expect(binding!.targetKind).toBe('session');
    });

    it('unbinds', () => {
        const registry = new ThreadBindingRegistry();
        registry.bind({ threadId: 't1', channelId: 'discord', targetId: 's1' });
        expect(registry.unbind('discord', 't1')).toBe(true);
        expect(registry.resolve('discord', 't1')).toBeNull();
    });

    it('lists for channel', () => {
        const registry = new ThreadBindingRegistry();
        registry.bind({ threadId: 't1', channelId: 'discord', targetId: 's1' });
        registry.bind({ threadId: 't2', channelId: 'discord', targetId: 's2' });
        registry.bind({ threadId: 't3', channelId: 'telegram', targetId: 's3' });
        expect(registry.listForChannel('discord')).toHaveLength(2);
        expect(registry.listForChannel('telegram')).toHaveLength(1);
    });

    it('lists for target', () => {
        const registry = new ThreadBindingRegistry();
        registry.bind({ threadId: 't1', channelId: 'discord', targetId: 'agent-1' });
        registry.bind({ threadId: 't2', channelId: 'telegram', targetId: 'agent-1' });
        expect(registry.listForTarget('agent-1')).toHaveLength(2);
    });

    it('enforces max bindings per channel', () => {
        const registry = new ThreadBindingRegistry({ maxBindingsPerChannel: 2 });
        registry.bind({ threadId: 't1', channelId: 'discord', targetId: 's1' });
        registry.bind({ threadId: 't2', channelId: 'discord', targetId: 's2' });
        registry.bind({ threadId: 't3', channelId: 'discord', targetId: 's3' });
        expect(registry.listForChannel('discord')).toHaveLength(2);
        expect(registry.resolve('discord', 't1')).toBeNull(); // oldest removed
    });

    it('prunes expired bindings', async () => {
        const registry = new ThreadBindingRegistry({ bindingTtlMs: 50 });
        registry.bind({ threadId: 't1', channelId: 'discord', targetId: 's1' });
        await new Promise((r) => setTimeout(r, 100));
        expect(registry.resolve('discord', 't1')).toBeNull();
    });

    it('clears all', () => {
        const registry = new ThreadBindingRegistry();
        registry.bind({ threadId: 't1', channelId: 'discord', targetId: 's1' });
        registry.clear();
        expect(registry.size()).toBe(0);
    });
});

describe('resolveThreadBindingLifecycle', () => {
    it('returns defaults', () => {
        const policy = resolveThreadBindingLifecycle();
        expect(policy.defaultTargetKind).toBe('session');
        expect(policy.autoBindOnCreate).toBe(true);
    });

    it('uses config overrides', () => {
        const policy = resolveThreadBindingLifecycle({ threads: { defaultTargetKind: 'agent', autoBindOnCreate: false } });
        expect(policy.defaultTargetKind).toBe('agent');
        expect(policy.autoBindOnCreate).toBe(false);
    });
});
