import type { ProviderPlugin } from "coreblow/plugin-sdk/provider-model-shared";
import { buildMoonshotProvider } from "./provider-catalog.js";

export function createMoonshotProvider(): ProviderPlugin {
  return {
    id: "moonshot",
    label: "Moonshot",
    docsPath: "/providers/moonshot",
    auth: [],
    catalog: {
      order: "simple",
      run: async () => ({
        provider: buildMoonshotProvider(),
      }),
    },
  };
}
