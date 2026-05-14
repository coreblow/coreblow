/**
 * _core-imports.ts — Boundary barrel for core dependencies
 *
 * This module centralizes ALL imports from `../../../../src/` (the core
 * CoreBlow runtime) that memory-host-sdk uses. Instead of 21 files each
 * reaching into core internals, they import from this single barrel.
 *
 * This makes the coupling:
 *   - Explicit: every dependency is visible in one file
 *   - Trackable: boundary lint scripts can flag this file specifically
 *   - Replaceable: when memory-host-sdk becomes a standalone package,
 *     only this file needs to change (swap for package imports)
 *
 * NOTE: This is a transitional pattern. The long-term fix is to publish
 * these as proper package dependencies or define a shared types package.
 */

// ─── Agents ──────────────────────────────────────────────────────
export { resolveAgentWorkspaceDir } from "../../../../src/agents/agent-scope.js";
export {
  collectProviderApiKeysForExecution,
  executeWithApiKeyRotation,
} from "../../../../src/agents/api-key-rotation.js";
export { resolveMemorySearchConfig } from "../../../../src/agents/memory-search.js";
export { requireApiKey, resolveApiKeyForProvider } from "../../../../src/agents/model-auth.js";
// Star re-export for test mocking (embeddings-gemini.test.ts uses `import * as authModule`)
export * as authModule from "../../../../src/agents/model-auth.js";

// ─── CLI ─────────────────────────────────────────────────────────
export { parseDurationMs } from "../../../../src/cli/parse-duration.js";

// ─── Config ──────────────────────────────────────────────────────
export type { CoreBlowConfig } from "../../../../src/config/config.js";
export { resolveSessionTranscriptsDirForAgent } from "../../../../src/config/sessions/paths.js";
export type { SessionSendPolicyConfig } from "../../../../src/config/types.base.js";
export type {
  MemoryBackend,
  MemoryCitationsMode,
  MemoryQmdConfig,
  MemoryQmdIndexPath,
  MemoryQmdMcporterConfig,
  MemoryQmdSearchMode,
} from "../../../../src/config/types.memory.js";
export type { SecretInput } from "../../../../src/config/types.secrets.js";
export {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "../../../../src/config/types.secrets.js";

// ─── Infra ───────────────────────────────────────────────────────
export { isTruthyEnvValue } from "../../../../src/infra/env.js";
export { formatErrorMessage } from "../../../../src/infra/errors.js";
export { parseGeminiAuth } from "../../../../src/infra/gemini-auth.js";
export {
  DEFAULT_GOOGLE_API_BASE_URL,
  normalizeGoogleApiBaseUrl,
} from "../../../../src/infra/google-api-base-url.js";
export { fetchWithSsrFGuard } from "../../../../src/infra/net/fetch-guard.js";
export type { SsrFPolicy } from "../../../../src/infra/net/ssrf.js";
export { retryAsync } from "../../../../src/infra/retry.js";
export { installProcessWarningFilter } from "../../../../src/infra/warning-filter.js";

// ─── Logging ─────────────────────────────────────────────────────
export { redactSensitiveText } from "../../../../src/logging/redact.js";
export { createSubsystemLogger } from "../../../../src/logging/subsystem.js";

// ─── Media ───────────────────────────────────────────────────────
export { detectMime } from "../../../../src/media/mime.js";

// ─── Plugin SDK ──────────────────────────────────────────────────
export {
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgram,
} from "../../../../src/plugin-sdk/windows-spawn.js";

// ─── Plugins ─────────────────────────────────────────────────────
export { OPENAI_DEFAULT_EMBEDDING_MODEL } from "../../../../src/plugins/provider-model-defaults.js";

// ─── Sessions ────────────────────────────────────────────────────
export { parseAgentSessionKey } from "../../../../src/sessions/session-key-utils.js";

// ─── Utils ───────────────────────────────────────────────────────
export { resolveUserPath } from "../../../../src/utils.js";
export { runTasksWithConcurrency } from "../../../../src/utils/run-with-concurrency.js";
export { splitShellArgs } from "../../../../src/utils/shell-argv.js";
