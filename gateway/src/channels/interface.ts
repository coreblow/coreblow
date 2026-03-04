/**
 * src/channels/interface.ts
 * Base channel interface — all channel adapters implement this
 */

import type { MessageRouter } from '../gateway/router.js';

export interface ChannelConfig {
    enabled: boolean;
    [key: string]: any;
}

export interface ChannelAdapter {
    name: string;

    /**
     * Start the channel adapter (connect to external service)
     */
    start(router: MessageRouter): Promise<void>;

    /**
     * Stop the channel adapter (disconnect gracefully)
     */
    stop(): Promise<void>;

    /**
     * Check if the channel is connected and healthy
     */
    isConnected(): boolean;

    /**
     * Get status information
     */
    getStatus(): ChannelStatus;
}

export interface ChannelStatus {
    name: string;
    connected: boolean;
    uptime?: number;
    details?: Record<string, any>;
}

/**
 * Chunk long messages into parts that fit channel limits
 */
export function chunkMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }

        // Try to split at a natural break point
        let splitAt = maxLength;
        const lastNewline = remaining.lastIndexOf('\n', maxLength);
        const lastSpace = remaining.lastIndexOf(' ', maxLength);
        const lastPeriod = remaining.lastIndexOf('. ', maxLength);

        if (lastNewline > maxLength * 0.5) {
            splitAt = lastNewline + 1;
        } else if (lastPeriod > maxLength * 0.5) {
            splitAt = lastPeriod + 2;
        } else if (lastSpace > maxLength * 0.5) {
            splitAt = lastSpace + 1;
        }

        chunks.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt);
    }

    return chunks;
}
