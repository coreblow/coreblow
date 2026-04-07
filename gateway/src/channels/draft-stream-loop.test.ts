/**
 * channels/draft-stream-loop.test.ts — Draft stream tests
 */
import { describe, it, expect, vi } from 'vitest';
import { createDraftStreamLoop } from './draft-stream-loop.js';

describe('Draft Stream Loop', () => {
    it('sends update after throttle', async () => {
        const sent: string[] = [];
        let stopped = false;
        const loop = createDraftStreamLoop({
            throttleMs: 10,
            isStopped: () => stopped,
            sendOrEditStreamMessage: async (text) => { sent.push(text); },
        });

        loop.update('hello');
        await new Promise((r) => setTimeout(r, 50));
        expect(sent).toContain('hello');
        loop.stop();
    });

    it('flush sends pending', async () => {
        const sent: string[] = [];
        const loop = createDraftStreamLoop({
            throttleMs: 10000, // high throttle
            isStopped: () => false,
            sendOrEditStreamMessage: async (text) => { sent.push(text); },
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
            sendOrEditStreamMessage: async (text) => { sent.push(text); },
        });

        // Prime: first update fires immediately (lastSentAt=0 → elapsed=huge)
        loop.update('prime');
        await new Promise((r) => setTimeout(r, 20));
        // Now lastSentAt is recent, so next update will be throttled
        sent.length = 0;

        loop.update('should-clear');
        // resetPending before the throttle timer fires
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
            sendOrEditStreamMessage: async (text) => { sent.push(text); },
        });

        loop.update('should-not-send');
        await new Promise((r) => setTimeout(r, 50));
        expect(sent).toHaveLength(0);
    });
});
