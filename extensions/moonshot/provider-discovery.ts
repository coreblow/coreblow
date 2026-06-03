import type { ProviderPlugin } from "coreblow/plugin-sdk/provider-model-shared";
import { buildMoonshotProvider } from "./provider-catalog.js";

const moonshotProviderDiscovery: ProviderPlugin = {
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

export default moonshotProviderDiscovery;
