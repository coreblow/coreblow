import type { WebSearchProviderPlugin } from "coreblow/plugin-sdk/provider-web-search";

const MINIMAX_CREDENTIAL_PATH = "plugins.entries.minimax.config.webSearch.apiKey";
const MINIMAX_TOKEN_PLAN_ENV_VARS = [
  "MINIMAX_CODE_PLAN_KEY",
  "MINIMAX_CODING_API_KEY",
  "MINIMAX_OAUTH_TOKEN",
] as const;
const MINIMAX_WEB_SEARCH_ENV_VARS = [...MINIMAX_TOKEN_PLAN_ENV_VARS, "MINIMAX_API_KEY"] as const;

let miniMaxWebSearchRuntimePromise:
  | Promise<typeof import("./minimax-web-search-provider.runtime.js")>
  | undefined;

function loadMiniMaxWebSearchRuntime() {
  miniMaxWebSearchRuntimePromise ??= import("./minimax-web-search-provider.runtime.js");
  return miniMaxWebSearchRuntimePromise;
}

const MiniMaxSearchSchema = {
  type: "object",
  properties: {
    query: { type: "string", description: "Search query string." },
    count: {
      type: "number",
      description: "Number of results to return (1-10).",
      minimum: 1,
      maximum: 10,
    },
  },
} satisfies Record<string, unknown>;

export function createMiniMaxWebSearchProvider(): WebSearchProviderPlugin {
  return {
    id: "minimax",
    label: "MiniMax Search",
    hint: "Structured results via MiniMax Token Plan search API",
    onboardingScopes: ["text-inference"],
    credentialLabel: "MiniMax Token Plan key or OAuth token",
    envVars: [...MINIMAX_WEB_SEARCH_ENV_VARS],
    placeholder: "sk-cp-...",
    signupUrl: "https://platform.minimax.io/user-center/basic-information/interface-key",
    docsUrl: "https://docs.coreblow.com/tools/web",
    autoDetectOrder: 15,
    credentialPath: MINIMAX_CREDENTIAL_PATH,
    getCredentialValue: (searchConfig) => searchConfig?.apiKey,
    setCredentialValue: (searchConfigTarget, value) => {
      searchConfigTarget.apiKey = value;
    },
    createTool: (ctx) => ({
      description:
        "Search the web using MiniMax Search API. Returns titles, URLs, snippets, and related search suggestions.",
      parameters: MiniMaxSearchSchema,
      execute: async (args) => {
        const { executeMiniMaxWebSearchProviderTool } = await loadMiniMaxWebSearchRuntime();
        return await executeMiniMaxWebSearchProviderTool(ctx, args);
      },
    }),
  };
}
