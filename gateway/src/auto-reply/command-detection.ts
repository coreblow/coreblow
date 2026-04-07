/**
 * auto-reply/command-detection.ts
 * Detect slash commands & keywords in inbound messages.
 */

import type { InboundMessage, ReplyTrigger } from './types.js';

/** Check if a message matches any configured trigger. */
export function matchTrigger(msg: InboundMessage, triggers: ReplyTrigger[]): ReplyTrigger | null {
    for (const trigger of triggers) {
        if (!trigger.enabled) continue;

        // Channel filter
        if (trigger.channels && trigger.channels.length > 0) {
            if (!trigger.channels.includes(msg.channel)) continue;
        }

        switch (trigger.type) {
            case 'always':
                return trigger;

            case 'dm':
                if (isDm(msg)) return trigger;
                break;

            case 'mention':
                if (containsBotMention(msg.content)) return trigger;
                break;

            case 'command':
                if (isSlashCommand(msg.content)) return trigger;
                break;

            case 'keyword':
                if (trigger.pattern && msg.content.toLowerCase().includes(trigger.pattern.toLowerCase())) {
                    return trigger;
                }
                break;

            case 'regex':
                if (trigger.regex && trigger.regex.test(msg.content)) {
                    return trigger;
                }
                if (trigger.pattern) {
                    try {
                        if (new RegExp(trigger.pattern, 'i').test(msg.content)) return trigger;
                    } catch { /* invalid regex, skip */ }
                }
                break;
        }
    }
    return null;
}

/** Check if message is a DM. */
function isDm(msg: InboundMessage): boolean {
    return msg.channel.startsWith('dm_') || msg.metadata?.isDm === true;
}

/** Check if message contains a bot mention. */
function containsBotMention(content: string): boolean {
    // Match @coreblow, @bot, or configurable bot name
    return /(^|\s)@(coreblow|bot)(\s|$)/i.test(content);
}

/** Check if message starts with a slash command. */
export function isSlashCommand(content: string): boolean {
    return content.startsWith('/') && content.length > 1 && !content.startsWith('//');
}

/** Parse slash command from message text. */
export function parseSlashCommand(content: string): { command: string; args: string[]; raw: string } | null {
    if (!isSlashCommand(content)) return null;
    const parts = content.slice(1).split(/\s+/);
    return {
        command: parts[0].toLowerCase(),
        args: parts.slice(1),
        raw: content,
    };
}

/** Strip bot mention from message content. */
export function stripBotMention(content: string): string {
    return content.replace(/(^|\s)@(coreblow|bot)(\s|$)/gi, '$1').trim();
}
