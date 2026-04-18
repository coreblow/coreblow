/** CoreBlow — Discord Preview Streaming Config */
export interface DiscordStreamingConfig { enabled: boolean; chunkSize: number; chunkDelayMs: number; maxChunks: number; }
export const DEFAULT_DISCORD_STREAMING: DiscordStreamingConfig = { enabled: true, chunkSize: 1500, chunkDelayMs: 500, maxChunks: 10 };
