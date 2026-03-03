import { describe, it, expect, vi } from 'vitest';
import { BootstrapHooks, type BootstrapHookContext } from './bootstrap-hooks.js';

describe('Bootstrap Hooks', () => {
    it('registers and fires hooks', async () => {
        const hooks = new BootstrapHooks();
        const calls: string[] = [];
        hooks.register('pre_init', () => { calls.push('pre_init'); });
        hooks.register('post_init', () => { calls.push('post_init'); });
        await hooks.fire({ phase: 'pre_init', sessionId: 's1', agentId: 'a1' });
        await hooks.fire({ phase: 'post_init', sessionId: 's1', agentId: 'a1' });
        expect(calls).toEqual(['pre_init', 'post_init']);
    });

    it('fires multiple hooks for same phase in order', async () => {
        const hooks = new BootstrapHooks();
        const order: number[] = [];
        hooks.register('pre_turn', () => { order.push(1); });
        hooks.register('pre_turn', () => { order.push(2); });
        hooks.register('pre_turn', () => { order.push(3); });
        await hooks.fire({ phase: 'pre_turn', sessionId: 's', agentId: 'a' });
        expect(order).toEqual([1, 2, 3]);
    });

    it('handles async hooks', async () => {
        const hooks = new BootstrapHooks();
        let result = '';
        hooks.register('post_turn', async () => {
            await new Promise((r) => setTimeout(r, 10));
            result = 'done';
        });
        await hooks.fire({ phase: 'post_turn', sessionId: 's', agentId: 'a' });
        expect(result).toBe('done');
    });

    it('counts hooks', () => {
        const hooks = new BootstrapHooks();
        hooks.register('pre_init', () => {});
        hooks.register('pre_init', () => {});
        hooks.register('post_init', () => {});
        expect(hooks.count('pre_init')).toBe(2);
        expect(hooks.count('post_init')).toBe(1);
        expect(hooks.count()).toBe(3);
    });

    it('clears hooks by phase', () => {
        const hooks = new BootstrapHooks();
        hooks.register('pre_init', () => {});
        hooks.register('post_init', () => {});
        hooks.clear('pre_init');
        expect(hooks.count('pre_init')).toBe(0);
        expect(hooks.count('post_init')).toBe(1);
    });

    it('clears all hooks', () => {
        const hooks = new BootstrapHooks();
        hooks.register('pre_init', () => {});
        hooks.register('post_init', () => {});
        hooks.clear();
        expect(hooks.count()).toBe(0);
    });

    it('passes context to hook', async () => {
        const hooks = new BootstrapHooks();
        let captured: BootstrapHookContext | null = null;
        hooks.register('pre_shutdown', (ctx) => { captured = ctx; });
        await hooks.fire({ phase: 'pre_shutdown', sessionId: 's1', agentId: 'a1', metadata: { key: 'val' } });
        expect(captured).not.toBeNull();
        expect(captured!.sessionId).toBe('s1');
        expect(captured!.metadata?.key).toBe('val');
    });

    it('no-op when no hooks registered', async () => {
        const hooks = new BootstrapHooks();
        // Should not throw
        await hooks.fire({ phase: 'post_shutdown', sessionId: 's', agentId: 'a' });
    });
});
