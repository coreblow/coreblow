/**
 * CoreBlow — Cross-Channel Message Tool
 *
 * Enables agents to send messages across any connected channel
 * (Discord, Telegram, Slack, etc.) with unified routing,
 * format adaptation, and delivery tracking.
 */

import { createChildLogger } from '../../utils/logger.js';
import type {
    ChannelId,
    ChannelAdapter,
    ChannelOutbound,
    DeliveryResult,
} from '../../channels/adapter.js';

const log = createChildLogger('tool:message');

/** Message routing target */
export interface MessageTarget {
    channel: ChannelId;
    to: string;
    threadId?: string;
}

/** Cross-channel message request */
export interface CrossChannelMessage {
    targets: MessageTarget[];
    text: string;
    format?: 'plain' | 'markdown' | 'html';
    attachments?: Array<{
        type: 'image' | 'file';
        url?: string;
        buffer?: Buffer;
        fileName?: string;
    }>;
    silent?: boolean;
}

/** Delivery report for a message */
export interface DeliveryReport {
    target: MessageTarget;
    success: boolean;
    messageId?: string;
    error?: string;
    deliveredAt?: number;
    formattedText?: string;
}

/** Full send result */
export interface SendResult {
    totalTargets: number;
    delivered: number;
    failed: number;
    reports: DeliveryReport[];
}

/** Format adapter — converts markdown to platform-specific format */
export interface FormatAdapter {
    channelId: ChannelId;
    convert(text: string, from: 'markdown' | 'html' | 'plain'): string;
    maxLength(): number;
}

/** Default format adapters for known channels */
const formatAdapters: Record<string, FormatAdapter> = {
    discord: {
        channelId: 'discord',
        convert: (text, from) => from === 'html' ? stripHtml(text) : text,
        maxLength: () => 2000,
    },
    telegram: {
        channelId: 'telegram',
        convert: (text, from) => from === 'markdown' ? markdownToHtml(text) : text,
        maxLength: () => 4096,
    },
    slack: {
        channelId: 'slack',
        convert: (text, from) => from === 'markdown' ? markdownToMrkdwn(text) : text,
        maxLength: () => 40000,
    },
    irc: {
        channelId: 'irc',
        convert: (text) => stripFormatting(text),
        maxLength: () => 512,
    },
    webchat: {
        channelId: 'webchat',
        convert: (text) => text,
        maxLength: () => 10000,
    },
    teams: {
        channelId: 'teams',
        convert: (text) => text,
        maxLength: () => 28000,
    },
    line: {
        channelId: 'line',
        convert: (text) => stripFormatting(text),
        maxLength: () => 5000,
    },
    matrix: {
        channelId: 'matrix',
        convert: (text) => text,
        maxLength: () => 65536,
    },
};

/**
 * CoreBlow Cross-Channel Messenger
 *
 * Routes messages to the appropriate channel adapter with
 * automatic format conversion and chunking.
 */
export class CrossChannelMessenger {
    private adapters = new Map<ChannelId, ChannelAdapter>();

    /** Register a channel adapter */
    registerAdapter(adapter: ChannelAdapter): void {
        this.adapters.set(adapter.id, adapter);
    }

    /** Unregister a channel adapter */
    unregisterAdapter(channelId: ChannelId): boolean {
        return this.adapters.delete(channelId);
    }

    /** List registered channels */
    listChannels(): ChannelId[] {
        return [...this.adapters.keys()];
    }

    /**
     * Send a message to one or more targets across channels.
     */
    async send(message: CrossChannelMessage): Promise<SendResult> {
        const result: SendResult = {
            totalTargets: message.targets.length,
            delivered: 0,
            failed: 0,
            reports: [],
        };

        for (const target of message.targets) {
            const report = await this.deliverToTarget(target, message);
            result.reports.push(report);
            if (report.success) result.delivered++;
            else result.failed++;
        }

        log.info({
            targets: result.totalTargets,
            delivered: result.delivered,
            failed: result.failed,
        }, 'Cross-channel send complete');

        return result;
    }

