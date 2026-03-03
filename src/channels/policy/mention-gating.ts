/**
 * CoreBlow Gateway — Channel Policy: Mention Gating
 *
 * Port identik dari CoreBlow `src/channels/mention-gating.ts`.
 *
 * Pure functions untuk memutuskan apakah sebuah pesan harus diproses
 * berdasarkan apakah bot di-mention atau tidak.
 *
 * Dipakai di group chats di mana bot hanya boleh merespons jika
 * secara eksplisit di-mention (e.g. "@CoreBlow apa itu AI?").
 *
 * @see coreblow/src/channels/mention-gating.ts
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Input untuk `resolveMentionGating()`.
 * Identik dengan CoreBlow `MentionGateParams`.
 */
export type MentionGateParams = {
    /** Config: apakah mention wajib di channel ini */
    requireMention: boolean;
    /** Kemampuan channel: apakah bisa detect mention (tidak semua platform bisa) */
    canDetectMention: boolean;
    /** Apakah pesan ini me-mention bot */
    wasMentioned: boolean;
    /** Implicit mention: e.g. reply ke message bot */
    implicitMention?: boolean;
    /** Force bypass mention check (misal dari internal trigger) */
    shouldBypassMention?: boolean;
};

/**
 * Hasil dari `resolveMentionGating()`.
 * Identik dengan CoreBlow `MentionGateResult`.
 */
export type MentionGateResult = {
    /** True jika bot efektif di-mention (langsung, implicit, atau bypass) */
    effectiveWasMentioned: boolean;
    /** True = pesan harus di-skip (tidak diproses) */
    shouldSkip: boolean;
};

/**
 * Input untuk `resolveMentionGatingWithBypass()` — extended version.
 * Identik dengan CoreBlow `MentionGateWithBypassParams`.
 */
export type MentionGateWithBypassParams = {
    /** Apakah ini grup (bukan DM) */
    isGroup: boolean;
    requireMention: boolean;
    canDetectMention: boolean;
    wasMentioned: boolean;
    implicitMention?: boolean;
    /** Ada mention siapapun di pesan (bukan hanya mention bot) */
    hasAnyMention?: boolean;
    /** Config: bolehkah commands melewati mention requirement */
    allowTextCommands: boolean;
    /** Apakah pesan ini mengandung command (misal /help) */
    hasControlCommand: boolean;
    /** Apakah command sudah diauthorize (dari command-gating.ts) */
    commandAuthorized: boolean;
};

/** Extended result dengan info bypass */
export type MentionGateWithBypassResult = MentionGateResult & {
    /** True jika mention requirement di-bypass karena command */
    shouldBypassMention: boolean;
};

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Resolve mention gating — versi basic.
 *
 * Logic (identik OC):
 * - `effectiveWasMentioned` = wasMentioned OR implicitMention OR shouldBypassMention
 * - `shouldSkip` = requireMention AND canDetectMention AND NOT effectiveWasMentioned
 *
 * Catatan: Jika `canDetectMention` === false (platform tidak support mention detection),
 * `shouldSkip` selalu false — jangan block pesan yang tidak bisa di-check.
 *
 * @example
 * // Group chat, bot tidak di-mention:
 * resolveMentionGating({
 *   requireMention: true,
 *   canDetectMention: true,
 *   wasMentioned: false,
 * });
 * // { effectiveWasMentioned: false, shouldSkip: true }
 *
 * // DM (requireMention: false):
 * resolveMentionGating({
 *   requireMention: false,
 *   canDetectMention: true,
 *   wasMentioned: false,
 * });
 * // { effectiveWasMentioned: false, shouldSkip: false }
 */
export function resolveMentionGating(params: MentionGateParams): MentionGateResult {
    const implicit = params.implicitMention === true;
    const bypass = params.shouldBypassMention === true;
    const effectiveWasMentioned = params.wasMentioned || implicit || bypass;
    const shouldSkip =
        params.requireMention && params.canDetectMention && !effectiveWasMentioned;
    return { effectiveWasMentioned, shouldSkip };
}

/**
 * Resolve mention gating dengan bypass logic untuk command-based messages.
 *
 * Extended version — di grup, jika ada command yang authorized,
 * mention requirement bisa di-bypass meski bot tidak di-mention.
 *
 * Bypass terjadi jika SEMUA kondisi berikut true (pola OC):
 * 1. `isGroup` — hanya berlaku di grup (bukan DM)
 * 2. `requireMention` — mention memang diwajibkan
 * 3. `!wasMentioned` — bot tidak di-mention
 * 4. `!(hasAnyMention)` — tidak ada mention siapapun (termasuk user lain)
 * 5. `allowTextCommands` — commands diizinkan
 * 6. `commandAuthorized` — sender authorized untuk command ini
 * 7. `hasControlCommand` — pesan ini adalah command
 *
 * @example
 * // Group chat, user kirim /help tanpa mention:
 * resolveMentionGatingWithBypass({
 *   isGroup: true, requireMention: true, canDetectMention: true,
 *   wasMentioned: false, allowTextCommands: true,
 *   hasControlCommand: true, commandAuthorized: true,
 * });
 * // { shouldBypassMention: true, shouldSkip: false, effectiveWasMentioned: false }
 */
export function resolveMentionGatingWithBypass(
    params: MentionGateWithBypassParams,
): MentionGateWithBypassResult {
    const shouldBypassMention =
        params.isGroup &&
        params.requireMention &&
        !params.wasMentioned &&
        !(params.hasAnyMention ?? false) &&
        params.allowTextCommands &&
        params.commandAuthorized &&
        params.hasControlCommand;

    const base = resolveMentionGating({
        requireMention: params.requireMention,
        canDetectMention: params.canDetectMention,
        wasMentioned: params.wasMentioned,
        implicitMention: params.implicitMention,
        shouldBypassMention,
    });

    return { ...base, shouldBypassMention };
}
