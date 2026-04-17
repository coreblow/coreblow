/**
 * agents/turn-engine/config/sessions.ts
 * Session configuration types for the turn engine.
 */

export interface SessionConfig {
    maxIdleMs?: number;
    maxDurationMs?: number;
    maxTurns?: number;
    persistHistory?: boolean;
    historyLimit?: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
    maxIdleMs: 30 * 60 * 1000,
    maxDurationMs: 24 * 60 * 60 * 1000,
    maxTurns: 200,
    persistHistory: true,
    historyLimit: 100,
};

export function mergeSessionConfig(
    base: SessionConfig,
    overrides?: Partial<SessionConfig>,
): SessionConfig {
    if (!overrides) return { ...base };
    return { ...base, ...overrides };
}
