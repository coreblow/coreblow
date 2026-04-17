/**
 * channels/typing-lifecycle.test.ts — Typing lifecycle tests
 */
import { describe, it, expect, vi } from 'vitest';
import { createTypingKeepaliveLoop } from './typing-lifecycle.js';

describe('Typing Keepalive Loop', () => {
    it('starts and stops', () => {
        const onTick = vi.fn();
        const loop = createTypingKeepaliveLoop({ intervalMs: 100, onTick });
        expect(loop.isRunning()).toBe(false);
        loop.start();
        expect(loop.isRunning()).toBe(true);
        loop.stop();
        expect(loop.isRunning()).toBe(false);
    });

    it('does not double-start', () => {
        const onTick = vi.fn();
        const loop = createTypingKeepaliveLoop({ intervalMs: 100, onTick });
        loop.start();
        loop.start();
        expect(loop.isRunning()).toBe(true);
        loop.stop();
    });

    it('does not start with intervalMs <= 0', () => {
        const onTick = vi.fn();
        const loop = createTypingKeepaliveLoop({ intervalMs: 0, onTick });
        loop.start();
        expect(loop.isRunning()).toBe(false);
    });

    it('ticks manually', async () => {
        let count = 0;
        const loop = createTypingKeepaliveLoop({ intervalMs: 100, onTick: async () => { count++; } });
        await loop.tick();
        expect(count).toBe(1);
    });

    it('guards against overlapping ticks', async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        const loop = createTypingKeepaliveLoop({
            intervalMs: 100,
            onTick: async () => {
                inFlight++;
                maxInFlight = Math.max(maxInFlight, inFlight);
                await new Promise((r) => setTimeout(r, 50));
                inFlight--;
            },
        });
        await Promise.all([loop.tick(), loop.tick(), loop.tick()]);
        expect(maxInFlight).toBe(1);
    });
});
