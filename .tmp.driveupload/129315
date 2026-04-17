import type { CoreBlowConfig } from "coreblow/plugin-sdk/browser-support";
import {
  normalizePluginsConfig,
  resolveEffectiveEnableState,
} from "coreblow/plugin-sdk/browser-support";

export function isDefaultBrowserPluginEnabled(cfg: CoreBlowConfig): boolean {
  return resolveEffectiveEnableState({
    id: "browser",
    origin: "bundled",
    config: normalizePluginsConfig(cfg.plugins),
    rootConfig: cfg,
    enabledByDefault: true,
  }).enabled;
}
