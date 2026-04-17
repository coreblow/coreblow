/**
 * plugin-sdk/event-emitter.test.ts — Plugin event emitter tests
 */
import { describe, it, expect, vi } from 'vitest';
import { createPluginEventEmitter } from './event-emitter.js';

describe('Plugin Event Emitter', () => {
    it('emits and receives events', async () => {
        const emitter = createPluginEventEmitter();
        const received: string[] = [];
        emitter.on('message.inbound', (event) => { received.push(event.data as string); });
        await emitter.emit('message.inbound', 'hello');
        expect(received).toEqual(['hello']);
    });

    it('supports multiple listeners', async () => {
        const emitter = createPluginEventEmitter();
        let count = 0;
        emitter.on('tool.call', () => { count++; });
        emitter.on('tool.call', () => { count++; });
        await emitter.emit('tool.call', null);
        expect(count).toBe(2);
    });

    it('off removes listener', async () => {
        const emitter = createPluginEventEmitter();
        let count = 0;
        const handler = () => { count++; };
        emitter.on('heartbeat', handler);
        await emitter.emit('heartbeat', null);
        emitter.off('heartbeat', handler);
        await emitter.emit('heartbeat', null);
        expect(count).toBe(1);
    });

    it('on returns unsubscribe function', async () => {
        const emitter = createPluginEventEmitter();
        let count = 0;
        const unsub = emitter.on('config.change', () => { count++; });
        await emitter.emit('config.change', null);
        unsub();
        await emitter.emit('config.change', null);
        expect(count).toBe(1);
    });

    it('once fires only once', async () => {
        const emitter = createPluginEventEmitter();
        let count = 0;
        emitter.once('session.start', () => { count++; });
        await emitter.emit('session.start', null);
        await emitter.emit('session.start', null);
        expect(count).toBe(1);
    });

    it('listenerCount is accurate', () => {
        const emitter = createPluginEventEmitter();
        expect(emitter.listenerCount('tool.call')).toBe(0);
        emitter.on('tool.call', () => {});
        emitter.on('tool.call', () => {});
        expect(emitter.listenerCount('tool.call')).toBe(2);
    });

    it('removeAllListeners clears specific type', () => {
        const emitter = createPluginEventEmitter();
        emitter.on('tool.call', () => {});
        emitter.on('heartbeat', () => {});
        emitter.removeAllListeners('tool.call');
        expect(emitter.listenerCount('tool.call')).toBe(0);
        expect(emitter.listenerCount('heartbeat')).toBe(1);
    });

    it('removeAllListeners clears all', () => {
        const emitter = createPluginEventEmitter();
        emitter.on('tool.call', () => {});
        emitter.on('heartbeat', () => {});
        emitter.removeAllListeners();
        expect(emitter.listenerCount('tool.call')).toBe(0);
        expect(emitter.listenerCount('heartbeat')).toBe(0);
    });

    it('handles async handlers', async () => {
        const emitter = createPluginEventEmitter();
        const results: number[] = [];
        emitter.on('message.outbound', async () => {
            await new Promise((r) => setTimeout(r, 10));
            results.push(1);
        });
        await emitter.emit('message.outbound', null);
        expect(results).toEqual([1]);
    });

    it('handles handler errors gracefully', async () => {
        const emitter = createPluginEventEmitter();
        let received = false;
        emitter.on('tool.result', () => { throw new Error('handler error'); });
        emitter.on('tool.result', () => { received = true; });
        await emitter.emit('tool.result', null);
        expect(received).toBe(true);
    });

    it('event includes timestamp and source', async () => {
        const emitter = createPluginEventEmitter();
        let eventData: unknown;
        emitter.on('plugin.load', (event) => { eventData = event; });
        await emitter.emit('plugin.load', { name: 'test' }, 'core');
        const e = eventData as { timestamp: number; source: string; type: string };
        expect(e.timestamp).toBeGreaterThan(0);
        expect(e.source).toBe('core');
        expect(e.type).toBe('plugin.load');
    });

    it('does nothing for events with no listeners', async () => {
        const emitter = createPluginEventEmitter();
        await expect(emitter.emit('session.end', null)).resolves.toBeUndefined();
    });
});
