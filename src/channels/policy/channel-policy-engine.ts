/**
 * CoreBlow Gateway — Channel Policy Engine (Facade)
 *
 * CoreBlow-specific — tidak ada di OC.
 *
 * Mengorkestrasikan semua policy checks dalam satu panggilan:
 * 1. Allowlist check (siapa yang boleh mengirim)
 * 2. Command gating (apakah command authorized)
 * 3. Mention gating (apakah bot di-mention jika wajib)
 * 4. Debounce resolution (berapa ms debounce untuk channel ini)
 *
 * Channel adapter cukup panggil `applyChannelPolicy()` satu kali
 * tanpa perlu tahu detail setiap policy engine individu.
 *
 * @example
 * // Di Discord adapter:
 * const policy = applyChannelPolicy({
 *   config: channelConfig.policy,
 *   message: {
 *     senderId: message.author.id,
 *     senderName: message.author.username,
 *     content: message.content,
 *     isGroup: message.guild !== null,
 *     wasMentioned: message.mentions.has(client.user),
 *     canDetectMention: true,
 *     hasControlCommand: message.content.startsWith('/'),
 *   },
 * });
 *
 * if (!policy.allowed) {
 *   return; // skip message
 * }
 */

import {
    resolveAllowlistMatchSimple,
    type AllowlistMatchSource,
} from './allowlist-match.js';
import {
    mergeDmAllowFromSources,
    resolveGroupAllowFromSources,
} from './allow-from.js';
import {
    resolveMentionGatingWithBypass,
} from './mention-gating.js';
import {
    resolveControlCommandGate,
    type CommandGatingMode,
} from './command-gating.js';
import {
    resolveInboundDebounceMs,
    type InboundDebouncePolicyConfig,
} from './inbound-debounce-policy.js';

// ─── Config Types ─────────────────────────────────────────────────────────────

/**
 * Policy configuration untuk sebuah channel.
 * Diset di `ChannelConfig.policy` atau per-channel override.
 */
export type ChannelPolicyConfig = {
    // ── Allowlist ──────────────────────────────────────────────────
    /** Daftar sender ID/name yang diizinkan (DM). Kosong = blokir semua. `['*']` = izinkan semua. */
    allowFrom?: Array<string | number>;
    /** Daftar sender ID/name untuk grup. Jika tidak diset, fallback ke `allowFrom`. */
    groupAllowFrom?: Array<string | number>;
    /** Allowlist dari store (runtime-added, e.g. dari dashboard) */
    storeAllowFrom?: Array<string | number>;
    /** Match juga by display name (tidak hanya ID). Default: false */
    allowNameMatching?: boolean;
    /** Policy DM: 'allowlist' = hanya gunakan allowFrom, 'open' = gabungkan dengan store. Default: 'open' */
    dmPolicy?: 'allowlist' | 'open';

    // ── Mention Gating ─────────────────────────────────────────────
    /** Wajib di-mention di grup. Default: false */
    requireMention?: boolean;
    /** Apakah channel bisa detect mention. Default: true */
    canDetectMention?: boolean;

    // ── Command Gating ─────────────────────────────────────────────
    /** Izinkan /commands. Default: true */
    allowTextCommands?: boolean;
    /** Aktifkan access group system untuk commands. Default: false */
    useAccessGroups?: boolean;
    /** Behavior saat access groups off. Default: 'allow' */
    commandGatingMode?: CommandGatingMode;

    // ── Debounce ───────────────────────────────────────────────────
    /** Debounce config untuk channel ini */
    debounce?: InboundDebouncePolicyConfig;
};

// ─── Result Types ─────────────────────────────────────────────────────────────

/**
 * Alasan kenapa pesan di-allow atau di-deny.
 */
export type ChannelPolicyReason =
    | 'allowed'              // pesan diizinkan
    | 'wildcard'             // allowlist berisi '*', semua diizinkan
    | 'allowlist_deny'       // sender tidak ada di allowlist
    | 'mention_required'     // bot tidak di-mention, padahal wajib
    | 'command_blocked';     // command tidak authorized

