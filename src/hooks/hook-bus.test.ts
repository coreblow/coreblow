import { describe, it, expect } from 'vitest';
import { HookBus } from './hook-bus.js';

describe('HookBus', () => {
    it('should register and fire hooks', async () => {
        const bus = new HookBus();
        let called = false;
        bus.on('test', () => { called = true; });
        await bus.fire('test', {});
        expect(called).toBe(true);
    });

    it('should fire multiple listeners', async () => {
        const bus = new HookBus();
        const results: number[] = [];
        bus.on('test', () => { results.push(1); });
        bus.on('test', () => { results.push(2); });
        await bus.fire('test', {});
        expect(results).toEqual([1, 2]);
    });

    it('should not fail on unknown event', async () => {
        const bus = new HookBus();
        await bus.fire('unknown', {});
    });
});
