/**
 * config/legacy.shared.ts
 * Legacy config detection shared between migration & validation.
 */

/** Legacy keys that indicate an old config format. */
export const LEGACY_KEYS = ['model', 'apiKey', 'prompt', 'maxTokens'] as const;

/** Check if config uses legacy format. */
export function isLegacyConfig(config: Record<string, unknown>): boolean {
    return LEGACY_KEYS.some(k => k in config && !('models' in config));
}

/** List which legacy keys are present. */
export function detectLegacyKeys(config: Record<string, unknown>): string[] {
    return LEGACY_KEYS.filter(k => k in config);
}