/**
 * Hasil `applyChannelPolicy()`.
 */
export type ChannelPolicyResult = {
    /** True jika pesan boleh diproses */
    allowed: boolean;
    /** Alasan decision */
    reason: ChannelPolicyReason;
    /** Dari field apa allowlist match ditemukan */
    matchSource?: AllowlistMatchSource | string;
    /** True jika pesan sebaiknya di-debounce sebelum diproses */
    shouldDebounce: boolean;
    /** Debounce window dalam ms (0 = tidak di-debounce) */
    debounceMs: number;
    /** Detail gating untuk logging */
    gating: {
        allowlistChecked: boolean;
        mentionChecked: boolean;
        commandChecked: boolean;
        bypassedMentionViaCommand: boolean;
    };
};

// ─── Input Types ─────────────────────────────────────────────────────────────

/**
 * Message context yang perlu diketahui channel policy engine.
 * Channel adapter menyediakan ini dari message yang diterima.
 */
export type ChannelPolicyMessage = {
    /** Unique ID sender (platform-specific: user ID, bot ID, dll) */
    senderId: string;
    /** Display name sender (untuk name-based allowlist matching) */
    senderName?: string;
    /** Konten pesan (untuk deteksi command) */
    content: string;
    /** Apakah ini group chat (bukan DM) */
    isGroup: boolean;
    /** Apakah bot di-mention dalam pesan ini */
    wasMentioned: boolean;
    /** Apakah platform bisa detect mention. Default: true */
    canDetectMention?: boolean;
    /** Apakah ada mention siapapun (bukan hanya bot) */
    hasAnyMention?: boolean;
    /** Apakah pesan ini mengandung control command (e.g. /help) */
    hasControlCommand?: boolean;
    /** Apakah pesan berisi media (image, video, dll) */
    hasMedia?: boolean;
    /** Nama channel platform (e.g. 'discord', 'telegram') */
    channelName?: string;
};

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Apply semua channel policies dalam urutan:
 *
 * 1. **Allowlist check** — apakah sender diizinkan?
 * 2. **Command gating** — apakah command authorized?
 * 3. **Mention gating** — apakah mention requirement terpenuhi?
 * 4. **Debounce resolution** — berapa ms debounce?
 *
 * Short-circuit: jika allowlist deny, langsung return tanpa cek gating.
 *
 * @example
 * const result = applyChannelPolicy({
 *   config: { allowFrom: ['*'], requireMention: true },
 *   message: {
 *     senderId: 'user123', content: 'hello', isGroup: true,
 *     wasMentioned: false, canDetectMention: true,
 *   },
 * });
 * // result.allowed === false, result.reason === 'mention_required'
 */
