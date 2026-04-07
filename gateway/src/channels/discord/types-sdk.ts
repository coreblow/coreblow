/**
 * src/channels/discord/types-sdk.ts
 * Strict SDK boundary types for Discord.
 * By defining these interfaces, we eliminate `unknown` types from our implementation
 * without needing to tightly couple to the actual discord.js package types which change often.
 * Follows OpenClaw explicit interface boundary pattern.
 */

export interface DiscordMessage {
    id: string;
    content: string;
    author: DiscordUser;
    channelId: string;
    guildId?: string;
    reference?: { messageId?: string };
    reply(content: unknown): Promise<DiscordMessage>;
    react(emoji: string): Promise<unknown>;
}

export interface DiscordUser {
    id: string;
    tag: string;
    bot?: boolean;
    createDM(): Promise<DiscordTextChannel>;
}

export interface DiscordTextChannel {
    id: string;
    send(content: unknown): Promise<DiscordMessage>;
    sendTyping(): Promise<void>;
}

export interface DiscordInteraction {
    id: string;
    user: DiscordUser;
    channelId: string;
    isCommand(): boolean;
    isButton(): boolean;
    isStringSelectMenu(): boolean;
    isModalSubmit(): boolean;
    deferReply(options?: { ephemeral?: boolean }): Promise<void>;
    reply(options: unknown): Promise<void>;
    editReply(options: unknown): Promise<void>;
    showModal(modal: unknown): Promise<void>;
    commandName?: string;
    customId?: string;
    options?: {
        getString(name: string): string | null;
        getInteger(name: string): number | null;
    };
    fields?: {
        getTextInputValue(customId: string): string;
    };
    values?: string[];
}

export interface DiscordClient {
    user: { tag: string; id: string } | null;
    guilds: { cache: { size: number } };
    channels: {
        cache: { get(id: string): DiscordTextChannel | undefined };
        fetch(id: string): Promise<DiscordTextChannel | null>;
    };
    users: {
        fetch(id: string): Promise<DiscordUser | null>;
    };
    on(event: string, listener: (...args: unknown[]) => void): void;
    login(token: string): Promise<string>;
    destroy(): void;
}

export interface DiscordReaction {
    emoji: { name: string; id?: string };
    message: DiscordMessage;
    count: number;
}

export interface DiscordThread {
    id: string;
    name: string;
    parentId?: string;
    archived?: boolean;
}

export interface DiscordMember {
    user: DiscordUser;
    displayName?: string;
    roles: { cache: Map<string, unknown> };
    joinedAt?: Date;
}

export interface DiscordVoiceState {
    channelId?: string;
    member?: DiscordMember;
    selfDeaf?: boolean;
    selfMute?: boolean;
}

export interface PaginationState {
    page: number;
    response: {
        pageCount: number;
        toPayload(): Record<string, unknown>;
        getPage(page: number): string;
        paginationButtons(page: number, sessionId: string): PaginationButton[];
    };
}

export interface PaginationButton {
    label: string;
    customId: string;
    disabled?: boolean;
}
