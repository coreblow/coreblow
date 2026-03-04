/**
 * src/gateway/router.ts
 * Message router — routes inbound messages to the correct agent
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('router');

export interface InboundMessage {
    channel: string;        // 'telegram' | 'discord' | 'webchat'
    senderId: string;       // unique user identifier
    senderName: string;     // display name
    sessionId: string;      // derived session key
    groupId?: string;       // group/server ID (if group message)
    text: string;           // message text
    media?: {               // attached media
        type: 'image' | 'audio' | 'video' | 'document';
        url?: string;
        buffer?: Buffer;
        mimeType?: string;
        filename?: string;
    };
    replyTo?: string;       // ID of message being replied to
    timestamp: number;
    raw?: any;              // raw channel-specific data
}

export interface OutboundMessage {
    channel: string;
    senderId: string;
    groupId?: string;
    text: string;
    media?: {
        type: string;
        url?: string;
        buffer?: Buffer;
        mimeType?: string;
    };
    replyToMessageId?: string;
}

export type MessageHandler = (message: InboundMessage) => Promise<void>;

export class MessageRouter {
    private handlers: MessageHandler[] = [];
    private channelSenders: Map<string, (msg: OutboundMessage) => Promise<void>> = new Map();

    /**
     * Register a message handler (agent turn loop)
     */
    onMessage(handler: MessageHandler) {
        this.handlers.push(handler);
    }

    /**
     * Register a channel's send function
     */
    registerChannelSender(channel: string, sender: (msg: OutboundMessage) => Promise<void>) {
        this.channelSenders.set(channel, sender);
        log.info({ channel }, 'Channel sender registered');
    }

    /**
     * Route an inbound message to all handlers
     */
    async routeInbound(message: InboundMessage) {
        log.info({
            channel: message.channel,
            sender: message.senderName,
            text: message.text.substring(0, 100),
            session: message.sessionId,
        }, 'Routing inbound message');

        for (const handler of this.handlers) {
            try {
                await handler(message);
            } catch (err) {
                log.error({ err, channel: message.channel }, 'Handler error');
            }
        }
    }

    /**
     * Send a reply back through the originating channel
     */
    async sendReply(message: OutboundMessage) {
        const sender = this.channelSenders.get(message.channel);
        if (!sender) {
            log.warn({ channel: message.channel }, 'No sender registered for channel');
            return;
        }

        try {
            await sender(message);
            log.debug({
                channel: message.channel,
                textLength: message.text.length,
            }, 'Reply sent');
        } catch (err) {
            log.error({ err, channel: message.channel }, 'Failed to send reply');
        }
    }

    /**
     * Derive session ID from channel + sender + group
     */
    static deriveSessionId(channel: string, senderId: string, groupId?: string): string {
        if (groupId) {
            return `${channel}:group:${groupId}`;
        }
        return `${channel}:dm:${senderId}`;
    }
}