export function applyChannelPolicy(params: {
    config: ChannelPolicyConfig;
    message: ChannelPolicyMessage;
}): ChannelPolicyResult {
    const { config, message } = params;

    const allowTextCommands = config.allowTextCommands ?? true;
    const useAccessGroups = config.useAccessGroups ?? false;
    const hasControlCommand = message.hasControlCommand ?? false;
    const canDetectMention = message.canDetectMention ?? true;
    const channelName = message.channelName ?? 'unknown';

    // ── 1. Debounce resolution (selalu, regardless of allow/deny) ──────────
    const debounceMs = resolveInboundDebounceMs({
        policy: config.debounce,
        channel: channelName,
    });
    const shouldDebounce = debounceMs > 0 && !message.hasMedia;

    // ── 2. Allowlist check ─────────────────────────────────────────────────
    const effectiveAllowFrom = message.isGroup
        ? resolveGroupAllowFromSources({
              allowFrom: config.allowFrom,
              groupAllowFrom: config.groupAllowFrom,
          })
        : mergeDmAllowFromSources({
              allowFrom: config.allowFrom,
              storeAllowFrom: config.storeAllowFrom,
              dmPolicy: config.dmPolicy,
          });

    // Jika allowFrom tidak dikonfigurasi sama sekali → open (allow all)
    const hasAllowConfig = config.allowFrom !== undefined ||
        (message.isGroup && config.groupAllowFrom !== undefined);

    let allowlistDeny = false;
    let allowlistMatchSource: string | undefined;

    if (hasAllowConfig && effectiveAllowFrom.length === 0) {
        // Allowlist dikonfigurasi tapi kosong → deny all
        allowlistDeny = true;
    } else if (effectiveAllowFrom.length > 0) {
        const allowlistMatch = resolveAllowlistMatchSimple({
            allowFrom: effectiveAllowFrom,
            senderId: message.senderId,
            senderName: message.senderName,
            allowNameMatching: config.allowNameMatching,
        });
        allowlistMatchSource = allowlistMatch.matchSource;

        if (!allowlistMatch.allowed) {
            allowlistDeny = true;
        } else if (allowlistMatch.matchSource === 'wildcard') {
            return {
                allowed: true,
                reason: 'wildcard',
                matchSource: 'wildcard',
                shouldDebounce,
                debounceMs,
                gating: {
                    allowlistChecked: true,
                    mentionChecked: false,
                    commandChecked: false,
                    bypassedMentionViaCommand: false,
                },
            };
        }
    }

    if (allowlistDeny) {
        return {
            allowed: false,
            reason: 'allowlist_deny',
            matchSource: allowlistMatchSource,
            shouldDebounce: false,
            debounceMs,
            gating: {
                allowlistChecked: true,
                mentionChecked: false,
                commandChecked: false,
                bypassedMentionViaCommand: false,
            },
        };
    }

    // ── 3. Command gating ─────────────────────────────────────────────────
    const { commandAuthorized, shouldBlock: commandBlocked } = resolveControlCommandGate({
        useAccessGroups,
        authorizers: [],  // Authorizers diisi oleh channel adapter jika useAccessGroups
        allowTextCommands,
        hasControlCommand,
        modeWhenOff: config.commandGatingMode,
    });

    if (commandBlocked) {
        return {
            allowed: false,
            reason: 'command_blocked',
            matchSource: allowlistMatchSource,
            shouldDebounce: false,
            debounceMs,
            gating: {
                allowlistChecked: true,
                mentionChecked: false,
                commandChecked: true,
                bypassedMentionViaCommand: false,
            },
        };
    }

    // ── 4. Mention gating (hanya untuk grup) ─────────────────────────────
    const requireMention = config.requireMention ?? false;
    // DM (isGroup=false) → skip mention check, mention tidak relevan di DM
    const effectiveRequireMention = requireMention && message.isGroup;
    const mentionResult = resolveMentionGatingWithBypass({
        isGroup: message.isGroup,
        requireMention: effectiveRequireMention,
        canDetectMention,
        wasMentioned: message.wasMentioned,
        implicitMention: false,
        hasAnyMention: message.hasAnyMention,
        allowTextCommands,
        hasControlCommand,
        commandAuthorized,
    });

    if (mentionResult.shouldSkip) {
        return {
            allowed: false,
            reason: 'mention_required',
            matchSource: allowlistMatchSource,
            shouldDebounce: false,
            debounceMs,
            gating: {
                allowlistChecked: true,
                mentionChecked: true,
                commandChecked: true,
                bypassedMentionViaCommand: false,
            },
        };
    }

    // ── Allow ─────────────────────────────────────────────────────────────
    return {
        allowed: true,
        reason: 'allowed',
        matchSource: allowlistMatchSource,
        shouldDebounce,
        debounceMs,
        gating: {
            allowlistChecked: hasAllowConfig,
            mentionChecked: requireMention,
            commandChecked: useAccessGroups || commandBlocked,
            bypassedMentionViaCommand: mentionResult.shouldBypassMention,
        },
    };
}
