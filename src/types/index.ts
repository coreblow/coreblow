/**
 * types/index.ts
 *
 * Shared type barrel — re-exports pure constants, utility functions,
 * and type definitions that are used across module boundaries.
 *
 * RULES:
 *   - Only interface, type, const, and pure functions (no side effects).
 *   - No class, no stateful code, no runtime dependencies on agents/config/plugins.
 */

// Agent defaults (pure constants)
export { DEFAULT_PROVIDER, DEFAULT_MODEL, DEFAULT_CONTEXT_TOKENS } from "./agent-defaults.js";

// Provider ID normalization (pure functions, zero imports)
export {
  normalizeProviderId,
  normalizeProviderIdForAuth,
  findNormalizedProviderValue,
  findNormalizedProviderKey,
  parseModelRef,
  buildModelRef,
} from "./provider-id.js";
