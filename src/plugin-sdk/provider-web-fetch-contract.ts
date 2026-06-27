// Narrow shared exports for web-fetch contract surfaces.
// Note: WebFetchProviderPlugin does not exist in CoreBlow
// (intentionally different: CB uses WebSearchProviderPlugin for all
// web-tool provider contracts).

export { enablePluginInConfig } from "./provider-enable-config.js";
