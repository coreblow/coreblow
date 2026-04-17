// @ts-nocheck
/**
 * channels/discord/plugin.ts
 * CoreBlow Discord channel plugin definition.
 * Bridges the DiscordChannel adapter to the ChannelPlugin contract
 * and registers with the bundled channel registry.
 */
import type { ChannelPlugin } from '../plugins/types.plugin.js';
import type { ChannelId, ChannelMeta } from '../plugins/types.js';
import type { ChannelCapabilities } from '../../config/channel-capabilities.js';
import { registerBundledChannelPlugin } from '../plugins/bundled.js';

// ─── Discord Plugin Meta ─────────────────────────────────────────────────────

const DISCORD_CHANNEL_ID: ChannelId = 'discord';

const discordMeta: ChannelMeta = {
    id: DISCORD_CHANNEL_ID,
    label: 'Discord',
    selectionLabel: 'Discord',
    docsPath: 'channels/discord',
    blurb: 'Connect CoreBlow to Discord servers and DMs.',
    order: 1,
    aliases: [],
    quickstartAllowFrom: true,
    forceAccountBinding: false,
    preferSessionLookupForAnnounceTarget: false,
};

const discordCapabilities: ChannelCapabilities = {
    supportsAttachments: true,
    supportsReactions: true,
    supportsThreads: true,
    supportsTypingIndicator: true,
    supportsEditMessage: true,
    supportsDeleteMessage: true,
    supportsRichEmbed: true,
    supportsInlineButtons: true,
    supportsVoice: true,
    maxMessageLength: 2000,
};

// ─── Discord Resolved Account ────────────────────────────────────────────────

export type ResolvedDiscordAccount = {
    accountId: string;
    name?: string;
    enabled?: boolean;
    token?: string | null;
    botId?: string | null;
    config: {
        dm?: { policy?: string; allowFrom?: Array<string | number> };
        groupPolicy?: string;
        mediaMaxMb?: number;
        historyLimit?: number;
        guilds?: Record<string, unknown>;
        allowFrom?: Array<string | number>;
    };
};

// ─── Discord Probe ───────────────────────────────────────────────────────────

export type DiscordProbe = {
    ok: boolean;
    latencyMs?: number;
    guildCount?: number;
    bot?: { id?: string; username?: string };
    application?: { intents?: Record<string, string> };
};

// ─── Discord Plugin Runtime ──────────────────────────────────────────────────

let discordRuntime: unknown = null;

export function setDiscordRuntime(runtime: unknown): void {
    discordRuntime = runtime;
}

export function getDiscordRuntime(): unknown {
    return discordRuntime;
}

// ─── Config Adapter ──────────────────────────────────────────────────────────

function listDiscordAccountIds(cfg: unknown): string[] {
    const config = cfg as Record<string, unknown> | undefined;
    const channels = config?.channels as Record<string, unknown> | undefined;
    const discord = channels?.discord as Record<string, unknown> | undefined;
    if (!discord) return [];

    const accounts = discord.accounts as Record<string, unknown> | undefined;
    if (accounts && typeof accounts === 'object') {
        return Object.keys(accounts);
    }

    // Single-account fallback — if token exists, return default
    if (discord.token || discord.botToken) {
        return ['default'];
    }
    return [];
}

function resolveDiscordAccount(params: {
    cfg: unknown;
    accountId: string;
}): ResolvedDiscordAccount | null {
    const config = params.cfg as Record<string, unknown> | undefined;
    const channels = config?.channels as Record<string, unknown> | undefined;
    const discord = channels?.discord as Record<string, unknown> | undefined;
    if (!discord) return null;

    const accounts = discord.accounts as Record<string, Record<string, unknown>> | undefined;
    const accountCfg = accounts?.[params.accountId] ?? discord;

    return {
        accountId: params.accountId,
        name: String(accountCfg.name ?? params.accountId),
        enabled: accountCfg.enabled !== false,
        token: (accountCfg.token ?? accountCfg.botToken ?? null) as string | null,
        botId: (accountCfg.botId ?? null) as string | null,
        config: {
            dm: accountCfg.dm as ResolvedDiscordAccount['config']['dm'],
            groupPolicy: accountCfg.groupPolicy as string | undefined,
            mediaMaxMb: accountCfg.mediaMaxMb as number | undefined,
            historyLimit: accountCfg.historyLimit as number | undefined,
            guilds: accountCfg.guilds as Record<string, unknown> | undefined,
            allowFrom: accountCfg.allowFrom as Array<string | number> | undefined,
        },
    };
}

