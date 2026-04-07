/**
 * channels/typing-controller.ts
 * Full typing controller with keepalive, guard, and TTL.
 * Ported from OpenClaw src/channels/typing.ts.
 */

import { createTypingKeepaliveLoop } from './typing-lifecycle.js';
import { createTypingStartGuard } from './typing-start-guard.js';

export type TypingCallbacks = {
    onReplyStart: () => Promise<void>;
    onIdle?: () => void;
    onCleanup?: () => void;
};

export type CreateTypingCallbacksParams = {
    start: () => Promise<void>;
    stop?: () => Promise<void>;
    onStartError: (err: unknown) => void;
    onStopError?: (err: unknown) => void;
    keepaliveIntervalMs?: number;
    maxConsecutiveFailures?: number;
    maxDurationMs?: number;
};

export function createTypingCallbacks(params: CreateTypingCallbacksParams): TypingCallbacks {
    const keepaliveIntervalMs = params.keepaliveIntervalMs ?? 3_000;
    const maxConsecutiveFailures = Math.max(1, params.maxConsecutiveFailures ?? 2);
    const maxDurationMs = params.maxDurationMs ?? 60_000;
    let stopSent = false;
    let closed = false;
    let ttlTimer: ReturnType<typeof setTimeout> | undefined;

    const startGuard = createTypingStartGuard({
        isSealed: () => closed,
        onStartError: params.onStartError,
        maxConsecutiveFailures,
        onTrip: () => { keepaliveLoop.stop(); },
    });

    const fireStart = async (): Promise<void> => {
        await startGuard.run(() => params.start());
    };

    const keepaliveLoop = createTypingKeepaliveLoop({
        intervalMs: keepaliveIntervalMs,
        onTick: fireStart,
    });

    const startTtlTimer = () => {
        if (maxDurationMs <= 0) return;
        clearTtlTimer();
        ttlTimer = setTimeout(() => {
            if (!closed) fireStop();
        }, maxDurationMs);
        ttlTimer.unref?.();
    };

    const clearTtlTimer = () => {
        if (ttlTimer) { clearTimeout(ttlTimer); ttlTimer = undefined; }
    };

    const fireStop = async () => {
        if (stopSent || closed) return;
        stopSent = true;
        closed = true;
        keepaliveLoop.stop();
        clearTtlTimer();
        if (params.stop) {
            try { await params.stop(); }
            catch (err) { params.onStopError?.(err); }
        }
    };

    const onReplyStart = async () => {
        if (closed) return;
        await fireStart();
        keepaliveLoop.start();
        startTtlTimer();
    };

    const onIdle = () => { void fireStop(); };
    const onCleanup = () => { void fireStop(); };

    return { onReplyStart, onIdle, onCleanup };
}
