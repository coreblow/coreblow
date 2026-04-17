/**
 * CoreBlow Gateway — Channel Policy: Inbound Debounce Engine
 *
 * CoreBlow — src/auto-reply/inbound-debounce.ts.
 *
 * Core debounce engine dengan keyed buffers — satu buffer per sender.
 * Mencegah burst message spam dengan menggabungkan messages dari sender
 * yang sama dalam window waktu tertentu sebelum di-flush ke handler.
 *
 * Fitur identik OC:
 * - Keyed buffers (per senderId atau sessionId)
 * - Per-item debounceMs resolution
 * - Promise chain per key (cegah race condition)
 * - shouldDebounce bypass (misal commands langsung di-flush)
 * - maxTrackedKeys eviction (cegah memory leak)
 * - flushAll() untuk graceful shutdown
 *
 * @see coreblow/src/auto-reply/inbound-debounce.ts
 */

const DEFAULT_MAX_TRACKED_KEYS = 2048;

// ─── Types ────────────────────────────────────────────────────────────────────

type DebounceBuffer<T> = {
    items: T[];
    timeout: ReturnType<typeof setTimeout> | null;
    debounceMs: number;
    resolve: () => void;
    task: Promise<void>;
};

/**
 * Parameters untuk `createInboundDebouncer()`.
 * Identik dengan CoreBlow `InboundDebounceCreateParams<T>`.
 */
export type InboundDebouncerParams<T> = {
    /** Default debounce window dalam ms */
    debounceMs: number;
    /** Max keys yang di-track sebelum eviction. Default: 2048 (pola OC) */
    maxTrackedKeys?: number;
    /** Fungsi yang return key unik per item (misal: senderId + channelId) */
    buildKey: (item: T) => string | null | undefined;
    /**
     * Jika return false — item langsung di-flush tanpa debounce.
     * Dipakai untuk commands yang harus segera diproses.
     */
    shouldDebounce?: (item: T) => boolean;
    /**
     * Override debounceMs per-item. Jika return undefined → pakai default.
     * Dipakai untuk channel-level overrides.
     */
    resolveDebounceMs?: (item: T) => number | undefined;
    /** Dipanggil saat buffer di-flush dengan semua items yang terkumpul */
    onFlush: (items: T[]) => Promise<void>;
    /** Error handler jika onFlush throws. Dipanggil tapi tidak re-throw. */
    onError?: (err: unknown, items: T[]) => void;
};

/**
 * Instance debouncer yang dikembalikan oleh `createInboundDebouncer()`.
 */
export type InboundDebouncer<T> = {
    /**
     * Queue sebuah item untuk di-debounce.
     * Return promise yang resolve saat item ter-flush.
     */
    add(item: T): Promise<void>;
    /** Force flush semua buffer yang pending. Dipakai saat shutdown. */
    flushAll(): Promise<void>;
    /** Runtime stats untuk monitoring/debugging */
    stats(): { activeKeys: number; pendingItems: number };
};

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Buat keyed inbound debouncer.
 *
 * Algoritma (identik OC):
 * 1. `add(item)` → resolve key via `buildKey(item)`
 * 2. Jika `shouldDebounce(item)` === false → bypass, flush langsung
 * 3. Append ke buffer key, reset timer
 * 4. Saat timer habis → `onFlush(items)`
 * 5. Promise chain per key memastikan tidak ada race condition
 *
 * @example
 * const debouncer = createInboundDebouncer({
 *   debounceMs: 300,
 *   buildKey: (msg) => msg.senderId,
 *   onFlush: async (msgs) => {
 *     // Process batch of messages from same sender
 *   },
 * });
 *
 * await debouncer.add(message);
 */
