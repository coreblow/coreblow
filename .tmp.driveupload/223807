import type { CoreBlowConfig } from "./config.js";

export function ensurePluginAllowlisted(cfg: CoreBlowConfig, pluginId: string): CoreBlowConfig {
  const allow = cfg.plugins?.allow;
  if (!Array.isArray(allow) || allow.includes(pluginId)) {
    return cfg;
  }
  return {
    ...cfg,
    plugins: {
      ...cfg.plugins,
      allow: [...allow, pluginId],
    },
  };
}
