/**
 * CoreBlow Gateway — Channel Policy: Command Gating
 *
 * Port identik dari CoreBlow `src/channels/command-gating.ts`.
 *
 * Pure functions untuk memutuskan apakah sender diizinkan
 * menggunakan control commands (e.g. /clear, /model, /status).
 *
 * Mendukung access group system — jika access groups diaktifkan,
 * hanya member access group yang bisa menjalankan commands.
 *
 * @see coreblow/src/channels/command-gating.ts
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Hasil check satu authorizer.
 * Identik dengan CoreBlow `CommandAuthorizer`.
 */
export type CommandAuthorizer = {
    /** Apakah authorizer ini dikonfigurasi (ada data) */
    configured: boolean;
    /** Apakah sender diizinkan menurut authorizer ini */
    allowed: boolean;
};

/**
 * Behavior ketika access groups tidak aktif.
 * Identik dengan CoreBlow `CommandGatingModeWhenAccessGroupsOff`.
 *
 * - `'allow'`: izinkan semua (default, backward-compatible)
 * - `'deny'`: blokir semua
 * - `'configured'`: izinkan jika ada authorizer yang configured + allowed
 */
export type CommandGatingMode = 'allow' | 'deny' | 'configured';

// ─── Core Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve apakah command diizinkan dari array authorizers.
 *
 * Logic (identik CoreBlow `resolveCommandAuthorizedFromAuthorizers()`):
 *
 * **Jika `useAccessGroups` = false:**
 * - mode `'allow'` → true
 * - mode `'deny'` → false
 * - mode `'configured'` → true jika ada authorizer yang configured AND allowed
 *
 * **Jika `useAccessGroups` = true:**
 * - true hanya jika ada authorizer yang configured AND allowed
 *
 * @example
 * // Access groups off, default allow:
 * resolveCommandAuthorized({ useAccessGroups: false, authorizers: [] });
 * // → true
 *
 * // Access groups on, user ada di group:
 * resolveCommandAuthorized({
 *   useAccessGroups: true,
 *   authorizers: [{ configured: true, allowed: true }],
 * });
 * // → true
 */
export function resolveCommandAuthorized(params: {
    useAccessGroups: boolean;
    authorizers: CommandAuthorizer[];
    /** Behavior saat access groups off. Default: 'allow' */
    modeWhenOff?: CommandGatingMode;
}): boolean {
    const { useAccessGroups, authorizers } = params;
    const mode = params.modeWhenOff ?? 'allow';

    if (!useAccessGroups) {
        if (mode === 'allow') return true;
        if (mode === 'deny') return false;
        // mode === 'configured'
        const anyConfigured = authorizers.some((a) => a.configured);
        if (!anyConfigured) return true;
        return authorizers.some((a) => a.configured && a.allowed);
    }

    return authorizers.some((a) => a.configured && a.allowed);
}

/**
 * Full gate check: apakah command authorized AND apakah harus di-block.
 *
 * `shouldBlock` = pesan mengandung command AND commands diizinkan config
 *               AND command tersebut TIDAK authorized.
 *
 * Identik `resolveControlCommandGate()`.
 *
 * @example
 * resolveControlCommandGate({
 *   useAccessGroups: true,
 *   authorizers: [{ configured: true, allowed: false }],
 *   allowTextCommands: true,
 *   hasControlCommand: true,
 * });
 * // { commandAuthorized: false, shouldBlock: true }
 */
export function resolveControlCommandGate(params: {
    useAccessGroups: boolean;
    authorizers: CommandAuthorizer[];
    /** Config: apakah text commands diizinkan sama sekali */
    allowTextCommands: boolean;
    /** Apakah pesan ini mengandung control command */
    hasControlCommand: boolean;
    modeWhenOff?: CommandGatingMode;
}): { commandAuthorized: boolean; shouldBlock: boolean } {
    const commandAuthorized = resolveCommandAuthorized({
        useAccessGroups: params.useAccessGroups,
        authorizers: params.authorizers,
        modeWhenOff: params.modeWhenOff,
    });
    const shouldBlock =
        params.allowTextCommands &&
        params.hasControlCommand &&
        !commandAuthorized;

    return { commandAuthorized, shouldBlock };
}

/**
 * Dual gate — dua authorizer (misal: DM allowlist + group allowlist).
 *
 * Identik `resolveDualTextControlCommandGate()`.
 *
 * @example
 * // DM sender ada di allowlist, group tidak dikonfigurasi:
 * resolveDualCommandGate({
 *   useAccessGroups: true,
 *   primaryConfigured: true, primaryAllowed: true,     // DM allowlist check
 *   secondaryConfigured: false, secondaryAllowed: false, // group check
 *   hasControlCommand: true,
 * });
 * // { commandAuthorized: true, shouldBlock: false }
 */
export function resolveDualCommandGate(params: {
    useAccessGroups: boolean;
    primaryConfigured: boolean;
    primaryAllowed: boolean;
    secondaryConfigured: boolean;
    secondaryAllowed: boolean;
    hasControlCommand: boolean;
    modeWhenOff?: CommandGatingMode;
}): { commandAuthorized: boolean; shouldBlock: boolean } {
    return resolveControlCommandGate({
        useAccessGroups: params.useAccessGroups,
        authorizers: [
            { configured: params.primaryConfigured, allowed: params.primaryAllowed },
            { configured: params.secondaryConfigured, allowed: params.secondaryAllowed },
        ],
        allowTextCommands: true,
        hasControlCommand: params.hasControlCommand,
        modeWhenOff: params.modeWhenOff,
    });
}
