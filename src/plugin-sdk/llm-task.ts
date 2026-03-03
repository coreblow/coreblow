// Narrow plugin-sdk surface for the bundled llm-task plugin.
// Keep this list additive and scoped to symbols used under extensions/llm-task.

export { definePluginEntry } from "./plugin-entry.js";
export { resolvePreferredCoreBlowTmpDir } from "../infra/tmp-coreblow-dir.js";
export {
  formatThinkingLevels,
  formatXHighModelHint,
  normalizeThinkLevel,
  supportsXHighThinking,
} from "../auto-reply/thinking.js";
export type { AnyAgentTool, CoreBlowPluginApi } from "../plugins/types.js";
