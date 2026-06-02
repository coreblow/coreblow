import type { ProviderPlugin } from "coreblow/plugin-sdk/provider-model-shared";
import { buildTokenHubProvider } from "./provider-catalog.js";

const tencentProviderDiscovery: ProviderPlugin = {
  id: "tencent-tokenhub",
  label: "Tencent TokenHub",
  docsPath: "/providers/models",
  auth: [],
  catalog: {
    order: "simple",
    run: async () => ({
      provider: buildTokenHubProvider(),
    }),
  },
};

export default tencentProviderDiscovery;
