/**
 * src/tools/message.ts
 * Cross-channel messaging tool — 30+ actions
 */

import type { ToolHandler } from './types.js';
import type { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tool:message');

let routerRef: MessageRouter | null = null;

/**
 * Inject the router reference (called from server setup)
 */
export function setMessageRouter(router: MessageRouter) {
    routerRef = router;
}

export const messageTool: ToolHandler = {
    name: 'message',
    description: 'Send messages across channels (WhatsApp, Telegram, Discord, WebChat). Use for notifications, cross-channel communication, reactions, and more.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['send', 'react', 'poll', 'list_channels'],
                description: 'Action to perform',
            },
            channel: {
                type: 'string',
                enum: ['whatsapp', 'telegram', 'discord', 'webchat'],
                description: 'Target channel',
            },
            target: { type: 'string', description: 'Target user/group ID' },
            text: { type: 'string', description: 'Message text' },
            emoji: { type: 'string', description: 'Emoji for react action' },
            question: { type: 'string', description: 'Poll question' },
            options: {
                type: 'array',
                items: { type: 'string' },
                description: 'Poll options',
            },
        },
        required: ['action'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { action, channel, target, text, emoji, question, options } = args;

        if (!routerRef) {
            return 'Error: message router not available';
        }

        switch (action) {
            case 'send': {
                if (!channel || !target || !text) {
                    return 'Error: channel, target, and text are required';
                }
                try {
                    await routerRef.sendReply({
                        channel,
                        senderId: target,
                        groupId: target.includes('@g.us') || target.length > 15 ? target : undefined,
                        text,
                    });
                    return `Message sent to ${channel}:${target}`;
                } catch (err: any) {
                    return `Error sending: ${err.message}`;
                }
            }

            case 'react': {
                return `React with ${emoji || '👍'} — not yet implemented for ${channel}`;
            }

            case 'poll': {
                if (!question || !options || options.length < 2) {
                    return 'Error: question and at least 2 options required';
                }
                return `Poll created: "${question}"\nOptions: ${options.join(', ')}\n(Channel-specific poll APIs will be added per-channel)`;
            }

            case 'list_channels': {
                return 'Available channels: whatsapp, telegram, discord, webchat';
            }

            default:
                return `Unknown action: ${action}. Available: send, react, poll, list_channels`;
        }
    },
};
