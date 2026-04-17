// @ts-nocheck
/**
 * channels/plugins/channel-plugin-definitions.ts
 * CoreBlow built-in channel plugin definitions.
 * Each channel registers with the bundled channel registry.
 */
import type { ChannelPlugin } from './types.plugin.js';
import type { ChannelId, ChannelMeta } from './types.js';
import type { ChannelCapabilities } from '../../config/channel-capabilities.js';
import { registerBundledChannelPlugin } from './bundled.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMeta(id: ChannelId, label: string, blurb: string, opts?: Partial<ChannelMeta>): ChannelMeta {
    return {
        id,
        label,
        selectionLabel: label,
        docsPath: `channels/${id}`,
        blurb,
        order: opts?.order ?? 10,
        aliases: opts?.aliases ?? [],
        quickstartAllowFrom: opts?.quickstartAllowFrom ?? false,
        forceAccountBinding: opts?.forceAccountBinding ?? false,
        ...opts,
    };
}

function buildCaps(overrides?: Partial<ChannelCapabilities>): ChannelCapabilities {
    return {
        supportsAttachments: true,
        supportsReactions: false,
        supportsThreads: false,
        supportsTypingIndicator: false,
        supportsEditMessage: false,
        supportsDeleteMessage: false,
        supportsRichEmbed: false,
        supportsInlineButtons: false,
        supportsVoice: false,
        maxMessageLength: 4096,
        ...overrides,
    };
}

function resolveSimpleAccountIds(cfg: unknown, channelKey: string): string[] {
    const config = cfg as Record<string, unknown> | undefined;
    const channels = config?.channels as Record<string, unknown> | undefined;
    const channel = channels?.[channelKey] as Record<string, unknown> | undefined;
    if (!channel) return [];
    const accounts = channel.accounts as Record<string, unknown> | undefined;
    if (accounts && typeof accounts === 'object') return Object.keys(accounts);
    return ['default'];
}

// ─── Telegram Plugin ─────────────────────────────────────────────────────────

