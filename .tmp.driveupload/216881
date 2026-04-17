/**
 * Discord Channel Types
 */
import type { DiscordInteraction } from './types-sdk.js';

export interface DiscordConfig {
    token: string;
    prefix?: string;
    allowedChannels?: string[];
    richResponses?: boolean;
    threadMode?: 'off' | 'auto' | 'manual';
    allowedRoles?: string[];
    thinkingEmoji?: string;
    registerSlashCommands?: boolean;
}

export interface DiscordEmbed {
    title?: string;
    description?: string;
    color?: number;
    fields?: EmbedField[];
    footer?: { text: string; icon_url?: string };
    thumbnail?: { url: string };
    image?: { url: string };
    timestamp?: string;
    author?: { name: string; icon_url?: string; url?: string };
    url?: string;
}

export interface EmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

export interface DiscordButton {
    label: string;
    customId: string;
    style?: ButtonStyle;
    emoji?: string;
    disabled?: boolean;
    url?: string;
}

export type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger' | 'link';

export interface DiscordSelectOption {
    label: string;
    value: string;
    description?: string;
    emoji?: string;
    default?: boolean;
}

export interface DiscordSelectMenu {
    customId: string;
    placeholder?: string;
    options: DiscordSelectOption[];
    minValues?: number;
    maxValues?: number;
}

export interface DiscordModal {
    customId: string;
    title: string;
    fields: ModalField[];
}

export interface ModalField {
    customId: string;
    label: string;
    style?: 'short' | 'paragraph';
    placeholder?: string;
    required?: boolean;
    value?: string;
    minLength?: number;
    maxLength?: number;
}

export interface SlashCommand {
    name: string;
    description: string;
    options?: CommandOption[];
    handler?: (interaction: DiscordInteraction) => Promise<unknown>;
}

export interface CommandOption {
    name: string;
    description: string;
    type: number;
    required?: boolean;
    choices?: { name: string; value: string }[];
}

export interface InboundMessage {
    content: string;
    senderId: string;
    senderName: string;
    channelId: string;
    guildId?: string;
    attachments?: AttachmentInfo[];
    replyTo?: string;
}

export interface AttachmentInfo {
    name: string;
    url: string;
    size: number;
    contentType?: string;
}

export interface ChannelStats {
    messageCount: number;
    reactionCount: number;
    componentsHandled: number;
    selectMenusUsed: number;
    modalsOpened: number;
    paginatedResponses: number;
}

export interface VoiceState {
    connected: boolean;
    channelId?: string;
    speaking: boolean;
}

export interface ThreadInfo {
    id: string;
    name: string;
    parentId: string;
    archived: boolean;
    locked: boolean;
}

export interface CooldownEntry {
    userId: string;
    command: string;
    expiresAt: number;
}

export interface MiddlewareContext {
    message: InboundMessage;
    respond: (text: string) => Promise<void>;
    metadata: Record<string, unknown>;
}
