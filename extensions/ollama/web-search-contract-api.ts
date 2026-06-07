import type { WebSearchProviderPlugin } from "coreblow/plugin-sdk/provider-web-search";

export function createOllamaWebSearchProvider(): WebSearchProviderPlugin {
  return {
    id: "ollama",
    label: "Ollama Web Search",
    hint: "Local Ollama host; requires ollama signin",
    onboardingScopes: ["text-inference"],
    requiresCredential: false,
    envVars: [],
    placeholder: "(run ollama signin)",
    signupUrl: "https://ollama.com/",
    docsUrl: "https://docs.coreblow.com/tools/web",
    autoDetectOrder: 110,
    credentialPath: "",
    getCredentialValue: () => undefined,
    setCredentialValue: () => {},
    createTool: () => null,
  };
}