// ─── Outbound Target ─────────────────────────────────────────────────────────

function normalizeDiscordTarget(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    // Strip Discord mention syntax: <@!123456789> → 123456789
    const mentionMatch = trimmed.match(/^<@!?(\d+)>$/);
    if (mentionMatch?.[1]) return `user:${mentionMatch[1]}`;
    // Strip channel mention: <#123456789> → channel:123456789
    const channelMatch = trimmed.match(/^<#(\d+)>$/);
    if (channelMatch?.[1]) return `channel:${channelMatch[1]}`;
    // Already prefixed
    if (/^(user|channel|guild):/.test(trimmed)) return trimmed;
    // Raw numeric ID → assume channel
    if (/^\d{17,20}$/.test(trimmed)) return `channel:${trimmed}`;
    return trimmed;
}

function normalizeDiscordAllowEntry(entry: string): string {
    return entry
        .trim()
        .replace(/^(discord|user):/i, '')
        .replace(/^<@!?(\d+)>$/, '$1');
}

// ─── Discord ChannelPlugin Definition ────────────────────────────────────────

export const discordPlugin: ChannelPlugin<ResolvedDiscordAccount, DiscordProbe> = {
    id: DISCORD_CHANNEL_ID,
    channelId: 'discord',
    meta: discordMeta,
    capabilities: discordCapabilities,
    defaults: {
        queue: { debounceMs: 300 },
    },
    reload: {
        configPrefixes: ['channels.discord'],
        noopPrefixes: ['channels.discord.guilds'],
    },
    config: {
        listAccountIds: (cfg) => listDiscordAccountIds(cfg),
        resolveAccount: (params) => resolveDiscordAccount(params),
    },
    pairing: {
        idLabel: 'discordUserId',
        normalizeAllowEntry: normalizeDiscordAllowEntry,
    },
    security: {
        resolveDmPolicy: (params) => {
            const account = params.account;
            const dm = account.config.dm;
            if (!dm) return undefined;
            return {
                policy: dm.policy ?? 'allowlist',
                allowFrom: dm.allowFrom ?? null,
                policyPath: 'channels.discord.dm.policy',
                allowFromPath: 'channels.discord.dm.allowFrom',
                approveHint: 'Use /pair discord <userId> to approve.',
            };
        },
    },
    groups: {
        resolveRequireMention: () => false,
        resolveToolPolicy: () => 'none',
    },
    mentions: {
        normalizeMention: (raw: any) => {
            const match = raw.match(/^<@!?(\d+)>$/);
            return match?.[1] ?? null;
        },
        formatMention: (id: any) => `<@${id}>`,
    },
    outbound: {
        deliveryMode: 'direct',
        chunker: null,
        textChunkLimit: 2000,
        pollMaxOptions: 10,
        resolveTarget: ({ to }) => {
            const normalized = normalizeDiscordTarget(to ?? '');
            return normalized
                ? { ok: true, to: normalized }
                : { ok: false, error: new Error('Invalid Discord target') };
        },
    },
    messaging: {
        normalizeTarget: (raw) => normalizeDiscordTarget(raw),
        formatTarget: (target: any) => String(target),
    },
    threading: {
        supportsThreading: true,
    },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const discord = channels?.discord as Record<string, unknown> | undefined;
            if (!discord?.token && !discord?.botToken) {
                return { ok: false, reason: 'Discord bot token not configured' };
            }
            return { ok: true, reason: 'Discord configured' };
        },
    },
    streaming: {
        supportsStreaming: false,
    },
    conversationBindings: {
        supportsCurrentConversationBinding: true,
    },
};

// ─── Registration ────────────────────────────────────────────────────────────

/** Register discordPlugin with the bundled channel registry. */
export function registerDiscordChannelPlugin(): void {
    registerBundledChannelPlugin({
        id: DISCORD_CHANNEL_ID,
        channelPlugin: discordPlugin as ChannelPlugin,
        setChannelRuntime: setDiscordRuntime,
    });
}