export const telegramPlugin: ChannelPlugin = {
    id: 'telegram',
    channelId: 'telegram',
    meta: buildMeta('telegram', 'Telegram', 'Connect CoreBlow to Telegram bots and groups.', {
        order: 2,
        quickstartAllowFrom: true,
    }),
    capabilities: buildCaps({
        supportsReactions: true,
        supportsEditMessage: true,
        supportsDeleteMessage: true,
        supportsInlineButtons: true,
        maxMessageLength: 4096,
    }),
    defaults: { queue: { debounceMs: 200 } },
    reload: { configPrefixes: ['channels.telegram'] },
    config: {
        listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'telegram'),
    },
    pairing: {
        idLabel: 'telegramUserId',
        normalizeAllowEntry: (entry) => entry.trim().replace(/^(telegram|user):/i, ''),
    },
    groups: {
        resolveRequireMention: () => true,
        resolveToolPolicy: () => 'none',
    },
    mentions: {
        normalizeMention: (raw: any) => raw.replace(/^@/, '') || null,
        formatMention: (id: any) => `@${id}`,
    },
    outbound: {
        deliveryMode: 'direct',
        chunker: null,
        textChunkLimit: 4096,
        pollMaxOptions: 10,
    },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    threading: { supportsThreading: false },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const telegram = channels?.telegram as Record<string, unknown> | undefined;
            if (!telegram?.token && !telegram?.botToken) {
                return { ok: false, reason: 'Telegram bot token not configured' };
            }
            return { ok: true, reason: 'Telegram configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── WhatsApp Plugin ─────────────────────────────────────────────────────────

export const whatsappPlugin: ChannelPlugin = {
    id: 'whatsapp',
    channelId: 'whatsapp',
    meta: buildMeta('whatsapp', 'WhatsApp', 'Connect CoreBlow to WhatsApp via web pairing.', {
        order: 3,
        quickstartAllowFrom: true,
    }),
    capabilities: buildCaps({
        supportsReactions: true,
        supportsVoice: true,
        maxMessageLength: 65536,
    }),
    defaults: { queue: { debounceMs: 500 } },
    reload: { configPrefixes: ['channels.whatsapp'] },
    config: {
        listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'whatsapp'),
    },
    pairing: {
        idLabel: 'phoneNumber',
        normalizeAllowEntry: (entry) => {
            const trimmed = entry.trim().replace(/[\s\-()]/g, '');
            return trimmed.startsWith('+') ? trimmed : trimmed;
        },
    },
    groups: {
        resolveRequireMention: () => false,
        resolveToolPolicy: () => 'none',
    },
    outbound: {
        deliveryMode: 'direct',
        chunker: null,
        textChunkLimit: 65536,
    },
    messaging: {
        normalizeTarget: (raw) => {
            const trimmed = raw.trim().replace(/[\s\-()]/g, '');
            return trimmed.replace(/^(whatsapp|wa):/i, '');
        },
        formatTarget: (target: any) => String(target),
    },
    threading: { supportsThreading: false },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const whatsapp = channels?.whatsapp as Record<string, unknown> | undefined;
            if (!whatsapp) return { ok: false, reason: 'WhatsApp not configured' };
            return { ok: true, reason: 'WhatsApp configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── Slack Plugin ────────────────────────────────────────────────────────────

export const slackPlugin: ChannelPlugin = {
    id: 'slack',
    channelId: 'slack',
    meta: buildMeta('slack', 'Slack', 'Connect CoreBlow to Slack workspaces.', {
        order: 4,
    }),
    capabilities: buildCaps({
        supportsReactions: true,
        supportsThreads: true,
        supportsEditMessage: true,
        supportsDeleteMessage: true,
        supportsRichEmbed: true,
        supportsInlineButtons: true,
        maxMessageLength: 40000,
    }),
    defaults: { queue: { debounceMs: 300 } },
    reload: { configPrefixes: ['channels.slack'] },
    config: {
        listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'slack'),
    },
    pairing: {
        idLabel: 'slackUserId',
        normalizeAllowEntry: (entry) => entry.trim().replace(/^(slack|user):/i, '').toUpperCase(),
    },
    groups: {
        resolveRequireMention: () => true,
        resolveToolPolicy: () => 'none',
    },
    mentions: {
        normalizeMention: (raw: any) => {
            const match = raw.match(/^<@([A-Z0-9]+)>$/);
            return match?.[1] ?? null;
        },
        formatMention: (id: any) => `<@${id}>`,
    },
    outbound: {
        deliveryMode: 'direct',
        chunker: null,
        chunkerMode: 'markdown',
        textChunkLimit: 40000,
    },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    threading: { supportsThreading: true },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const slack = channels?.slack as Record<string, unknown> | undefined;
            if (!slack?.botToken && !slack?.appToken && !slack?.token) {
                return { ok: false, reason: 'Slack tokens not configured' };
            }
            return { ok: true, reason: 'Slack configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── Signal Plugin ───────────────────────────────────────────────────────────

export const signalPlugin: ChannelPlugin = {
    id: 'signal',
    channelId: 'signal',
    meta: buildMeta('signal', 'Signal', 'Connect CoreBlow to Signal Messenger.', {
        order: 5,
    }),
    capabilities: buildCaps({
        supportsReactions: true,
        supportsVoice: false,
        maxMessageLength: 65536,
    }),
    defaults: { queue: { debounceMs: 300 } },
    reload: { configPrefixes: ['channels.signal'] },
    config: {
        listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'signal'),
    },
    pairing: {
        idLabel: 'phoneNumber',
        normalizeAllowEntry: (entry) => entry.trim().replace(/[\s\-()]/g, ''),
    },
    outbound: {
        deliveryMode: 'direct',
        chunker: null,
        textChunkLimit: 65536,
    },
    messaging: {
        normalizeTarget: (raw) => raw.trim().replace(/[\s\-()]/g, ''),
        formatTarget: (target: any) => String(target),
    },
    threading: { supportsThreading: false },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const signal = channels?.signal as Record<string, unknown> | undefined;
            if (!signal) return { ok: false, reason: 'Signal not configured' };
            return { ok: true, reason: 'Signal configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── iMessage Plugin ─────────────────────────────────────────────────────────

export const imessagePlugin: ChannelPlugin = {
    id: 'imessage',
    channelId: 'imessage',
    meta: buildMeta('imessage', 'iMessage', 'Connect CoreBlow to iMessage via AppleScript bridge.', {
        order: 6,
    }),
    capabilities: buildCaps({ maxMessageLength: 65536 }),
    defaults: { queue: { debounceMs: 500 } },
    reload: { configPrefixes: ['channels.imessage'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'imessage') },
    pairing: {
        idLabel: 'appleId',
        normalizeAllowEntry: (entry) => entry.trim().toLowerCase(),
    },
    outbound: { deliveryMode: 'direct', textChunkLimit: 65536 },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            if (!channels?.imessage) return { ok: false, reason: 'iMessage not configured' };
            return { ok: true, reason: 'iMessage configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── IRC Plugin ──────────────────────────────────────────────────────────────

export const ircPlugin: ChannelPlugin = {
    id: 'irc',
    channelId: 'irc',
    meta: buildMeta('irc', 'IRC', 'Connect CoreBlow to IRC networks.', { order: 7 }),
    capabilities: buildCaps({
        supportsAttachments: false,
        maxMessageLength: 512,
    }),
    defaults: { queue: { debounceMs: 100 } },
    reload: { configPrefixes: ['channels.irc'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'irc') },
    outbound: { deliveryMode: 'direct', textChunkLimit: 512 },
    messaging: {
        normalizeTarget: (raw) => raw.trim().toLowerCase(),
        formatTarget: (target: any) => String(target),
    },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const irc = channels?.irc as Record<string, unknown> | undefined;
            if (!irc?.server) return { ok: false, reason: 'IRC server not configured' };
            return { ok: true, reason: 'IRC configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── LINE Plugin ─────────────────────────────────────────────────────────────

export const linePlugin: ChannelPlugin = {
    id: 'line',
    channelId: 'line',
    meta: buildMeta('line', 'LINE', 'Connect CoreBlow to LINE Messaging API.', { order: 8 }),
    capabilities: buildCaps({
        supportsRichEmbed: true,
        supportsInlineButtons: true,
        maxMessageLength: 5000,
    }),
    defaults: { queue: { debounceMs: 300 } },
    reload: { configPrefixes: ['channels.line'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'line') },
    pairing: {
        idLabel: 'lineUserId',
        normalizeAllowEntry: (entry) => entry.trim(),
    },
    outbound: { deliveryMode: 'direct', textChunkLimit: 5000 },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const line = channels?.line as Record<string, unknown> | undefined;
            if (!line?.channelAccessToken && !line?.token) {
                return { ok: false, reason: 'LINE access token not configured' };
            }
            return { ok: true, reason: 'LINE configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── Matrix Plugin ───────────────────────────────────────────────────────────

export const matrixPlugin: ChannelPlugin = {
    id: 'matrix',
    channelId: 'matrix',
    meta: buildMeta('matrix', 'Matrix', 'Connect CoreBlow to Matrix homeservers.', { order: 9 }),
    capabilities: buildCaps({
        supportsThreads: true,
        supportsReactions: true,
        supportsEditMessage: true,
        maxMessageLength: 65536,
    }),
    defaults: { queue: { debounceMs: 300 } },
    reload: { configPrefixes: ['channels.matrix'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'matrix') },
    pairing: {
        idLabel: 'matrixUserId',
        normalizeAllowEntry: (entry) => entry.trim().toLowerCase(),
    },
    outbound: { deliveryMode: 'direct', textChunkLimit: 65536 },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    threading: { supportsThreading: true },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const matrix = channels?.matrix as Record<string, unknown> | undefined;
            if (!matrix?.homeserverUrl) return { ok: false, reason: 'Matrix homeserver not configured' };
            return { ok: true, reason: 'Matrix configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── Feishu Plugin ───────────────────────────────────────────────────────────

export const feishuPlugin: ChannelPlugin = {
    id: 'feishu',
    channelId: 'feishu',
    meta: buildMeta('feishu', 'Feishu', 'Connect CoreBlow to Feishu/Lark workspaces.', { order: 10 }),
    capabilities: buildCaps({
        supportsRichEmbed: true,
        supportsInlineButtons: true,
        supportsThreads: true,
        maxMessageLength: 4096,
    }),
    defaults: { queue: { debounceMs: 300 } },
    reload: { configPrefixes: ['channels.feishu'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'feishu') },
    pairing: {
        idLabel: 'feishuUserId',
        normalizeAllowEntry: (entry) => entry.trim(),
    },
    outbound: { deliveryMode: 'direct', textChunkLimit: 4096 },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    threading: { supportsThreading: true },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const feishu = channels?.feishu as Record<string, unknown> | undefined;
            if (!feishu?.appId) return { ok: false, reason: 'Feishu app ID not configured' };
            return { ok: true, reason: 'Feishu configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── Mattermost Plugin ───────────────────────────────────────────────────────

export const mattermostPlugin: ChannelPlugin = {
    id: 'mattermost',
    channelId: 'mattermost',
    meta: buildMeta('mattermost', 'Mattermost', 'Connect CoreBlow to Mattermost servers.', { order: 11 }),
    capabilities: buildCaps({
        supportsThreads: true,
        supportsReactions: true,
        supportsEditMessage: true,
        maxMessageLength: 16383,
    }),
    defaults: { queue: { debounceMs: 300 } },
    reload: { configPrefixes: ['channels.mattermost'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'mattermost') },
    pairing: {
        idLabel: 'mattermostUserId',
        normalizeAllowEntry: (entry) => entry.trim(),
    },
    outbound: { deliveryMode: 'direct', textChunkLimit: 16383 },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    threading: { supportsThreading: true },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const mm = channels?.mattermost as Record<string, unknown> | undefined;
            if (!mm?.url) return { ok: false, reason: 'Mattermost URL not configured' };
            return { ok: true, reason: 'Mattermost configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── BlueBubbles Plugin ──────────────────────────────────────────────────────

export const bluebubblesPlugin: ChannelPlugin = {
    id: 'bluebubbles',
    channelId: 'bluebubbles',
    meta: buildMeta('bluebubbles', 'BlueBubbles', 'Connect CoreBlow to iMessage via BlueBubbles server.', { order: 12 }),
    capabilities: buildCaps({
        supportsAttachments: true,
        supportsReactions: true,
        maxMessageLength: 65536,
    }),
    defaults: { queue: { debounceMs: 500 } },
    reload: { configPrefixes: ['channels.bluebubbles'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'bluebubbles') },
    pairing: {
        idLabel: 'appleId',
        normalizeAllowEntry: (entry) => entry.trim().toLowerCase(),
    },
    outbound: { deliveryMode: 'direct', textChunkLimit: 65536 },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const bb = channels?.bluebubbles as Record<string, unknown> | undefined;
            if (!bb?.serverUrl && !bb?.url) return { ok: false, reason: 'BlueBubbles server not configured' };
            return { ok: true, reason: 'BlueBubbles configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── Synology Chat Plugin ────────────────────────────────────────────────────

export const synologyChatPlugin: ChannelPlugin = {
    id: 'synology-chat',
    channelId: 'synology-chat',
    meta: buildMeta('synology-chat', 'Synology Chat', 'Connect CoreBlow to Synology Chat.', { order: 13 }),
    capabilities: buildCaps({ maxMessageLength: 4096 }),
    defaults: { queue: { debounceMs: 300 } },
    reload: { configPrefixes: ['channels.synology-chat'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'synology-chat') },
    outbound: { deliveryMode: 'direct', textChunkLimit: 4096 },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            if (!channels?.['synology-chat']) return { ok: false, reason: 'Synology Chat not configured' };
            return { ok: true, reason: 'Synology Chat configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── Zalo Plugin ─────────────────────────────────────────────────────────────

export const zaloPlugin: ChannelPlugin = {
    id: 'zalo',
    channelId: 'zalo',
    meta: buildMeta('zalo', 'Zalo', 'Connect CoreBlow to Zalo messaging.', { order: 14 }),
    capabilities: buildCaps({
        supportsAttachments: true,
        maxMessageLength: 2000,
    }),
    defaults: { queue: { debounceMs: 300 } },
    reload: { configPrefixes: ['channels.zalo'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'zalo') },
    outbound: { deliveryMode: 'direct', textChunkLimit: 2000 },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            const zalo = channels?.zalo as Record<string, unknown> | undefined;
            if (!zalo?.oaId && !zalo?.appId) return { ok: false, reason: 'Zalo OA not configured' };
            return { ok: true, reason: 'Zalo configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── Nextcloud Talk Plugin ─────────────────────────────────────────────

export const nextcloudTalkPlugin: ChannelPlugin = {
    id: 'nextcloud-talk',
    channelId: 'nextcloud-talk',
    meta: buildMeta('nextcloud-talk', 'Nextcloud Talk', 'Connect CoreBlow to Nextcloud Talk.', { order: 15 }),
    capabilities: buildCaps({ maxMessageLength: 32000 }),
    defaults: { queue: { debounceMs: 300 } },
    reload: { configPrefixes: ['channels.nextcloud-talk'] },
    config: { listAccountIds: (cfg) => resolveSimpleAccountIds(cfg, 'nextcloud-talk') },
    outbound: { deliveryMode: 'direct', textChunkLimit: 32000 },
    messaging: {
        normalizeTarget: (raw) => raw.trim(),
        formatTarget: (target: any) => String(target),
    },
    heartbeat: {
        checkReady: async (params) => {
            const cfg = params.cfg as Record<string, unknown> | undefined;
            const channels = cfg?.channels as Record<string, unknown> | undefined;
            if (!channels?.['nextcloud-talk']) return { ok: false, reason: 'Nextcloud Talk not configured' };
            return { ok: true, reason: 'Nextcloud Talk configured' };
        },
    },
    conversationBindings: { supportsCurrentConversationBinding: true },
};

// ─── Registration ────────────────────────────────────────────────────────────

const ALL_CHANNEL_PLUGINS: Array<{ plugin: ChannelPlugin; setRuntime?: (runtime: unknown) => void }> = [
    { plugin: telegramPlugin },
    { plugin: whatsappPlugin },
    { plugin: slackPlugin },
    { plugin: signalPlugin },
    { plugin: imessagePlugin },
    { plugin: ircPlugin },
    { plugin: linePlugin },
    { plugin: matrixPlugin },
    { plugin: feishuPlugin },
    { plugin: mattermostPlugin },
    { plugin: bluebubblesPlugin },
    { plugin: synologyChatPlugin },
    { plugin: zaloPlugin },
    { plugin: nextcloudTalkPlugin },
];

/**
 * Register all built-in channel plugins with the bundled channel registry.
 * Call this once during application bootstrap.
 */
export function registerBuiltinChannelPlugins(): void {
    for (const { plugin, setRuntime } of ALL_CHANNEL_PLUGINS) {
        registerBundledChannelPlugin({
            id: plugin.id,
            channelPlugin: plugin,
            setChannelRuntime: setRuntime,
        });
    }
}
