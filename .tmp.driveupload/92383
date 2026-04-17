/**
 * channels/typing-start-guard.ts
 * Guard that trips (disables typing) after consecutive failures.
 * Ported from OpenClaw src/channels/typing-start-guard.ts.
 */

export type TypingStartGuard = {
    run: (fn: () => Promise<void>) => Promise<void>;
    reset: () => void;
    isTripped: () => boolean;
};

/**
 * Create a guard that stops retrying typing after N consecutive errors.
 */
export function createTypingStartGuard(params: {
    isSealed: () => boolean;
    onStartError: (err: unknown) => void;
    maxConsecutiveFailures: number;
    onTrip: () => void;
}): TypingStartGuard {
    let consecutiveFailures = 0;
    let tripped = false;

    const run = async (fn: () => Promise<void>) => {
        if (tripped || params.isSealed()) return;
        try {
            await fn();
            consecutiveFailures = 0;
        } catch (err) {
            consecutiveFailures++;
            params.onStartError(err);
            if (consecutiveFailures >= params.maxConsecutiveFailures) {
                tripped = true;
                params.onTrip();
            }
        }
    };

    const reset = () => { consecutiveFailures = 0; tripped = false; };
    const isTripped = () => tripped;

    return { run, reset, isTripped };
}
