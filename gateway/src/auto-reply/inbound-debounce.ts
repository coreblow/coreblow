/**
 * auto-reply/inbound-debounce.ts
 * Inbound message debouncing with key-based batching.
 * Ported from OpenClaw src/auto-reply/inbound-debounce.ts.
 */

const DEFAULT_MAX_TRACKED_KEYS = 2048;

const resolveMs = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.max(0, Math.trunc(value));
};

export function resolveInboundDebounceMs(params: {
    cfg: Record<string, unknown>;
    channel: string;
    overrideMs?: number;
}): number {
    const messages = params.cfg.messages as Record<string, unknown> | undefined;
    const inbound = messages?.inbound as Record<string, unknown> | undefined;
    const override = resolveMs(params.overrideMs);
    const byChannel = inbound?.byChannel as Record<string, unknown> | undefined;
    const channelVal = resolveMs(byChannel?.[params.channel]);
    const base = resolveMs(inbound?.debounceMs);
    return override ?? channelVal ?? base ?? 0;
}

type DebounceBuffer<T> = {
    items: T[];
    timeout: ReturnType<typeof setTimeout> | null;
    debounceMs: number;
    releaseReady: () => void;
    readyReleased: boolean;
    task: Promise<void>;
};

export type InboundDebounceCreateParams<T> = {
    debounceMs: number;
    maxTrackedKeys?: number;
    buildKey: (item: T) => string | null | undefined;
    shouldDebounce?: (item: T) => boolean;
    resolveDebounceMs?: (item: T) => number | undefined;
    onFlush: (items: T[]) => Promise<void>;
    onError?: (err: unknown, items: T[]) => void;
};

export function createInboundDebouncer<T>(params: InboundDebounceCreateParams<T>) {
    const buffers = new Map<string, DebounceBuffer<T>>();
    const keyChains = new Map<string, Promise<void>>();
    const defaultDebounceMs = Math.max(0, Math.trunc(params.debounceMs));
    const maxTrackedKeys = Math.max(1, Math.trunc(params.maxTrackedKeys ?? DEFAULT_MAX_TRACKED_KEYS));

    const resolveDebounce = (item: T) => {
        const resolved = params.resolveDebounceMs?.(item);
        if (typeof resolved !== 'number' || !Number.isFinite(resolved)) return defaultDebounceMs;
        return Math.max(0, Math.trunc(resolved));
    };

    const runFlush = async (items: T[]) => {
        try { await params.onFlush(items); }
        catch (err) { try { params.onError?.(err, items); } catch { /* swallow */ } }
    };

    const enqueueKeyTask = (key: string, task: () => Promise<void>) => {
        const previous = keyChains.get(key) ?? Promise.resolve();
        const next = previous.catch(() => undefined).then(task);
        const settled = next.catch(() => undefined);
        keyChains.set(key, settled);
        void settled.finally(() => { if (keyChains.get(key) === settled) keyChains.delete(key); });
        return next;
    };

    const enqueueReservedKeyTask = (key: string, task: () => Promise<void>) => {
        let readyReleased = false;
        let releaseReady!: () => void;
        const ready = new Promise<void>((resolve) => { releaseReady = resolve; });
        return {
            task: enqueueKeyTask(key, async () => { await ready; await task(); }),
            release: () => { if (!readyReleased) { readyReleased = true; releaseReady(); } },
        };
    };

    const releaseBuffer = (buffer: DebounceBuffer<T>) => {
        if (buffer.readyReleased) return;
        buffer.readyReleased = true;
        buffer.releaseReady();
    };

    const flushBuffer = async (key: string, buffer: DebounceBuffer<T>) => {
        if (buffers.get(key) === buffer) buffers.delete(key);
        if (buffer.timeout) { clearTimeout(buffer.timeout); buffer.timeout = null; }
        releaseBuffer(buffer);
        await buffer.task;
    };

    const flushKey = async (key: string) => {
        const buffer = buffers.get(key);
        if (buffer) await flushBuffer(key, buffer);
    };

    const scheduleFlush = (key: string, buffer: DebounceBuffer<T>) => {
        if (buffer.timeout) clearTimeout(buffer.timeout);
        buffer.timeout = setTimeout(async () => { await flushBuffer(key, buffer); }, buffer.debounceMs);
        buffer.timeout.unref?.();
    };

    const canTrackKey = (key: string) => {
        if (buffers.has(key) || keyChains.has(key)) return true;
        return new Set([...buffers.keys(), ...keyChains.keys()]).size < maxTrackedKeys;
    };

    const enqueue = async (item: T) => {
        const key = params.buildKey(item);
        const debounceMs = resolveDebounce(item);
        const canDebounce = debounceMs > 0 && (params.shouldDebounce?.(item) ?? true);

        if (!canDebounce || !key) {
            if (key) {
                if (buffers.has(key)) {
                    const reserved = enqueueReservedKeyTask(key, async () => { await runFlush([item]); });
                    try { await flushKey(key); } finally { reserved.release(); }
                    await reserved.task;
                    return;
                }
                if (keyChains.has(key)) {
                    await enqueueKeyTask(key, async () => { await runFlush([item]); });
                    return;
                }
            }
            await runFlush([item]);
            return;
        }

        const existing = buffers.get(key);
        if (existing) {
            existing.items.push(item);
            existing.debounceMs = debounceMs;
            scheduleFlush(key, existing);
            return;
        }

        if (!canTrackKey(key)) {
            await enqueueKeyTask(key, async () => { await runFlush([item]); });
            return;
        }

        let buffer!: DebounceBuffer<T>;
        const reserved = enqueueReservedKeyTask(key, async () => {
            if (buffer.items.length === 0) return;
            await runFlush(buffer.items);
        });
        buffer = { items: [item], timeout: null, debounceMs, releaseReady: reserved.release, readyReleased: false, task: reserved.task };
        buffers.set(key, buffer);
        scheduleFlush(key, buffer);
    };

    return { enqueue, flushKey };
}
