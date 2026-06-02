import {
  enablePluginInConfig,
  getScopedCredentialValue,
  resolveProviderWebSearchPluginConfig,
  setProviderWebSearchPluginConfigValue,
  setScopedCredentialValue,
  type WebSearchProviderPlugin,
} from "coreblow/plugin-sdk/provider-web-search";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";

const FIRECRAWL_WEB_SEARCH_CREDENTIAL_PATH =
  "plugins.entries.firecrawl.config.webSearch.apiKey";
const FIRECRAWL_WEB_FETCH_CREDENTIAL_PATH =
  "plugins.entries.firecrawl.config.webFetch.apiKey";

export type FirecrawlWebSearchContractProvider = WebSearchProviderPlugin & {
  getConfiguredCredentialFallback?: (
    config?: CoreBlowConfig,
  ) => { path: string; value: unknown } | undefined;
};

export function createFirecrawlWebSearchProvider(): FirecrawlWebSearchContractProvider {
  return {
    id: "firecrawl",
    label: "Firecrawl Search",
    hint: "Structured results with optional result scraping",
    onboardingScopes: ["text-inference"],
    credentialLabel: "Firecrawl API key",
    envVars: ["FIRECRAWL_API_KEY"],
    placeholder: "fc-...",
    signupUrl: "https://www.firecrawl.dev/",
    docsUrl: "https://docs.coreblow.ai/tools/firecrawl",
    autoDetectOrder: 60,
    credentialPath: FIRECRAWL_WEB_SEARCH_CREDENTIAL_PATH,
    inactiveSecretPaths: [FIRECRAWL_WEB_SEARCH_CREDENTIAL_PATH],
    getCredentialValue: (searchConfig) => getScopedCredentialValue(searchConfig, "firecrawl"),
    setCredentialValue: (searchConfigTarget, value) =>
      setScopedCredentialValue(searchConfigTarget, "firecrawl", value),
    getConfiguredCredentialValue: (config) =>
      resolveProviderWebSearchPluginConfig(config, "firecrawl")?.apiKey,
    getConfiguredCredentialFallback: (config) => {
      const apiKey = (
        config?.plugins?.entries?.firecrawl?.config as
          | { webFetch?: { apiKey?: unknown } }
          | undefined
      )?.webFetch?.apiKey;
      return apiKey === undefined
        ? undefined
        : {
            path: FIRECRAWL_WEB_FETCH_CREDENTIAL_PATH,
            value: apiKey,
          };
    },
    setConfiguredCredentialValue: (configTarget, value) => {
      setProviderWebSearchPluginConfigValue(configTarget, "firecrawl", "apiKey", value);
    },
    applySelectionConfig: (config) => enablePluginInConfig(config, "firecrawl").config,
    createTool: () => null,
  };
}
