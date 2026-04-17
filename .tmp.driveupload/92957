/**
 * sessions/send-policy.ts — Message send policy.
 */

export interface SendPolicy { maxMessagesPerMinute: number; cooldownMs: number; blocklist: string[] }

const sessionCounters = new Map<string, { count: number; windowStart: number; lastSent: number }>();

export function checkSendPolicy(sessionId: string, userId: string, policy: SendPolicy): { allowed: boolean; reason?: string; retryAfterMs?: number } {
    if (policy.blocklist.includes(userId)) return { allowed: false, reason: 'User is blocked' };
    const now = Date.now();
    const counter = sessionCounters.get(sessionId) ?? { count: 0, windowStart: now, lastSent: 0 };
    if (now - counter.windowStart > 60_000) { counter.count = 0; counter.windowStart = now; }
    if (counter.count >= policy.maxMessagesPerMinute) return { allowed: false, reason: 'Rate limit exceeded', retryAfterMs: 60_000 - (now - counter.windowStart) };
    if (now - counter.lastSent < policy.cooldownMs) return { allowed: false, reason: 'Cooldown active', retryAfterMs: policy.cooldownMs - (now - counter.lastSent) };
    return { allowed: true };
}

export function recordSend(sessionId: string): void {
    const counter = sessionCounters.get(sessionId) ?? { count: 0, windowStart: Date.now(), lastSent: 0 };
    counter.count++;
    counter.lastSent = Date.now();
    sessionCounters.set(sessionId, counter);
}

export function getDefaultPolicy(): SendPolicy { return { maxMessagesPerMinute: 30, cooldownMs: 500, blocklist: [] }; }
