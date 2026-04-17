/**
 * auto-reply/group-activation.ts
 * Group chat mention gating and activation modes.
 * Ported from OpenClaw src/auto-reply/group-activation.ts.
 */

export type GroupActivationMode = 'mention' | 'always';

export function normalizeGroupActivation(raw?: string | null): GroupActivationMode | undefined {
    const value = raw?.trim().toLowerCase();
    if (value === 'mention') return 'mention';
    if (value === 'always') return 'always';
    return undefined;
}

export function parseActivationCommand(raw?: string): {
    hasCommand: boolean;
    mode?: GroupActivationMode;
} {
    if (!raw) return { hasCommand: false };
    const trimmed = raw.trim();
    if (!trimmed) return { hasCommand: false };

    const normalized = trimmed.replace(/^\/([^\s:]+)\s*:(.*)$/, (_, cmd: string, rest: string) => {
        const r = rest.trimStart();
        return r ? `/${cmd} ${r}` : `/${cmd}`;
    });

    const match = normalized.match(/^\/activation(?:\s+([a-zA-Z]+))?\s*$/i);
    if (!match) return { hasCommand: false };
    const mode = normalizeGroupActivation(match[1]);
    return { hasCommand: true, mode };
}

/**
 * Determine if a message should activate a reply in a group context.
 */
export function shouldActivateInGroup(params: {
    mode: GroupActivationMode;
    isMentioned: boolean;
    isReplyToBot: boolean;
    isDirectMessage: boolean;
    isDM?: boolean;
}): boolean {
    // DMs always activate
    if (params.isDirectMessage || params.isDM) return true;
    // Always mode: reply to everything
    if (params.mode === 'always') return true;
    // Mention mode: only when mentioned or replying to bot
    return params.isMentioned || params.isReplyToBot;
}

/**
 * Resolve group activation mode from config.
 */
export function resolveGroupActivationMode(cfg: Record<string, unknown>, channel?: string): GroupActivationMode {
    const agents = cfg.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;

    // Check channel-specific override
    if (channel) {
        const channels = cfg.channels as Record<string, unknown> | undefined;
        const channelCfg = channels?.[channel] as Record<string, unknown> | undefined;
        const channelMode = normalizeGroupActivation(channelCfg?.groupActivation as string);
        if (channelMode) return channelMode;
    }

    // Check global default
    const globalMode = normalizeGroupActivation(defaults?.groupActivation as string);
    return globalMode ?? 'mention';
}
