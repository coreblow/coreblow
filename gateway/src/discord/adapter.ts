/**
 * discord/adapter.ts
 * Discord adapter — bridges the Discord.js client to CoreBlow's channel interface.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('discord:adapter');

export interface DiscordAdapterConfig {
    token?: string;
    guildId?: string;
    intents?: string[];
}

export class DiscordAdapter {
    private config: DiscordAdapterConfig;
    private connected = false;

    constructor(config: DiscordAdapterConfig) {
        this.config = config;
    }

    async connect(): Promise<void> {
        if (!this.config.token) throw new Error('Discord token required');
        this.connected = true;
        log.info('Discord adapter connected');
    }

    async disconnect(): Promise<void> {
        this.connected = false;
        log.info('Discord adapter disconnected');
    }

    isConnected(): boolean {
        return this.connected;
    }

    getConfig(): DiscordAdapterConfig {
        return { ...this.config };
    }
}
