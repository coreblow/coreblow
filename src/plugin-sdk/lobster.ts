/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
// Private Lobster plugin helpers for bundled extensions.
// Keep this surface narrow and limited to the Lobster workflow/tool contract.

export { definePluginEntry } from "./plugin-entry.js";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "./windows-spawn.js";
export type {
  AnyAgentTool,
  CoreBlowPluginApi,
  CoreBlowPluginToolContext,
  CoreBlowPluginToolFactory,
} from "../plugins/types.js";
