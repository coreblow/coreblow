import {
  enablePluginInConfig,
  getScopedCredentialValue,
  resolveProviderWebSearchPluginConfig,
  setProviderWebSearchPluginConfigValue,
  setScopedCredentialValue,
  type WebSearchProviderPlugin,
} from "coreblow/plugin-sdk/provider-web-search";

export const EXA_CREDENTIAL_PATH = "plugins.entries.exa.config.webSearch.apiKey";

const EXA_ONBOARDING_SCOPES: Array<"text-inference"> = ["text-inference"];

export function createExaWebSearchProviderBase(): Omit<WebSearchProviderPlugin, "createTool"> {
  return {
    id: "exa",
    label: "Exa Search",
    hint: "Neural + keyword search with date filters and content extraction",
    onboardingScopes: [...EXA_ONBOARDING_SCOPES],
    credentialLabel: "Exa API key",
    envVars: ["EXA_API_KEY"],
    placeholder: "exa-...",
    signupUrl: "https://exa.ai/",
    docsUrl: "https://docs.coreblow.ai/tools/web",
    autoDetectOrder: 65,
    credentialPath: EXA_CREDENTIAL_PATH,
    inactiveSecretPaths: [EXA_CREDENTIAL_PATH],
    getCredentialValue: (searchConfig) => getScopedCredentialValue(searchConfig, "exa"),
    setCredentialValue: (searchConfigTarget, value) =>
      setScopedCredentialValue(searchConfigTarget, "exa", value),
    getConfiguredCredentialValue: (config) =>
      resolveProviderWebSearchPluginConfig(config, "exa")?.apiKey,
    setConfiguredCredentialValue: (configTarget, value) => {
      setProviderWebSearchPluginConfigValue(configTarget, "exa", "apiKey", value);
    },
    applySelectionConfig: (config) => enablePluginInConfig(config, "exa").config,
  };
}
