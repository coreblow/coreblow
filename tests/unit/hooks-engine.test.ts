/**
 * CoreBlow Hooks Engine — Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HooksEngine } from '../../src/hooks/engine.js';
import type { HookEntry, HookContext } from '../../src/hooks/engine.js';

function createHook(overrides: Partial<HookEntry> = {}): HookEntry {
    return {
        id: overrides.id ?? 'test-hook',
        name: overrides.name ?? 'Test Hook',
        source: 'bundled',
        metadata: {
            events: ['test:event'],
            ...overrides.metadata,
        },
        handler: overrides.handler ?? (async () => {}),
        enabled: overrides.enabled ?? true,
    };
}

describe('HooksEngine', () => {
    let engine: HooksEngine;

    beforeEach(() => {
        engine = new HooksEngine();
    });

    it('should register a hook', () => {
        engine.register(createHook());
        expect(engine.list()).toHaveLength(1);
    });

    it('should reject hooks without events', () => {
        expect(() => engine.register(createHook({
            metadata: { events: [] },
        }))).toThrow();
    });

    it('should emit events to matching hooks', async () => {
        let called = false;
        engine.register(createHook({
            handler: async () => { called = true; },
        }));

        await engine.emit('test:event');
        expect(called).toBe(true);
    });

    it('should not call hooks for non-matching events', async () => {
        let called = false;
        engine.register(createHook({
            handler: async () => { called = true; },
        }));

        await engine.emit('other:event');
        expect(called).toBe(false);
    });

    it('should not call disabled hooks', async () => {
        let called = false;
        engine.register(createHook({
            enabled: false,
            handler: async () => { called = true; },
        }));

        await engine.emit('test:event');
        expect(called).toBe(false);
    });

    it('should enable/disable hooks', async () => {
        let callCount = 0;
        engine.register(createHook({
            id: 'toggle-hook',
            handler: async () => { callCount++; },
        }));

        await engine.emit('test:event');
        expect(callCount).toBe(1);

        engine.setEnabled('toggle-hook', false);
        await engine.emit('test:event');
        expect(callCount).toBe(1); // Not called again
    });

    it('should execute hooks in priority order', async () => {
        const order: number[] = [];

        engine.register(createHook({
            id: 'low-priority',
            metadata: { events: ['test:event'], priority: 200 },
            handler: async () => { order.push(200); },
        }));

        engine.register(createHook({
            id: 'high-priority',
            metadata: { events: ['test:event'], priority: 10 },
            handler: async () => { order.push(10); },
        }));

        engine.register(createHook({
            id: 'mid-priority',
            metadata: { events: ['test:event'], priority: 100 },
            handler: async () => { order.push(100); },
        }));

        await engine.emit('test:event');
        expect(order).toEqual([10, 100, 200]);
    });

    it('should track execution history', async () => {
        engine.register(createHook());
        await engine.emit('test:event');

        const history = engine.getHistory();
        expect(history).toHaveLength(1);
        expect(history[0]!.hookId).toBe('test-hook');
        expect(history[0]!.event).toBe('test:event');
        expect(history[0]!.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should capture hook errors in history', async () => {
        engine.register(createHook({
            handler: async () => { throw new Error('boom'); },
        }));

        const results = await engine.emit('test:event');
        expect(results[0]!.error).toBe('boom');
    });

    it('should pass shared context between hooks', async () => {
        engine.register(createHook({
            id: 'writer',
            metadata: { events: ['test:event'], priority: 1 },
            handler: async (ctx: HookContext) => { ctx.shared['data'] = 42; },
        }));

        engine.register(createHook({
            id: 'reader',
            metadata: { events: ['test:event'], priority: 2 },
            handler: async (ctx: HookContext) => {
                expect(ctx.shared['data']).toBe(42);
            },
        }));

        await engine.emit('test:event');
    });

    it('should handle fire-and-forget hooks', async () => {
        engine.register(createHook({
            metadata: { events: ['test:event'], fireAndForget: true },
            handler: async () => { /* background work */ },
        }));

        const results = await engine.emit('test:event');
        expect(results).toHaveLength(1);
        expect(results[0]!.durationMs).toBe(0); // fire-and-forget returns immediately
    });

    it('should clear all hooks', () => {
        engine.register(createHook());
        engine.clear();
        expect(engine.list()).toHaveLength(0);
        expect(engine.getHistory()).toHaveLength(0);
    });
});
