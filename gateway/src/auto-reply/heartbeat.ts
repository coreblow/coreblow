/**
 * auto-reply/heartbeat.ts
 * Typing indicator and heartbeat management.
 * Ported from CoreBlow src/auto-reply/heartbeat.ts.
 */

export const HEARTBEAT_PROMPT =
    'Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.';
export const DEFAULT_HEARTBEAT_EVERY = '30m';
export const DEFAULT_HEARTBEAT_ACK_MAX_CHARS = 300;

/**
 * Check if HEARTBEAT.md content is effectively empty.
 */
export function isHeartbeatContentEffectivelyEmpty(content: string | undefined | null): boolean {
    if (content === undefined || content === null) return false;
    if (typeof content !== 'string') return false;

    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (/^#+(\s|$)/.test(trimmed)) continue;
        if (/^[-*+]\s*(\[[\sXx]?\]\s*)?$/.test(trimmed)) continue;
        return false;
    }
    return true;
}

export function resolveHeartbeatPrompt(raw?: string): string {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    return trimmed || HEARTBEAT_PROMPT;
}

/**
 * Parse heartbeat interval string to milliseconds.
 * Supports: "30m", "1h", "45s", "2h30m"
 */
export function parseHeartbeatInterval(raw: string): number {
    const trimmed = raw.trim().toLowerCase();
    let totalMs = 0;

    const hourMatch = trimmed.match(/(\d+)h/);
    if (hourMatch) totalMs += parseInt(hourMatch[1], 10) * 60 * 60 * 1000;

    const minMatch = trimmed.match(/(\d+)m/);
    if (minMatch) totalMs += parseInt(minMatch[1], 10) * 60 * 1000;

    const secMatch = trimmed.match(/(\d+)s/);
    if (secMatch) totalMs += parseInt(secMatch[1], 10) * 1000;

    if (totalMs === 0) {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num)) totalMs = num * 60 * 1000; // default to minutes
    }

    return Math.max(1000, totalMs);
}

/**
 * Typing indicator controller.
 */
export class TypingIndicator {
    private interval: ReturnType<typeof setInterval> | null = null;
    private sendTyping: () => void;
    private intervalMs: number;

    constructor(sendTyping: () => void, intervalMs = 5000) {
        this.sendTyping = sendTyping;
        this.intervalMs = intervalMs;
    }

    start(): void {
        if (this.interval) return;
        this.sendTyping();
        this.interval = setInterval(() => this.sendTyping(), this.intervalMs);
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
