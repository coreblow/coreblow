import { describe, it, expect, beforeEach } from 'vitest';
import { HooksEngine } from './engine.js';

describe('Hooks Engine — Phase 12', () => {
    let engine: HooksEngine;

    beforeEach(() => {
        engine = new HooksEngine();
    });

    it('registers a hook', () => {
        engine.register({
            id: 'hook-1', name: 'Test Hook', source: 'bundled',
            metadata: { events: ['message:inbound'] },
            handler: async () => {},
            enabled: true,
        });
        expect(engine.list()).toHaveLength(1);
    });

    it('rejects hook without events', () => {
        expect(() => engine.register({
            id: 'bad', name: 'Bad', source: 'installed',
            metadata: { events: [] },
            handler: async () => {},
            enabled: true,
        })).toThrow('at least one event');
    });

    it('replaces duplicate hook id', () => {
        engine.register({ id: 'h1', name: 'V1', source: 'bundled', metadata: { events: ['a'] }, handler: async () => {}, enabled: true });
        engine.register({ id: 'h1', name: 'V2', source: 'bundled', metadata: { events: ['a'] }, handler: async () => {}, enabled: true });
        expect(engine.list()).toHaveLength(1);
        expect(engine.list()[0].name).toBe('V2');
    });

    it('sorts by priority', () => {
        engine.register({ id: 'low', name: 'Low', source: 'bundled', metadata: { events: ['a'], priority: 200 }, handler: async () => {}, enabled: true });
        engine.register({ id: 'high', name: 'High', source: 'bundled', metadata: { events: ['a'], priority: 10 }, handler: async () => {}, enabled: true });
        expect(engine.list()[0].id).toBe('high');
    });

    it('emits event to matching hooks', async () => {
        const called: string[] = [];
        engine.register({ id: 'h1', name: 'H1', source: 'bundled', metadata: { events: ['msg:in'] }, handler: async () => { called.push('h1'); }, enabled: true });
        engine.register({ id: 'h2', name: 'H2', source: 'bundled', metadata: { events: ['msg:out'] }, handler: async () => { called.push('h2'); }, enabled: true });
        await engine.emit('msg:in', {});
        expect(called).toEqual(['h1']);
    });

    it('wildcard * matches all events', async () => {
        let fired = false;
        engine.register({ id: 'catch-all', name: 'CatchAll', source: 'bundled', metadata: { events: ['*'] }, handler: async () => { fired = true; }, enabled: true });
        await engine.emit('anything:here', {});
        expect(fired).toBe(true);
    });

    it('prefix wildcard message:* matches message:received', async () => {
        let fired = false;
        engine.register({ id: 'prefix', name: 'P', source: 'bundled', metadata: { events: ['message:*'] }, handler: async () => { fired = true; }, enabled: true });
        await engine.emit('message:received', {});
        expect(fired).toBe(true);
    });

    it('prefix wildcard does not match unrelated events', async () => {
        let fired = false;
        engine.register({ id: 'prefix', name: 'P', source: 'bundled', metadata: { events: ['message:*'] }, handler: async () => { fired = true; }, enabled: true });
        await engine.emit('session:start', {});
        expect(fired).toBe(false);
    });

    it('disabled hooks are not emitted', async () => {
        let fired = false;
        engine.register({ id: 'disabled', name: 'D', source: 'bundled', metadata: { events: ['a'] }, handler: async () => { fired = true; }, enabled: false });
        await engine.emit('a', {});
        expect(fired).toBe(false);
    });

    it('setEnabled toggles hook', async () => {
        engine.register({ id: 'h1', name: 'H1', source: 'bundled', metadata: { events: ['a'] }, handler: async () => {}, enabled: true });
        engine.setEnabled('h1', false);
        expect(engine.getHookById('h1')!.enabled).toBe(false);
    });

    it('unregister removes hook', () => {
        engine.register({ id: 'h1', name: 'H1', source: 'bundled', metadata: { events: ['a'] }, handler: async () => {}, enabled: true });
        expect(engine.unregister('h1')).toBe(true);
        expect(engine.list()).toHaveLength(0);
        expect(engine.unregister('h1')).toBe(false);
    });

    it('getHookById returns hook or undefined', () => {
        engine.register({ id: 'h1', name: 'H1', source: 'bundled', metadata: { events: ['a'] }, handler: async () => {}, enabled: true });
        expect(engine.getHookById('h1')!.name).toBe('H1');
        expect(engine.getHookById('nonexistent')).toBeUndefined();
    });

    it('emit records history', async () => {
        engine.register({ id: 'h1', name: 'H1', source: 'bundled', metadata: { events: ['a'] }, handler: async () => {}, enabled: true });
        await engine.emit('a');
        await engine.emit('a');
        expect(engine.getHistory().length).toBeGreaterThanOrEqual(2);
    });

    it('handler error is captured in result', async () => {
        engine.register({ id: 'crash', name: 'Crash', source: 'bundled', metadata: { events: ['a'] }, handler: async () => { throw new Error('boom'); }, enabled: true });
        const results = await engine.emit('a');
        expect(results[0].error).toBe('boom');
    });

    it('fireAndForget hooks return immediately', async () => {
        let done = false;
        engine.register({ id: 'ff', name: 'FF', source: 'bundled', metadata: { events: ['a'], fireAndForget: true }, handler: async () => { done = true; }, enabled: true });
        const results = await engine.emit('a');
        expect(results[0].durationMs).toBe(0); // Returns immediately
    });

    it('snapshot returns serializable state', () => {
        engine.register({ id: 'h1', name: 'H1', source: 'bundled', metadata: { events: ['a'], priority: 50 }, handler: async () => {}, enabled: true });
        const snap = engine.snapshot();
        expect(snap.hooks).toHaveLength(1);
        expect(snap.hooks[0].priority).toBe(50);
        expect(snap.version).toBeGreaterThan(0);
    });

    it('clear removes all hooks and history', async () => {
        engine.register({ id: 'h1', name: 'H1', source: 'bundled', metadata: { events: ['a'] }, handler: async () => {}, enabled: true });
        await engine.emit('a');
        engine.clear();
        expect(engine.list()).toHaveLength(0);
        expect(engine.getHistory()).toHaveLength(0);
    });

    it('shared context bag allows hook communication', async () => {
        const order: string[] = [];
        engine.register({ id: 'first', name: 'First', source: 'bundled', metadata: { events: ['a'], priority: 1 },
            handler: async (ctx) => { ctx.shared.val = 42; order.push('first'); }, enabled: true });
        engine.register({ id: 'second', name: 'Second', source: 'bundled', metadata: { events: ['a'], priority: 2 },
            handler: async (ctx) => { order.push(`second:${ctx.shared.val}`); }, enabled: true });
        await engine.emit('a');
        expect(order).toEqual(['first', 'second:42']);
    });
});
