/**
 * plugins/hooks.test.ts — Plugin hooks tests
 */
import { describe, it, expect } from 'vitest';
import { PluginHooks } from './hooks.js';

describe('PluginHooks', () => {
    it('should register and trigger hooks', async () => {
        const hooks = new PluginHooks();
        let called = false;
        hooks.register('onLoad', () => { called = true; });
        await hooks.trigger('onLoad', {});
        expect(called).toBe(true);
    });

    it('should handle multiple hooks', async () => {
        const hooks = new PluginHooks();
        const results: number[] = [];
        hooks.register('init', () => results.push(1));
        hooks.register('init', () => results.push(2));
        await hooks.trigger('init', {});
        expect(results).toEqual([1, 2]);
    });
});
