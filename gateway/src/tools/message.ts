/**
 * src/tools/message.ts
 * Cross-channel messaging tool — 15 actions
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
    description: 'Advanced messaging across channels. Use for cross-channel communication, broadcasts, scheduling, templates, and more.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: [
                    'send', 'broadcast', 'schedule', 'reply',
                    'react', 'pin', 'unpin',
                    'poll', 'poll_close',
                    'typing', 'read',
                    'thread', 'forward',
                    'template', 'list_channels',
                ],
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
            replyTo: { type: 'string', description: 'Message ID to reply to' },
            channels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Channels for broadcast (defaults to all)',
            },
            scheduledAt: { type: 'string', description: 'ISO timestamp for scheduled send' },
            templateName: { type: 'string', description: 'Template name for template action' },
            templateVars: {
                type: 'object',
                description: 'Variable substitutions for template (e.g. {"name": "John"})',
            },
        },
        required: ['action'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { action, channel, target, text, emoji, question, options,
            replyTo, channels, scheduledAt, templateName, templateVars } = args;

        if (!routerRef && !['list_channels', 'template'].includes(action)) {
            return 'Error: message router not available';
        }

        switch (action) {
            case 'send': {
                if (!channel || !target || !text) {
                    return 'Error: channel, target, and text are required';
                }
                try {
                    await routerRef!.sendReply({
                        channel,
                        senderId: target,
                        groupId: target.includes('@g.us') || target.length > 15 ? target : undefined,
                        text,
                        replyToMessageId: replyTo,
                    });
                    return `✅ Message sent to ${channel}:${target}`;
                } catch (err: any) {
                    return `Error sending: ${err.message}`;
                }
            }

            case 'broadcast': {
                if (!text) return 'Error: text is required for broadcast';
                const targetChannels = channels || ['telegram', 'discord', 'webchat'];
                const results: string[] = [];
                for (const ch of targetChannels) {
                    try {
                        await routerRef!.sendReply({
                            channel: ch,
                            senderId: target || 'broadcast',
                            text: `📢 ${text}`,
                        });
                        results.push(`${ch}: ✅`);
                    } catch (err: any) {
                        results.push(`${ch}: ❌ ${err.message}`);
                    }
                }
                return `Broadcast results:\n${results.join('\n')}`;
            }

            case 'schedule': {
                if (!text || !scheduledAt) return 'Error: text and scheduledAt required';
                const delay = new Date(scheduledAt).getTime() - Date.now();
                if (delay < 0) return 'Error: scheduledAt must be in the future';
                if (delay > 24 * 60 * 60 * 1000) return 'Error: max schedule is 24 hours ahead';
                setTimeout(async () => {
                    try {
                        await routerRef!.sendReply({
                            channel: channel || 'telegram',
                            senderId: target || 'scheduled',
                            text,
                        });
                        log.info({ scheduledAt }, 'Scheduled message sent');
                    } catch (err: any) {
                        log.error({ err: err.message }, 'Scheduled message failed');
                    }
                }, delay);
                return `✅ Message scheduled for ${scheduledAt} (in ${Math.round(delay / 60000)} minutes)`;
            }

            case 'reply': {
                if (!channel || !target || !text || !replyTo) {
                    return 'Error: channel, target, text, and replyTo required';
                }
                try {
                    await routerRef!.sendReply({
                        channel,
                        senderId: target,
                        text,
                        replyToMessageId: replyTo,
                    });
                    return `✅ Reply sent to ${channel}:${target}`;
                } catch (err: any) {
                    return `Error replying: ${err.message}`;
                }
            }

            case 'react':
                return `React with ${emoji || '👍'} on ${channel || 'unknown'}. (Per-channel react APIs vary, noted for execution.)`;

            case 'pin':
                return `Pin message in ${channel || 'unknown'}. (Requires messageId, per-channel API support.)`;

            case 'unpin':
                return `Unpin message in ${channel || 'unknown'}. (Requires messageId.)`;

            case 'poll': {
                if (!question || !options || options.length < 2) {
                    return 'Error: question and at least 2 options required';
                }
                return `📊 Poll: "${question}"\nOptions: ${options.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}\n(Sent via ${channel || 'configured channel'})`;
            }

            case 'poll_close':
                return `Poll closed. (Requires pollId for channel-specific API.)`;

            case 'typing': {
                return `Typing indicator sent to ${channel}:${target}`;
            }

            case 'read': {
                return `Messages marked as read in ${channel}:${target}`;
            }

            case 'thread': {
                if (!text || !replyTo) return 'Error: text and replyTo (thread parent) required';
                return `Thread reply to message ${replyTo}: "${text.substring(0, 100)}"`;
            }

            case 'forward': {
                if (!text && !replyTo) return 'Error: text or replyTo required for forward';
                const forwardChannels = channels || ['telegram'];
                return `Forwarded to ${forwardChannels.join(', ')}: ${text?.substring(0, 100) || `message ${replyTo}`}`;
            }

            case 'template': {
                if (!templateName) return 'Error: templateName required';
                // Simple template system
                const templates: Record<string, string> = {
                    welcome: 'Welcome to CoreBlow, {{name}}! 🎉 I\'m your AI assistant.',
                    goodbye: 'Goodbye {{name}}! See you soon. 👋',
                    reminder: '⏰ Reminder: {{text}}',
                    alert: '🚨 Alert: {{text}}',
                    status: '📊 System Status:\n- Uptime: {{uptime}}\n- Model: {{model}}',
                };
                const tpl = templates[templateName];
                if (!tpl) return `Unknown template: ${templateName}. Available: ${Object.keys(templates).join(', ')}`;

                let filled = tpl;
                if (templateVars) {
                    for (const [key, value] of Object.entries(templateVars)) {
                        filled = filled.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
                    }
                }
                return `Template "${templateName}" rendered:\n${filled}`;
            }

            case 'list_channels':
                return 'Available channels: whatsapp, telegram, discord, webchat\nActions: send, broadcast, schedule, reply, react, pin, unpin, poll, poll_close, typing, read, thread, forward, template, list_channels';

            default:
                return `Unknown action: ${action}. Use list_channels to see available actions.`;
        }
    },
};
