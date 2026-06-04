import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";
import { anthropicVertexProviderDiscovery } from "./provider-discovery.js";
import { createAnthropicVertexStreamFnForModel } from "./stream-runtime.js";

export default definePluginEntry({
  id: "anthropic-vertex",
  name: "Anthropic Vertex Provider",
  description: "Bundled Anthropic Vertex provider plugin",
  register(api) {
    api.registerProvider({
      ...anthropicVertexProviderDiscovery,
      capabilities: {
        providerFamily: "anthropic",
        dropThinkingBlockModelHints: ["claude"],
      },
      createStreamFn: ({ model }) => createAnthropicVertexStreamFnForModel(model),
    });
  },
});
