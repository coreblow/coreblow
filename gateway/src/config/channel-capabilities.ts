/**
 * config/channel-capabilities.ts
 * Per-channel feature capability matrix.
 * Ported from CoreBlow src/config/channel-capabilities.ts.
 */

export interface ChannelCapabilities {
    supportsAttachments: boolean;
    supportsReactions: boolean;
    supportsThreads: boolean;
    supportsTypingIndicator: boolean;
    supportsEditMessage: boolean;
    supportsDeleteMessage: boolean;
    supportsRichEmbed: boolean;
    supportsInlineButtons: boolean;
    supportsVoice: boolean;
    maxMessageLength: number;
}

type CapabilitiesConfig = string[] | Record<string, unknown> | undefined;

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const CHANNEL_DEFAULTS: Record<string, ChannelCapabilities> = {
    discord: {
        supportsAttachments: true, supportsReactions: true, supportsThreads: true,
        supportsTypingIndicator: true, supportsEditMessage: true, supportsDeleteMessage: true,
        supportsRichEmbed: true, supportsInlineButtons: true, supportsVoice: true,
        maxMessageLength: 2000,
    },
    telegram: {
        supportsAttachments: true, supportsReactions: true, supportsThreads: false,
        supportsTypingIndicator: true, supportsEditMessage: true, supportsDeleteMessage: true,
        supportsRichEmbed: false, supportsInlineButtons: true, supportsVoice: true,
        maxMessageLength: 4096,
    },
    slack: {
        supportsAttachments: true, supportsReactions: true, supportsThreads: true,
        supportsTypingIndicator: true, supportsEditMessage: true, supportsDeleteMessage: true,
        supportsRichEmbed: true, supportsInlineButtons: true, supportsVoice: false,
        maxMessageLength: 40000,
    },
    signal: {
        supportsAttachments: true, supportsReactions: true, supportsThreads: false,
        supportsTypingIndicator: false, supportsEditMessage: false, supportsDeleteMessage: false,
        supportsRichEmbed: false, supportsInlineButtons: false, supportsVoice: false,
        maxMessageLength: 65536,
    },
    gmail: {
        supportsAttachments: true, supportsReactions: false, supportsThreads: true,
        supportsTypingIndicator: false, supportsEditMessage: false, supportsDeleteMessage: false,
        supportsRichEmbed: true, supportsInlineButtons: false, supportsVoice: false,
        maxMessageLength: 1000000,
    },
    whatsapp: {
        supportsAttachments: true, supportsReactions: true, supportsThreads: false,
        supportsTypingIndicator: true, supportsEditMessage: false, supportsDeleteMessage: true,
        supportsRichEmbed: false, supportsInlineButtons: true, supportsVoice: true,
        maxMessageLength: 65536,
    },
    imessage: {
        supportsAttachments: true, supportsReactions: true, supportsThreads: false,
        supportsTypingIndicator: true, supportsEditMessage: false, supportsDeleteMessage: false,
        supportsRichEmbed: false, supportsInlineButtons: false, supportsVoice: false,
        maxMessageLength: 20000,
    },
};

const FALLBACK: ChannelCapabilities = {
    supportsAttachments: false, supportsReactions: false, supportsThreads: false,
    supportsTypingIndicator: false, supportsEditMessage: false, supportsDeleteMessage: false,
    supportsRichEmbed: false, supportsInlineButtons: false, supportsVoice: false,
    maxMessageLength: 4096,
};

function normalizeChannelId(channel?: string | null): string | undefined {
    return channel?.trim().toLowerCase() || undefined;
}

function normalizeCapabilities(capabilities: CapabilitiesConfig): string[] | undefined {
    if (!isStringArray(capabilities)) return undefined;
    const normalized = capabilities.map((e) => e.trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
}

/**
 * Resolve capabilities for a channel, merging defaults with config overrides.
 */
export function resolveChannelCapabilities(params: {
    cfg?: Record<string, unknown>;
    channel?: string | null;
    accountId?: string | null;
}): ChannelCapabilities {
    const channel = normalizeChannelId(params.channel);
    if (!channel) return { ...FALLBACK };

    const defaults = CHANNEL_DEFAULTS[channel] ?? FALLBACK;
    if (!params.cfg) return { ...defaults };

    const channelsConfig = params.cfg.channels as Record<string, unknown> | undefined;
    const channelConfig = channelsConfig?.[channel] as Record<string, unknown> | undefined;
    if (!channelConfig?.capabilities) return { ...defaults };

    const caps = normalizeCapabilities(channelConfig.capabilities as CapabilitiesConfig);
    if (!caps) return { ...defaults };

    // Capability strings override defaults
    const result = { ...defaults };
    for (const cap of caps) {
        switch (cap) {
            case 'no-attachments': result.supportsAttachments = false; break;
            case 'no-reactions': result.supportsReactions = false; break;
            case 'no-threads': result.supportsThreads = false; break;
            case 'no-typing': result.supportsTypingIndicator = false; break;
            case 'no-edit': result.supportsEditMessage = false; break;
            case 'no-delete': result.supportsDeleteMessage = false; break;
            case 'no-embed': result.supportsRichEmbed = false; break;
            case 'no-buttons': result.supportsInlineButtons = false; break;
            case 'no-voice': result.supportsVoice = false; break;
        }
    }
    return result;
}

/**
 * Get the list of all known channel IDs.
 */
export function listKnownChannels(): string[] {
    return Object.keys(CHANNEL_DEFAULTS);
}

/**
 * Check if a channel supports a specific capability.
 */
export function channelSupports(
    channel: string,
    capability: keyof ChannelCapabilities,
    cfg?: Record<string, unknown>,
): boolean {
    const caps = resolveChannelCapabilities({ cfg, channel });
    return caps[capability] as boolean;
}
