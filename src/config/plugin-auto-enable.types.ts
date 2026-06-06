import type { CoreBlowConfig } from "./types.js";
import type { PluginEnableChange } from "./plugin-auto-enable.js";

export type PluginAutoEnableCandidate = PluginEnableChange;

export type PluginAutoEnableResult = {
  config: CoreBlowConfig;
  changes: string[];
  autoEnabledReasons?: Record<string, string[]>;
};
