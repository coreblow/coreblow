/**
 * channels/draft-stream-loop.ts
 * Throttled draft-stream update loop.
 * Ported 1:1 from CoreBlow reference src/channels/draft-stream-loop.ts.
 */

export type DraftStreamLoop = {
    update: (text: string) => void;
    flush: () => Promise<void>;
    stop: () => void;
    resetPending: () => void;
    resetThrottleWindow: () => void;
    waitForInFlight: () => Promise<void>;
};

export function createDraftStreamLoop(params: {
    throttleMs: number;
    isStopped: () => boolean;
    sendOrEditStreamMessage: (text: string) => Promise<void | boolean>;
}): DraftStreamLoop {
    let lastSentAt = 0;
    let pendingText = '';
    let inFlightPromise: Promise<void | boolean> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = async () => {
        if (timer) { clearTimeout(timer); timer = undefined; }

        while (!params.isStopped()) {
            if (inFlightPromise) { await inFlightPromise; continue; }
            const text = pendingText;
            if (!text.trim()) { pendingText = ''; return; }
            pendingText = '';

            const current = params.sendOrEditStreamMessage(text).finally(() => {
                if (inFlightPromise === current) inFlightPromise = undefined;
            });
            inFlightPromise = current;
            const sent = await current;
            if (sent === false) { pendingText = text; return; }
            lastSentAt = Date.now();
            if (!pendingText) return;
        }
    };

    const scheduleFlush = () => {
        if (timer || params.isStopped()) return;
        const elapsed = Date.now() - lastSentAt;
        const delay = Math.max(0, params.throttleMs - elapsed);
        timer = setTimeout(() => { timer = undefined; void flush(); }, delay);
    };

    const update = (text: string) => {
        if (params.isStopped()) return;
        pendingText = text;
        if (!inFlightPromise) {
            const elapsed = Date.now() - lastSentAt;
            if (elapsed >= params.throttleMs) { void flush(); }
            else { scheduleFlush(); }
        }
    };

    const stop = () => {
        if (timer) { clearTimeout(timer); timer = undefined; }
    };

    const resetPending = () => { pendingText = ''; };
    const resetThrottleWindow = () => { lastSentAt = 0; };
    const waitForInFlight = async () => { if (inFlightPromise) await inFlightPromise; };

    return { update, flush, stop, resetPending, resetThrottleWindow, waitForInFlight };
}
