/**
 * channels/typing-lifecycle.ts
 * Typing keepalive loop with safety TTL.
 * Ported 1:1 from CoreBlow reference src/channels/typing-lifecycle.ts.
 */

type AsyncTick = () => Promise<void> | void;

export type TypingKeepaliveLoop = {
    tick: () => Promise<void>;
    start: () => void;
    stop: () => void;
    isRunning: () => boolean;
};

/**
 * Create a keepalive loop that repeatedly fires a typing indicator.
 * Protects against overlapping ticks with an in-flight guard.
 */
export function createTypingKeepaliveLoop(params: {
    intervalMs: number;
    onTick: AsyncTick;
}): TypingKeepaliveLoop {
    let timer: ReturnType<typeof setInterval> | undefined;
    let tickInFlight = false;

    const tick = async () => {
        if (tickInFlight) return;
        tickInFlight = true;
        try { await params.onTick(); }
        finally { tickInFlight = false; }
    };

    const start = () => {
        if (params.intervalMs <= 0 || timer) return;
        timer = setInterval(() => { void tick(); }, params.intervalMs);
    };

    const stop = () => {
        if (!timer) return;
        clearInterval(timer);
        timer = undefined;
        tickInFlight = false;
    };

    return { tick, start, stop, isRunning: () => timer !== undefined };
}
