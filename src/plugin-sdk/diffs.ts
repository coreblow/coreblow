// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to symbols used under extensions/diffs.

export { definePluginEntry } from "./plugin-entry.js";
export type { CoreBlowConfig } from "../config/config.js";
export { resolvePreferredCoreBlowTmpDir } from "../infra/tmp-coreblow-dir.js";
export type {
  AnyAgentTool,
  CoreBlowPluginApi,
  CoreBlowPluginConfigSchema,
  CoreBlowPluginToolContext,
  PluginLogger,
} from "../plugins/types.js";
