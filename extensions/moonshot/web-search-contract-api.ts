import {
  getScopedCredentialValue,
  resolveProviderWebSearchPluginConfig,
  setProviderWebSearchPluginConfigValue,
  setScopedCredentialValue,
  type WebSearchProviderPlugin,
} from "coreblow/plugin-sdk/provider-web-search";

const KIMI_WEB_SEARCH_CREDENTIAL_PATH = "plugins.entries.moonshot.config.webSearch.apiKey";

export function createKimiWebSearchProvider(): WebSearchProviderPlugin {
  return {
    id: "kimi",
    label: "Kimi (Moonshot)",
    hint: "Requires Moonshot / Kimi API key · Moonshot web search",
    onboardingScopes: ["text-inference"],
    credentialLabel: "Moonshot / Kimi API key",
    envVars: ["KIMI_API_KEY", "MOONSHOT_API_KEY"],
    placeholder: "sk-...",
    signupUrl: "https://platform.moonshot.cn/",
    docsUrl: "https://docs.coreblow.ai/tools/web",
    autoDetectOrder: 40,
    credentialPath: KIMI_WEB_SEARCH_CREDENTIAL_PATH,
    inactiveSecretPaths: [KIMI_WEB_SEARCH_CREDENTIAL_PATH],
    getCredentialValue: (searchConfig) => getScopedCredentialValue(searchConfig, "kimi"),
    setCredentialValue: (searchConfigTarget, value) =>
      setScopedCredentialValue(searchConfigTarget, "kimi", value),
    getConfiguredCredentialValue: (config) =>
      resolveProviderWebSearchPluginConfig(config, "moonshot")?.apiKey,
    setConfiguredCredentialValue: (configTarget, value) => {
      setProviderWebSearchPluginConfigValue(configTarget, "moonshot", "apiKey", value);
    },
    createTool: () => null,
  };
}
