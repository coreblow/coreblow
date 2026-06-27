// Public contract-safe web-search config helpers for provider plugins that do
// not need plugin enable/selection wiring.
// Note: WebSearchProviderSetupContext is not available in CoreBlow
// (intentionally different: CB uses WebSearchProviderContext instead).

import type {
  WebSearchCredentialResolutionSource,
  WebSearchProviderPlugin,
  WebSearchProviderToolDefinition,
} from "../plugins/types.js";

export {
  getScopedCredentialValue,
  getTopLevelCredentialValue,
  mergeScopedSearchConfig,
  resolveProviderWebSearchPluginConfig,
  setScopedCredentialValue,
  setProviderWebSearchPluginConfigValue,
  setTopLevelCredentialValue,
} from "../agents/tools/web-search-provider-config.js";
export { createBaseWebSearchProviderContractFields as createWebSearchProviderContractFields } from "./provider-web-search-contract-fields.js";
export type {
  WebSearchCredentialResolutionSource,
  WebSearchProviderPlugin,
  WebSearchProviderToolDefinition,
};
