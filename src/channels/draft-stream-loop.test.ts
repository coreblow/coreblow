import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { createDraftStreamLoop } from './draft-stream-loop.js';

describe('Draft Stream Loop', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('sends update after throttle', async () => {
        const sent: string[] = [];
        let stopped = false;
        const loop = createDraftStreamLoop({
            throttleMs: 10,
            isStopped: () => stopped,
            sendOrEditStreamMessage: async (text) => {
                sent.push(text);
            },
        });

        loop.update('hello');
        await vi.advanceTimersByTimeAsync(10);
        await loop.waitForInFlight();
        expect(sent).toContain('hello');
        loop.stop();
    });

    it('flush sends pending', async () => {
        const sent: string[] = [];
        const loop = createDraftStreamLoop({
            throttleMs: 10000, // high throttle
            isStopped: () => false,
            sendOrEditStreamMessage: async (text) => {
                sent.push(text);
            },
        });

        loop.update('buffered');
        await loop.flush();
        expect(sent).toContain('buffered');
        loop.stop();
    });

    it('resetPending clears', async () => {
        const sent: string[] = [];
        let stopped = false;
        const loop = createDraftStreamLoop({
            throttleMs: 10000,
            isStopped: () => stopped,
            sendOrEditStreamMessage: async (text) => {
                sent.push(text);
            },
        });

        loop.update('prime');
        await vi.advanceTimersByTimeAsync(10000);
        await loop.waitForInFlight();
        sent.length = 0;

        loop.update('should-clear');
        loop.resetPending();
        await loop.flush();
        expect(sent).toHaveLength(0);
        loop.stop();
    });

    it('does not send when stopped', async () => {
        const sent: string[] = [];
        const loop = createDraftStreamLoop({
            throttleMs: 0,
            isStopped: () => true,
            sendOrEditStreamMessage: async (text) => {
                sent.push(text);
            },
        });

        loop.update('should-not-send');
        await loop.flush();
        expect(sent).toHaveLength(0);
    });
});
