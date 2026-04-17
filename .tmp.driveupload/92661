/**
 * auto-reply/send-policy.ts
 * Reply delivery policy engine.
 * Ported from OpenClaw src/auto-reply/send-policy.ts.
 */

export type SendPolicyOverride = 'allow' | 'deny';

export function normalizeSendPolicyOverride(raw?: string | null): SendPolicyOverride | undefined {
    const value = raw?.trim().toLowerCase();
    if (!value) return undefined;
    if (value === 'allow' || value === 'on') return 'allow';
    if (value === 'deny' || value === 'off') return 'deny';
    return undefined;
}

export function parseSendPolicyCommand(raw?: string): {
    hasCommand: boolean;
    mode?: SendPolicyOverride | 'inherit';
} {
    if (!raw) return { hasCommand: false };
    const trimmed = raw.trim();
    if (!trimmed) return { hasCommand: false };

    const match = trimmed.match(/^\/send(?:\s+([a-zA-Z]+))?\s*$/i);
    if (!match) return { hasCommand: false };
    const token = match[1]?.trim().toLowerCase();
    if (!token) return { hasCommand: true };
    if (token === 'inherit' || token === 'default' || token === 'reset') return { hasCommand: true, mode: 'inherit' };
    const mode = normalizeSendPolicyOverride(token);
    return { hasCommand: true, mode };
}

export interface CooldownState {
    lastReplyAt: number;
    cooldownMs: number;
}

/**
 * Check if a reply should be sent based on cooldown and rate limiting.
 */
export function shouldSendReply(params: {
    sendPolicy?: SendPolicyOverride;
    cooldown?: CooldownState;
    rateLimitPerMinute?: number;
    recentReplyCount?: number;
}): { allowed: boolean; reason?: string } {
    // Explicit deny
    if (params.sendPolicy === 'deny') {
        return { allowed: false, reason: 'Send policy is set to deny.' };
    }

    // Cooldown check
    if (params.cooldown) {
        const elapsed = Date.now() - params.cooldown.lastReplyAt;
        if (elapsed < params.cooldown.cooldownMs) {
            const remaining = params.cooldown.cooldownMs - elapsed;
            return { allowed: false, reason: `Cooldown active: ${Math.ceil(remaining / 1000)}s remaining.` };
        }
    }

    // Rate limit check
    if (params.rateLimitPerMinute && params.recentReplyCount !== undefined) {
        if (params.recentReplyCount >= params.rateLimitPerMinute) {
            return { allowed: false, reason: `Rate limit reached: ${params.rateLimitPerMinute}/min.` };
        }
    }

    return { allowed: true };
}

/**
 * Resolve send policy from config.
 */
export function resolveSendPolicy(cfg: Record<string, unknown>, channel?: string): {
    cooldownMs: number;
    rateLimitPerMinute: number;
} {
    const messages = cfg.messages as Record<string, unknown> | undefined;
    const outbound = messages?.outbound as Record<string, unknown> | undefined;

    let cooldownMs = 0;
    let rateLimitPerMinute = 60;

    if (typeof outbound?.cooldownMs === 'number') cooldownMs = Math.max(0, outbound.cooldownMs);
    if (typeof outbound?.rateLimitPerMinute === 'number') rateLimitPerMinute = Math.max(1, outbound.rateLimitPerMinute);

    // Channel-specific override
    if (channel) {
        const channels = cfg.channels as Record<string, unknown> | undefined;
        const channelCfg = channels?.[channel] as Record<string, unknown> | undefined;
        if (typeof channelCfg?.cooldownMs === 'number') cooldownMs = Math.max(0, channelCfg.cooldownMs);
        if (typeof channelCfg?.rateLimitPerMinute === 'number') rateLimitPerMinute = Math.max(1, channelCfg.rateLimitPerMinute);
    }

    return { cooldownMs, rateLimitPerMinute };
}
