/**
 * channels/draft-stream-controls.ts
 * Finalizable draft stream with stop/clear/finalize lifecycle.
 * Ported from OpenClaw src/channels/draft-stream-controls.ts.
 */

import { createDraftStreamLoop, type DraftStreamLoop } from './draft-stream-loop.js';

export type FinalizableDraftStreamState = {
    stopped: boolean;
    final: boolean;
};

export type DraftStreamControls = {
    update: (text: string) => void;
    finalize: (text: string) => Promise<void>;
    stop: () => void;
    isStopped: () => boolean;
    isFinal: () => boolean;
};

/**
 * Create a finalizable draft stream with full lifecycle.
 */
export function createFinalizableDraftStreamControls(params: {
    throttleMs: number;
    sendOrEditStreamMessage: (text: string) => Promise<boolean>;
    onFinalize?: (text: string) => Promise<void>;
}): DraftStreamControls {
    const state: FinalizableDraftStreamState = { stopped: false, final: false };

    const loop = createDraftStreamLoop({
        throttleMs: params.throttleMs,
        isStopped: () => state.stopped,
        sendOrEditStreamMessage: params.sendOrEditStreamMessage,
    });

    const update = (text: string) => {
        if (state.stopped || state.final) return;
        loop.update(text);
    };

    const finalize = async (text: string) => {
        if (state.final) return;
        state.final = true;
        state.stopped = true;
        loop.stop();
        await loop.waitForInFlight();

        if (params.onFinalize) {
            await params.onFinalize(text);
        } else {
            await params.sendOrEditStreamMessage(text);
        }
    };

    const stop = () => {
        state.stopped = true;
        loop.stop();
    };

    return {
        update,
        finalize,
        stop,
        isStopped: () => state.stopped,
        isFinal: () => state.final,
    };
}
