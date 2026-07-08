// False gap: equivalent types and logic in config-state.ts and config-policy.ts
// NormalizedPluginsConfig in config-state.ts
// normalizePluginsConfig in config-state.ts
// identityNormalizePluginId in config-state.ts
// hasExplicitPluginConfig in config-policy.ts
// isBundledChannelEnabledByChannelConfig in config-policy.ts
export type { NormalizedPluginsConfig } from "./config-state.js";
export { normalizePluginsConfig as normalizePluginsConfigWithResolver } from "./config-state.js";
export { hasExplicitPluginConfig, isBundledChannelEnabledByChannelConfig } from "./config-policy.js";
