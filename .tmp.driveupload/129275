import { createConfigIO, getRuntimeConfigSnapshot, type CoreBlowConfig } from "../config/config.js";

export function loadBrowserConfigForRuntimeRefresh(): CoreBlowConfig {
  return getRuntimeConfigSnapshot() ?? createConfigIO().loadConfig();
}
