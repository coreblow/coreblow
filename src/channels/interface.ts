/**
 * src/channels/interface.ts
 * Core interfaces for Channel adapters.
 * Re-exports from adapter.ts + legacy compatibility types.
 */

import type { MessageRouter } from '../gateway/router.js';

// Re-export the canonical ChannelAdapter from adapter.ts
export type {
    ChannelAdapter as ChannelAdapterRuntime,
    ChannelId,
    ChannelMessage as ChannelMessageRuntime,
} from './adapter.js';

export interface ChannelStatus {
    name: string;
    connected: boolean;
    uptime: number;
    details?: Record<string, unknown>;
    error?: string;
}

export interface ChannelMessage {
    id: string;
    content: string;
    author: string;
    channelId: string;
    timestamp: number;
}

/**
 * Legacy ChannelAdapter interface for start/stop/getStatus pattern.
 * New code should use ChannelPlugin from plugins/types.plugin.ts instead.
 * @deprecated Use ChannelPlugin for new channel implementations.
 */
export interface ChannelAdapter {
    name: string;
    start(router: MessageRouter): Promise<void>;
    stop(): Promise<void>;
    getStatus(): ChannelStatus;
    isConnected?(): boolean;
}

export function chunkMessage(text: string, maxLen = 2000): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxLen) chunks.push(text.slice(i, i + maxLen));
    return chunks;
}
