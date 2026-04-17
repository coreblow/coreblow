/**
 * Discord Auto-Thread — Automatically creates threads for conversations.
 */
export interface AutoThreadConfig { enabled: boolean; namePrefix: string; archiveAfterMs: number; slowMode?: number; }

const DEFAULT_CONFIG: AutoThreadConfig = { enabled: true, namePrefix: '💬', archiveAfterMs: 24 * 60 * 60 * 1000, slowMode: 0 };

export function shouldAutoThread(config: AutoThreadConfig, channelId: string, allowedChannels: string[]): boolean {
    if (!config.enabled) return false;
    return allowedChannels.length === 0 || allowedChannels.includes(channelId);
}

export function generateThreadName(prefix: string, username: string, topic?: string): string {
    const base = topic ? `${prefix} ${topic}` : `${prefix} Chat with ${username}`;
    return base.slice(0, 100); // Discord thread name limit
}

export function getDefaultConfig(): AutoThreadConfig { return { ...DEFAULT_CONFIG }; }
