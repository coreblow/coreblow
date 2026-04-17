/**
 * CoreBlow Gateway — Channel Policy: Allow-From Utilities
 *
 * CoreBlow — src/channels/allow-from.ts.
 * Menyediakan helper untuk menggabungkan dan mengevaluasi sumber
 * allow-from dari config dan store untuk DM dan group chats.
 *
 * @see coreblow/src/channels/allow-from.ts
 */

// ─── DM Allow-From Merging ────────────────────────────────────────────────────

/**
 * Gabungkan sumber allow-from untuk DM (direct message).
 *
 * Jika `dmPolicy` adalah `'allowlist'`, hanya pakai `allowFrom` dari config.
 * Jika tidak, gabungkan `allowFrom` + `storeAllowFrom` (runtime-added entries).
 *
 * Pola CoreBlow `mergeDmAllowFromSources()`.
 *
 * @example
 * const entries = mergeDmAllowFromSources({
 *   allowFrom: ['user1', 'user2'],
 *   storeAllowFrom: ['user3'],
 *   dmPolicy: 'open',
 * });
 * // ['user1', 'user2', 'user3']
 */
export function mergeDmAllowFromSources(params: {
    allowFrom?: Array<string | number>;
    storeAllowFrom?: Array<string | number>;
    dmPolicy?: 'allowlist' | 'open';
}): string[] {
    // Jika dmPolicy adalah 'allowlist', ignore storeAllowFrom (store-added entries)
    const storeEntries =
        params.dmPolicy === 'allowlist' ? [] : (params.storeAllowFrom ?? []);

    return [...(params.allowFrom ?? []), ...storeEntries]
        .map((value) => String(value).trim())
        .filter(Boolean);
}

// ─── Group Allow-From Resolution ──────────────────────────────────────────────

/**
 * Resolve allow-from entries untuk group chat.
 *
 * Priority: `groupAllowFrom` (explicit) → `allowFrom` (DM fallback, default) → `[]`
 *
 * Jika `fallbackToAllowFrom` === false → tidak fallback ke DM allowlist.
 *
 * Pola CoreBlow `resolveGroupAllowFromSources()`.
 *
 * @example
 * // Grup punya allow-from sendiri:
 * resolveGroupAllowFromSources({
 *   allowFrom: ['dm-user'],
 *   groupAllowFrom: ['group-admin'],
 * });
 * // → ['group-admin'] (explicit groupAllowFrom dipakai)
 *
 * // Grup pakai fallback ke DM allowlist:
 * resolveGroupAllowFromSources({
 *   allowFrom: ['dm-user'],
 *   groupAllowFrom: [],
 * });
 * // → ['dm-user'] (fallback ke allowFrom)
 */
export function resolveGroupAllowFromSources(params: {
    allowFrom?: Array<string | number>;
    groupAllowFrom?: Array<string | number>;
    /** Default: true — fallback ke allowFrom jika groupAllowFrom kosong */
    fallbackToAllowFrom?: boolean;
}): string[] {
    const explicitGroupAllowFrom =
        Array.isArray(params.groupAllowFrom) && params.groupAllowFrom.length > 0
            ? params.groupAllowFrom
            : undefined;

    const scoped = explicitGroupAllowFrom
        ? explicitGroupAllowFrom
        : params.fallbackToAllowFrom === false
          ? []
          : (params.allowFrom ?? []);

    return scoped.map((value) => String(value).trim()).filter(Boolean);
}

// ─── Sender ID Permission Check ───────────────────────────────────────────────

/**
 * Pre-compiled allow-from check — lebih efisien dari `resolveAllowlistMatchSimple()`
 * jika allow-from sudah di-compile sebelumnya.
 *
 * Pola CoreBlow `isSenderIdAllowed()`.
 *
 * @param allow - Pre-computed allow state (compile sekali, pakai berkali-kali)
 * @param senderId - Sender ID untuk di-check
 * @param allowWhenEmpty - Return value jika list kosong (true = open, false = closed)
 *
 * @example
 * const allow = buildAllowState(['user1', 'user2']);
 * isSenderIdAllowed(allow, 'user1', false); // → true
 * isSenderIdAllowed(allow, 'user3', false); // → false
 */
export function isSenderIdAllowed(
    allow: {
        entries: string[];
        hasWildcard: boolean;
        hasEntries: boolean;
    },
    senderId: string | undefined,
    allowWhenEmpty: boolean,
): boolean {
    if (!allow.hasEntries) {
        return allowWhenEmpty;
    }
    if (allow.hasWildcard) {
        return true;
    }
    if (!senderId) {
        return false;
    }
    const normalizedId = senderId.trim().toLowerCase();
    return allow.entries.some((e) => e.toLowerCase() === normalizedId);
}

/**
 * Build pre-computed allow state dari raw entries.
 * Companion untuk `isSenderIdAllowed()`.
 *
 * @example
 * const allow = buildAllowState(['user1', '*']);
 * allow.hasWildcard; // true
 */
export function buildAllowState(entries: Array<string | number>): {
    entries: string[];
    hasWildcard: boolean;
    hasEntries: boolean;
} {
    const normalized = entries
        .map((e) => String(e).trim())
        .filter(Boolean);

    return {
        entries: normalized,
        hasWildcard: normalized.includes('*'),
        hasEntries: normalized.length > 0,
    };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Return first defined value dari varargs — helper kecil pola OC.
 *
 * @example
 * firstDefined(undefined, null, 'hello'); // 'hello'
 * firstDefined(undefined, undefined);     // undefined
 */
export function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
    for (const value of values) {
        if (typeof value !== 'undefined') {
            return value;
        }
    }
    return undefined;
}
