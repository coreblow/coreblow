import type { CoreBlowPluginApi } from "./runtime-api.js";

export * from "./src/protocol.js";
export * from "./src/security.js";
export * from "./src/server.js";
export * from "./src/client.js";

const plugin = {
  id: "a2a",
  name: "A2A Protocol",
  description:
    "External Agent-to-Agent (A2A) protocol extension with /.well-known/agent.json discovery and JSON-RPC 2.0 task lifecycle.",
  register(api: CoreBlowPluginApi) {
    api.registerService({
      id: "a2a-protocol",
      start: async () => {
        // Lazy service initialization: routes & handlers are constructed on demand.
      },
      stop: async () => {},
    });
  },
};

export default plugin;
