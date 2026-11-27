import type { CoreBlowPluginApi } from "./runtime-api.js";
import { A2ATaskStore, createA2aHttpHandler } from "./src/server.js";

export * from "./src/protocol.js";
export * from "./src/security.js";
export * from "./src/server.js";
export * from "./src/client.js";

type A2aPluginConfig = {
  enabled?: boolean;
  agentName?: string;
  agentVersion?: string;
  baseUrl?: string;
  maxTasks?: number;
};

const plugin = {
  id: "a2a",
  name: "A2A Protocol",
  description:
    "External Agent-to-Agent (A2A) protocol extension with /.well-known/agent.json discovery and JSON-RPC 2.0 task lifecycle.",
  register(api: CoreBlowPluginApi) {
    const cfg = (api.pluginConfig ?? {}) as A2aPluginConfig;
    const taskStore = new A2ATaskStore(cfg.maxTasks);
    const baseUrl = (cfg.baseUrl ?? "http://127.0.0.1:18789").replace(/\/+$/, "");
    const httpHandler = createA2aHttpHandler({
      agentCard: {
        name: cfg.agentName ?? "CoreBlow Agent",
        description: "CoreBlow External Agent-to-Agent (A2A) endpoint",
        version: cfg.agentVersion ?? "2.7.0",
        url: `${baseUrl}/a2a`,
        capabilities: {
          streaming: false,
          pushNotifications: false,
          stateTransitionHistory: true,
        },
        authentication: {
          schemes: ["Bearer"],
        },
        skills: [
          {
            id: "coreflow-task",
            name: "CoreFlow Task",
            description: "Execute and manage A2A JSON-RPC 2.0 tasks via CoreBlow.",
          },
        ],
      },
      taskStore,
    });

    api.registerHttpRoute({
      path: "/.well-known/agent.json",
      auth: "plugin",
      match: "exact",
      handler: httpHandler,
    });

    api.registerHttpRoute({
      path: "/a2a",
      auth: "gateway",
      match: "exact",
      gatewayRuntimeScopeSurface: "trusted-operator",
      handler: httpHandler,
    });

    api.registerService({
      id: "a2a-protocol",
      start: async () => {
        // Routes are registered eagerly during plugin load.
      },
      stop: async () => {},
    });
  },
};

export default plugin;