export function createInboundDebouncer<T>(
    params: InboundDebouncerParams<T>,
): InboundDebouncer<T> {
    const buffers = new Map<string, DebounceBuffer<T>>();
    const keyChains = new Map<string, Promise<void>>();
    const defaultDebounceMs = Math.max(0, Math.trunc(params.debounceMs));
    const maxTrackedKeys = Math.max(
        1,
        Math.trunc(params.maxTrackedKeys ?? DEFAULT_MAX_TRACKED_KEYS),
    );

    // ── Helpers ──────────────────────────────────────────────────────

    const getEffectiveDebounceMs = (item: T): number => {
        const resolved = params.resolveDebounceMs?.(item);
        if (typeof resolved !== 'number' || !Number.isFinite(resolved)) {
            return defaultDebounceMs;
        }
        return Math.max(0, Math.trunc(resolved));
    };

    const runFlush = async (items: T[]): Promise<void> => {
        try {
            await params.onFlush(items);
        } catch (err) {
            try {
                params.onError?.(err, items);
            } catch {
                // Swallow error handler failures — do not break chain
            }
        }
    };

    // Evict oldest key jika melebihi maxTrackedKeys (pola OC)
    const evictIfNeeded = (): void => {
        if (buffers.size < maxTrackedKeys) return;
        const oldestKey = buffers.keys().next().value;
        if (oldestKey !== undefined) {
            const buf = buffers.get(oldestKey);
            if (buf?.timeout) {
                clearTimeout(buf.timeout);
                buf.timeout = null;
            }
            buffers.delete(oldestKey);
            keyChains.delete(oldestKey);
        }
    };

    // ── Core: keyed buffer flush ───────────────────────────────────

    const scheduleFlush = (key: string, buf: DebounceBuffer<T>, debounceMs: number): void => {
        if (buf.timeout) {
            clearTimeout(buf.timeout);
        }
        buf.debounceMs = debounceMs;
        buf.timeout = setTimeout(() => {
            const toFlush = buffers.get(key);
            if (!toFlush) return;

            buffers.delete(key);
            const items = [...toFlush.items];
            const resolve = toFlush.resolve;

            // Chain flush onto keyChain to preserve order
            const chain = keyChains.get(key) ?? Promise.resolve();
            const next = chain.then(() => runFlush(items)).finally(() => {
                resolve();
                if (keyChains.get(key) === next) {
                    keyChains.delete(key);
                }
            });
            keyChains.set(key, next);
        }, debounceMs);
    };

    // ── Public API ────────────────────────────────────────────────

    const add = (item: T): Promise<void> => {
        const key = params.buildKey(item);

        // Unkeyed items → flush immediately without debounce
        if (!key) {
            return runFlush([item]);
        }

        // shouldDebounce === false → bypass, flush immediately (pola OC)
        const shouldDebounce = params.shouldDebounce?.(item) ?? true;
        if (!shouldDebounce) {
            const chain = keyChains.get(key) ?? Promise.resolve();
            const next = chain.then(() => runFlush([item]));
            keyChains.set(key, next);
            return next;
        }

        evictIfNeeded();

        const debounceMs = getEffectiveDebounceMs(item);

        let resolve!: () => void;
        let buf = buffers.get(key);

        if (!buf) {
            const task = new Promise<void>((r) => { resolve = r; });
            buf = { items: [], timeout: null, debounceMs, resolve, task };
            buffers.set(key, buf);
        } else {
            resolve = buf.resolve; // Already set
        }

        buf.items.push(item);
        scheduleFlush(key, buf, debounceMs);
        return buf.task;
    };

    const flushAll = async (): Promise<void> => {
        const pending = [...buffers.entries()];
        buffers.clear();

        await Promise.all(
            pending.map(async ([key, buf]) => {
                if (buf.timeout) {
                    clearTimeout(buf.timeout);
                    buf.timeout = null;
                }
                const items = [...buf.items];
                const resolve = buf.resolve;
                const chain = keyChains.get(key) ?? Promise.resolve();
                const next = chain.then(() => runFlush(items)).finally(() => {
                    resolve();
                    keyChains.delete(key);
                });
                keyChains.set(key, next);
                await next;
            }),
        );
    };

    const stats = (): { activeKeys: number; pendingItems: number } => {
        let pendingItems = 0;
        for (const buf of buffers.values()) {
            pendingItems += buf.items.length;
        }
        return { activeKeys: buffers.size, pendingItems };
    };

    return { add, flushAll, stats };
}
