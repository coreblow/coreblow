/**
 * plugin-sdk/channel-helpers.ts
 * Channel-specific utilities for plugins.
 */

import { resolveChannelCapabilities, type ChannelCapabilities } from '../config/channel-capabilities.js';

export function getChannelCapabilities(channel: string, cfg?: Record<string, unknown>): ChannelCapabilities {
    return resolveChannelCapabilities({ cfg, channel });
}

export function formatMessageForChannel(msg: string, channel: string, cfg?: Record<string, unknown>): string {
    const caps = getChannelCapabilities(channel, cfg);
    if (msg.length > caps.maxMessageLength) {
        return msg.slice(0, caps.maxMessageLength - 20) + '\n\n...(truncated)';
    }
    return msg;
}

export function splitMessageForChannel(msg: string, channel: string, cfg?: Record<string, unknown>): string[] {
    const caps = getChannelCapabilities(channel, cfg);
    if (msg.length <= caps.maxMessageLength) return [msg];

    const chunks: string[] = [];
    let remaining = msg;
    while (remaining.length > 0) {
        if (remaining.length <= caps.maxMessageLength) {
            chunks.push(remaining);
            break;
        }
        let splitAt = remaining.lastIndexOf('\n', caps.maxMessageLength);
        if (splitAt < caps.maxMessageLength / 2) splitAt = caps.maxMessageLength;
        chunks.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt).trimStart();
    }
    return chunks;
}
