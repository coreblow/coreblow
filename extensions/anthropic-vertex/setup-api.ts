import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";
import { resolveAnthropicVertexConfigApiKey } from "./region.js";

export default definePluginEntry({
  id: "anthropic-vertex",
  name: "Anthropic Vertex Setup",
  description: "Lightweight Anthropic Vertex setup hooks",
  register(api) {
    api.registerProvider({
      id: "anthropic-vertex",
      label: "Anthropic Vertex",
      docsPath: "/providers/models",
      auth: [],
      resolveConfigApiKey: ({ env }) => resolveAnthropicVertexConfigApiKey(env),
    });
  },
});
