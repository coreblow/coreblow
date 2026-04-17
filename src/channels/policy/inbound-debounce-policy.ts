/**
 * CoreBlow Gateway — Channel Policy: Inbound Debounce Config Wrapper
 *
 * CoreBlow — src/channels/inbound-debounce-policy.ts.
 *
 * Wrapper konfigurasi yang menjembatani antara `ChannelPolicyConfig`
 * dan `createInboundDebouncer()`. Menangani resolusi debounceMs
 * dari config global + per-channel overrides.
 *
 * @see coreblow/src/channels/inbound-debounce-policy.ts
 */

import {
    createInboundDebouncer,
    type InboundDebouncer,
    type InboundDebouncerParams,
} from './inbound-debounce.js';

// ─── Config Types ─────────────────────────────────────────────────────────────

/**
 * Konfigurasi debounce policy untuk channel.
 * Disimpan di `ChannelPolicyConfig.debounce`.
 */
export type InboundDebouncePolicyConfig = {
    /** Default debounce window dalam ms. 0 = disabled. Default: 0. */
    debounceMs?: number;
    /**
     * Per-channel override.
     * Key = channel name (e.g. 'discord', 'telegram').
     * Value = debounceMs override untuk channel tersebut.
     *
     * @example
     * { discord: 300, telegram: 500, slack: 200 }
     */
    byChannel?: Record<string, number>;
};

// ─── Resolution ───────────────────────────────────────────────────────────────

const resolveMs = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.max(0, Math.trunc(value));
};

/**
 * Resolve final debounceMs untuk channel tertentu.
 *
 * Priority order (identik OC):
 * 1. `overrideMs` (runtime override, highest priority)
 * 2. `byChannel[channel]` (per-channel config)
 * 3. `debounceMs` (global default)
 * 4. `0` (no debounce, fallback)
 *
 * Pola CoreBlow `resolveInboundDebounceMs()`.
 *
 * @example
 * const ms = resolveInboundDebounceMs({
 *   policy: { debounceMs: 200, byChannel: { discord: 500 } },
 *   channel: 'discord',
 * });
 * // 500 — per-channel override dipakai
 */
export function resolveInboundDebounceMs(params: {
    policy?: InboundDebouncePolicyConfig;
    channel: string;
    /** Runtime override — selalu menang vs config */
    overrideMs?: number;
}): number {
    const { policy, channel } = params;

    const override = resolveMs(params.overrideMs);
    if (override !== undefined) return override;

    const byChannel = resolveMs(policy?.byChannel?.[channel]);
    if (byChannel !== undefined) return byChannel;

    const base = resolveMs(policy?.debounceMs);
    if (base !== undefined) return base;

    return 0;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Parameters untuk `createChannelInboundDebouncer()`.
 * Lebih simple dari `InboundDebouncerParams` — debounceMs auto-resolved dari config.
 */
export type ChannelDebouncerParams<T> = Omit<InboundDebouncerParams<T>, 'debounceMs'> & {
    policy?: InboundDebouncePolicyConfig;
    channel: string;
    debounceMsOverride?: number;
};

/**
 * Buat channel-level inbound debouncer yang sudah dikonfigurasi.
 *
 * Wrapper convenience di atas `createInboundDebouncer()` — otomatis resolve
 * debounceMs dari policy config + channel-specific override.
 *
 * Pola CoreBlow `createChannelInboundDebouncer()`.
 *
 * @example
 * const { debounceMs, debouncer } = createChannelInboundDebouncer({
 *   policy: { debounceMs: 200, byChannel: { discord: 500 } },
 *   channel: 'discord',
 *   buildKey: (msg) => msg.senderId,
 *   onFlush: async (msgs) => handleBatch(msgs),
 * });
 * // debounceMs === 500 (discord override)
 */
export function createChannelInboundDebouncer<T>(
    params: ChannelDebouncerParams<T>,
): {
    debounceMs: number;
    debouncer: InboundDebouncer<T>;
} {
    const { policy, channel, debounceMsOverride, ...rest } = params;

    const debounceMs = resolveInboundDebounceMs({
        policy,
        channel,
        overrideMs: debounceMsOverride,
    });

    const debouncer = createInboundDebouncer<T>({
        debounceMs,
        ...rest,
    });

    return { debounceMs, debouncer };
}
