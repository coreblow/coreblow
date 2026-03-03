/**
 * types/agent-defaults.ts
 *
 * Shared agent default constants extracted from agents/defaults.ts
 * to break circular dependencies between config/ and agents/.
 *
 * These are pure constant values with zero imports — safe for any module.
 */

// Defaults for agent metadata when upstream does not supply them.
// Model id uses pi-ai's built-in Anthropic catalog.
export const DEFAULT_PROVIDER = "anthropic";
export const DEFAULT_MODEL = "claude-opus-4-6";
// Conservative fallback used when model metadata is unavailable.
export const DEFAULT_CONTEXT_TOKENS = 200_000;
