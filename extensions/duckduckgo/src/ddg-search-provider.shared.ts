import {
  enablePluginInConfig,
  getScopedCredentialValue,
  setScopedCredentialValue,
  type WebSearchProviderPlugin,
} from "coreblow/plugin-sdk/provider-web-search";

const DUCKDUCKGO_ONBOARDING_SCOPES: Array<"text-inference"> = ["text-inference"];

export function createDuckDuckGoWebSearchProviderBase(): Omit<
  WebSearchProviderPlugin,
  "createTool"
> {
  return {
    id: "duckduckgo",
    label: "DuckDuckGo Search (experimental)",
    hint: "Free web search fallback with no API key required",
    onboardingScopes: [...DUCKDUCKGO_ONBOARDING_SCOPES],
    requiresCredential: false,
    envVars: [],
    placeholder: "(no key needed)",
    signupUrl: "https://duckduckgo.com/",
    docsUrl: "https://docs.coreblow.ai/tools/web",
    autoDetectOrder: 100,
    credentialPath: "",
    inactiveSecretPaths: [],
    getCredentialValue: (searchConfig) => getScopedCredentialValue(searchConfig, "duckduckgo"),
    setCredentialValue: (searchConfigTarget, value) =>
      setScopedCredentialValue(searchConfigTarget, "duckduckgo", value),
    applySelectionConfig: (config) => enablePluginInConfig(config, "duckduckgo").config,
  };
}
