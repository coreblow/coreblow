/**
 * channels/typing-policy.ts
 * Typing policy resolution per context.
 * Ported from CoreBlow reference src/auto-reply/reply/typing-policy.ts.
 */

export type TypingPolicy = 'auto' | 'always' | 'never' | 'heartbeat' | 'internal_webchat' | 'system_event';

export type ResolveRunTypingPolicyParams = {
    requestedPolicy?: TypingPolicy;
    suppressTyping?: boolean;
    isHeartbeat?: boolean;
    originatingChannel?: string;
    systemEvent?: boolean;
};

export type ResolvedRunTypingPolicy = {
    typingPolicy: TypingPolicy;
    suppressTyping: boolean;
};

const INTERNAL_CHANNEL = '__internal_webchat__';

/**
 * Resolve the effective typing policy for a reply run.
 */
export function resolveRunTypingPolicy(params: ResolveRunTypingPolicyParams): ResolvedRunTypingPolicy {
    const typingPolicy: TypingPolicy = params.isHeartbeat
        ? 'heartbeat'
        : params.originatingChannel === INTERNAL_CHANNEL
            ? 'internal_webchat'
            : params.systemEvent
                ? 'system_event'
                : (params.requestedPolicy ?? 'auto');

    const suppressTyping =
        params.suppressTyping === true ||
        typingPolicy === 'heartbeat' ||
        typingPolicy === 'system_event' ||
        typingPolicy === 'internal_webchat';

    return { typingPolicy, suppressTyping };
}

/**
 * Should typing be shown for this policy?
 */
export function shouldShowTyping(policy: TypingPolicy): boolean {
    return policy === 'auto' || policy === 'always';
}

/**
 * Resolve typing keepalive interval for a channel.
 */
export function resolveTypingIntervalMs(channel: string): number {
    // Discord: 5s keepalive (typing indicator lasts ~10s)
    // Telegram: 5s keepalive
    // Slack: no keepalive needed (typing persists until message sent)
    switch (channel) {
        case 'discord': return 5000;
        case 'telegram': return 5000;
        case 'slack': return 0;
        case 'signal': return 3000;
        default: return 5000;
    }
}
