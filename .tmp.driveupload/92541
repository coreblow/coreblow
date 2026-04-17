/**
 * Discord Config Resolution
 */
import type { DiscordConfig } from './types.js';
export interface ResolvedConfig extends DiscordConfig {
    token: string;
    prefix: string;
    allowedChannels: string[];
    richResponses: boolean;
    threadMode: 'off' | 'auto' | 'manual';
}
export function resolveConfig(config: DiscordConfig): ResolvedConfig {
    return {
        ...config,
        prefix: config.prefix ?? '/',
        allowedChannels: config.allowedChannels ?? [],
        richResponses: config.richResponses ?? true,
        threadMode: config.threadMode ?? 'off',
    };
}
export function validateConfig(config: unknown): config is DiscordConfig {
    return typeof config === 'object' && config !== null && 'token' in config;
}
