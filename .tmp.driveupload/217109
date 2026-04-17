/**
 * CoreBlow Gateway — Channel Policy: Allowlist Match Engine
 *
 * CoreBlow — src/channels/allowlist-match.ts.
 * Algoritma identik; tipe disesuaikan dengan arsitektur CoreBlow.
 *
 * Digunakan oleh `channel-policy-engine.ts` untuk memutuskan apakah
 * sender diizinkan berinteraksi dengan bot di channel tertentu.
 *
 * @see coreblow/src/channels/allowlist-match.ts
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Sumber match yang berhasil ditemukan di allowlist.
 * Mengikuti pola CoreBlow `AllowlistMatchSource`.
 */
export type AllowlistMatchSource =
    | 'wildcard'
    | 'id'
    | 'name'
    | 'username'
    | 'tag'
    | 'prefixed-id'
    | 'prefixed-user'
    | 'slug';

/**
 * Hasil match terhadap sebuah allowlist.
 * Generik untuk support custom source types di masa depan.
 */
export type AllowlistMatch<TSource extends string = AllowlistMatchSource> = {
    allowed: boolean;
    /** Entry yang match, jika ditemukan */
    matchKey?: string;
    /** Bagaimana match ditemukan */
    matchSource?: TSource;
};

/**
 * Allowlist yang sudah di-compile ke Set untuk O(1) lookup.
 * Dibuat sekali saat init, bukan per-request.
 */
export type CompiledAllowlist = {
    set: ReadonlySet<string>;
    /** True jika wildcard `*` ada di list */
    wildcard: boolean;
};

// ─── Compile ──────────────────────────────────────────────────────────────────

/**
 * Compile array of allowlist strings ke `CompiledAllowlist`.
 *
 * - Entry kosong di-filter
 * - Wildcard `*` di-detect
 * - Semua entry di-lowercase untuk case-insensitive matching
 *
 * Pola CoreBlow `compileAllowlist()`.
 *
 * @example
 * const list = compileAllowlist(['user123', '*', 'admin']);
 * // list.wildcard === true
 */
export function compileAllowlist(entries: ReadonlyArray<string>): CompiledAllowlist {
    const set = new Set(
        entries
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
    );
    return {
        set,
        wildcard: set.has('*'),
    };
}

// ─── Match ────────────────────────────────────────────────────────────────────

/**
 * Format match metadata untuk logging.
 * Pola CoreBlow `formatAllowlistMatchMeta()`.
 */
export function formatAllowlistMatchMeta(
    match?: { matchKey?: string; matchSource?: string } | null,
): string {
    return `matchKey=${match?.matchKey ?? 'none'} matchSource=${match?.matchSource ?? 'none'}`;
}

/**
 * Resolve allowlist match dari array kandidat secara berurutan.
 * Berhenti di kandidat pertama yang match.
 *
 * Pola CoreBlow `resolveAllowlistCandidates()`.
 */
export function resolveAllowlistCandidates<TSource extends string>(params: {
    compiledAllowlist: CompiledAllowlist;
    candidates: Array<{ value?: string; source: TSource }>;
}): AllowlistMatch<TSource> {
    for (const candidate of params.candidates) {
        if (!candidate.value) continue;
        if (params.compiledAllowlist.set.has(candidate.value.trim().toLowerCase())) {
            return {
                allowed: true,
                matchKey: candidate.value,
                matchSource: candidate.source,
            };
        }
    }
    return { allowed: false };
}

/**
 * Full allowlist match — cek wildcard dulu, lalu kandidat.
 * Empty allowlist → `{ allowed: false }` (deny-by-default).
 *
 * Pola CoreBlow `resolveCompiledAllowlistMatch()`.
 */
export function resolveCompiledAllowlistMatch<TSource extends string>(params: {
    compiledAllowlist: CompiledAllowlist;
    candidates: Array<{ value?: string; source: TSource }>;
}): AllowlistMatch<TSource> {
    // Empty list → deny
    if (params.compiledAllowlist.set.size === 0) {
        return { allowed: false };
    }
    // Wildcard → allow semua
    if (params.compiledAllowlist.wildcard) {
        return { allowed: true, matchKey: '*', matchSource: 'wildcard' as TSource };
    }
    return resolveAllowlistCandidates(params);
}

/**
 * Convenience: compile + resolve dalam satu langkah.
 *
 * Pola CoreBlow `resolveAllowlistMatchByCandidates()`.
 */
export function resolveAllowlistMatchByCandidates<TSource extends string>(params: {
    allowList: ReadonlyArray<string>;
    candidates: Array<{ value?: string; source: TSource }>;
}): AllowlistMatch<TSource> {
    return resolveCompiledAllowlistMatch({
        compiledAllowlist: compileAllowlist(params.allowList),
        candidates: params.candidates,
    });
}

/**
 * Paling simple — match sender ID (dan opsional nama) terhadap allowlist.
 *
 * Pola CoreBlow `resolveAllowlistMatchSimple()`.
 *
 * @example
 * const result = resolveAllowlistMatchSimple({
 *   allowFrom: ['user123', 'admin'],
 *   senderId: 'user123',
 * });
 * // result.allowed === true, result.matchSource === 'id'
 */
export function resolveAllowlistMatchSimple(params: {
    allowFrom: ReadonlyArray<string | number>;
    senderId: string;
    senderName?: string | null;
    /** Match by display name juga (selain ID) */
    allowNameMatching?: boolean;
}): AllowlistMatch<'wildcard' | 'id' | 'name'> {
    const compiled = compileAllowlist(
        params.allowFrom.map((e) => String(e)),
    );

    if (compiled.set.size === 0) {
        return { allowed: false };
    }
    if (compiled.wildcard) {
        return { allowed: true, matchKey: '*', matchSource: 'wildcard' };
    }

    const candidates: Array<{ value?: string; source: 'id' | 'name' }> = [
        { value: params.senderId, source: 'id' },
    ];

    if (params.allowNameMatching === true && params.senderName) {
        candidates.push({ value: params.senderName, source: 'name' });
    }

    return resolveAllowlistCandidates({ compiledAllowlist: compiled, candidates });
}
