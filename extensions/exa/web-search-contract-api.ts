import type { WebSearchProviderPlugin } from "coreblow/plugin-sdk/provider-web-search";
import { createExaWebSearchProviderBase } from "./src/exa-web-search-provider.shared.js";

export function createExaWebSearchProvider(): WebSearchProviderPlugin {
  return {
    ...createExaWebSearchProviderBase(),
    createTool: () => null,
  };
}