    /**
     * Send to a single target with format conversion.
     */
    async sendToOne(
        channel: ChannelId,
        to: string,
        text: string,
        options?: { format?: 'plain' | 'markdown'; silent?: boolean; threadId?: string },
    ): Promise<DeliveryReport> {
        return this.deliverToTarget(
            { channel, to, threadId: options?.threadId },
            { targets: [{ channel, to }], text, format: options?.format, silent: options?.silent },
        );
    }

    /**
     * Broadcast to all registered channels.
     */
    async broadcast(text: string, options?: {
        format?: 'plain' | 'markdown';
        defaultTo?: string;
        excludeChannels?: ChannelId[];
    }): Promise<SendResult> {
        const targets: MessageTarget[] = [];
        for (const channelId of this.adapters.keys()) {
            if (options?.excludeChannels?.includes(channelId)) continue;
            if (options?.defaultTo) {
                targets.push({ channel: channelId, to: options.defaultTo });
            }
        }
        return this.send({ targets, text, format: options?.format });
    }

    // === Private ===

    private async deliverToTarget(target: MessageTarget, message: CrossChannelMessage): Promise<DeliveryReport> {
        const adapter = this.adapters.get(target.channel);
        if (!adapter) {
            return {
                target,
                success: false,
                error: `No adapter registered for channel: ${target.channel}`,
            };
        }

        try {
            // Format conversion
            const fmt = formatAdapters[target.channel];
            const formattedText = fmt
                ? fmt.convert(message.text, message.format ?? 'plain')
                : message.text;

            // Chunk if needed
            const maxLen = fmt?.maxLength() ?? 4096;
            const chunks = chunkText(formattedText, maxLen);

            let lastMessageId: string | undefined;
            for (const chunk of chunks) {
                const outbound: ChannelOutbound = {
                    to: target.to,
                    text: chunk,
                    threadId: target.threadId,
                    silent: message.silent,
                    attachments: message.attachments,
                };

                const delivery: DeliveryResult = await adapter.send(outbound);
                if (!delivery.success) {
                    return {
                        target,
                        success: false,
                        error: delivery.error ?? 'Delivery failed',
                        formattedText,
                    };
                }
                lastMessageId = delivery.messageId;
            }

            return {
                target,
                success: true,
                messageId: lastMessageId,
                deliveredAt: Date.now(),
                formattedText,
            };
        } catch (err) {
            return {
                target,
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
}

// === Format Helpers ===

function chunkText(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxLen) {
        chunks.push(text.slice(i, i + maxLen));
    }
    return chunks;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function stripFormatting(text: string): string {
    return text.replace(/[*_~`]/g, '');
}

function markdownToHtml(md: string): string {
    return md
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/`(.*?)`/g, '<code>$1</code>');
}

function markdownToMrkdwn(md: string): string {
    // Slack mrkdwn is similar to markdown but uses * for bold and _ for italic
    return md.replace(/\*\*(.*?)\*\*/g, '*$1*');
}

/**
 * Create a tool definition for the cross-channel messenger.
 */
export function createMessageToolDefinition(messenger: CrossChannelMessenger) {
    return {
        name: 'message',
        description: 'Send messages across channels (Discord, Telegram, Slack, IRC, Teams, LINE, Matrix, WebChat).',
        category: 'messaging',
        parameters: {
            type: 'object' as const,
            properties: {
                channel: { type: 'string', description: 'Target channel (discord, telegram, slack, irc, teams, line, matrix, webchat)' },
                to: { type: 'string', description: 'Target user/chat/room ID' },
                text: { type: 'string', description: 'Message text (supports markdown)' },
                format: { type: 'string', enum: ['plain', 'markdown', 'html'], description: 'Text format' },
                threadId: { type: 'string', description: 'Thread ID for threaded conversations' },
            },
            required: ['channel', 'to', 'text'],
        },
        handler: async (args: Record<string, unknown>): Promise<string> => {
            const report = await messenger.sendToOne(
                args.channel as ChannelId,
                args.to as string,
                args.text as string,
                {
                    format: args.format as 'plain' | 'markdown' | undefined,
                    threadId: args.threadId as string | undefined,
                },
            );
            return JSON.stringify(report);
        },
    };
}
