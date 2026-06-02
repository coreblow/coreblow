import type { WebSearchProviderPlugin } from "coreblow/plugin-sdk/provider-web-search";
import { createBraveWebSearchProviderBase } from "./src/brave-web-search-provider.shared.js";

export function createBraveWebSearchProvider(): WebSearchProviderPlugin {
  return {
    ...createBraveWebSearchProviderBase(),
    createTool: () => null,
  };
}
