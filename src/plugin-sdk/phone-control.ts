/** @internal — Zero consumers. SDK pruning audit 2026-04-24 */
// Narrow plugin-sdk surface for the bundled phone-control plugin.
// Keep this list additive and scoped to symbols used under extensions/phone-control.

export { definePluginEntry } from "./plugin-entry.js";
export type {
  CoreBlowPluginApi,
  CoreBlowPluginCommandDefinition,
  CoreBlowPluginService,
  PluginCommandContext,
} from "../plugins/types.js";
