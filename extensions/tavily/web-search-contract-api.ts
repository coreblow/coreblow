import {
  enablePluginInConfig,
  getScopedCredentialValue,
  resolveProviderWebSearchPluginConfig,
  setProviderWebSearchPluginConfigValue,
  setScopedCredentialValue,
  type WebSearchProviderPlugin,
} from "coreblow/plugin-sdk/provider-web-search";

export function createTavilyWebSearchProvider(): WebSearchProviderPlugin {
  const credentialPath = "plugins.entries.tavily.config.webSearch.apiKey";

  return {
    id: "tavily",
    label: "Tavily Search",
    hint: "Structured results with domain filters and AI answer summaries",
    onboardingScopes: ["text-inference"],
    credentialLabel: "Tavily API key",
    envVars: ["TAVILY_API_KEY"],
    placeholder: "tvly-...",
    signupUrl: "https://tavily.com/",
    docsUrl: "https://docs.coreblow.ai/tools/tavily",
    autoDetectOrder: 70,
    credentialPath,
    inactiveSecretPaths: [credentialPath],
    getCredentialValue: (searchConfig) => getScopedCredentialValue(searchConfig, "tavily"),
    setCredentialValue: (searchConfigTarget, value) =>
      setScopedCredentialValue(searchConfigTarget, "tavily", value),
    getConfiguredCredentialValue: (config) =>
      resolveProviderWebSearchPluginConfig(config, "tavily")?.apiKey,
    setConfiguredCredentialValue: (configTarget, value) => {
      setProviderWebSearchPluginConfigValue(configTarget, "tavily", "apiKey", value);
    },
    applySelectionConfig: (config) => enablePluginInConfig(config, "tavily").config,
    createTool: () => null,
  };
}
