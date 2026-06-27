// Public contract-safe web-search registration helpers for provider plugins.
// Note: WebSearchProviderSetupContext and WebSearchProviderToolExecutionContext
// are not available in CoreBlow (intentionally different: CB uses
// WebSearchProviderContext and does not expose execution context separately).

import type { CoreBlowConfig } from "../config/config.js";
import type {
  WebSearchCredentialResolutionSource,
  WebSearchProviderPlugin,
  WebSearchProviderToolDefinition,
} from "../plugins/types.js";
import { enablePluginInConfig } from "./provider-enable-config.js";
import {
  createBaseWebSearchProviderContractFields,
  type CreateWebSearchProviderContractFieldsOptions,
} from "./provider-web-search-contract-fields.js";

export {
  getScopedCredentialValue,
  getTopLevelCredentialValue,
  mergeScopedSearchConfig,
  resolveProviderWebSearchPluginConfig,
  setScopedCredentialValue,
  setProviderWebSearchPluginConfigValue,
  setTopLevelCredentialValue,
} from "../agents/tools/web-search-provider-config.js";
export { enablePluginInConfig } from "./provider-enable-config.js";
export type {
  WebSearchCredentialResolutionSource,
  WebSearchProviderPlugin,
  WebSearchProviderToolDefinition,
};
export type {
  CreateWebSearchProviderContractFieldsOptions,
  WebSearchProviderConfiguredCredential,
  WebSearchProviderContractCredential,
  WebSearchProviderContractFields,
} from "./provider-web-search-contract-fields.js";

type CreateWebSearchProviderSelectionOptions = CreateWebSearchProviderContractFieldsOptions & {
  selectionPluginId?: string;
};

export function createWebSearchProviderContractFields(
  options: CreateWebSearchProviderSelectionOptions,
): Pick<
  WebSearchProviderPlugin,
  "inactiveSecretPaths" | "getCredentialValue" | "setCredentialValue"
> &
  Partial<
    Pick<
      WebSearchProviderPlugin,
      "applySelectionConfig" | "getConfiguredCredentialValue" | "setConfiguredCredentialValue"
    >
  > {
  const selectionPluginId = options.selectionPluginId;

  return {
    ...createBaseWebSearchProviderContractFields(options),
    ...(selectionPluginId
      ? {
          applySelectionConfig: (config: CoreBlowConfig) =>
            enablePluginInConfig(config, selectionPluginId).config,
        }
      : {}),
  };
}
