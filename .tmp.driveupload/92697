/**
 * auto-reply/reply/typing.ts
 * Typing indicator management per channel.
 */

export type TypingSender = (channel: string, platform: string) => Promise<void>;

const activeTyping = new Map<string, NodeJS.Timeout>();

/** Start showing typing indicator. Refreshes every intervalMs. */
export function startTyping(
    channel: string,
    platform: string,
    sender: TypingSender,
    intervalMs = 5000,
): void {
    const key = `${platform}:${channel}`;
    stopTyping(channel, platform);

    // Send immediately
    sender(channel, platform).catch(() => {});

    // Refresh at interval
    const timer = setInterval(() => {
        sender(channel, platform).catch(() => {});
    }, intervalMs);

    activeTyping.set(key, timer);
}

/** Stop typing indicator. */
export function stopTyping(channel: string, platform: string): void {
    const key = `${platform}:${channel}`;
    const timer = activeTyping.get(key);
    if (timer) {
        clearInterval(timer);
        activeTyping.delete(key);
    }
}

/** Stop all typing indicators. */
export function stopAllTyping(): void {
    for (const [key, timer] of activeTyping) {
        clearInterval(timer);
    }
    activeTyping.clear();
}

/** Check if typing is active for a channel. */
export function isTyping(channel: string, platform: string): boolean {
    return activeTyping.has(`${platform}:${channel}`);
}
