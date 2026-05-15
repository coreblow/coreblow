import { definePluginEntry, type AnyAgentTool } from "coreblow/plugin-sdk/plugin-entry";

function readAction(params: unknown): string {
  if (!params || typeof params !== "object" || !("action" in params)) {
    return "status";
  }
  const action = params.action;
  return typeof action === "string" && action ? action : "status";
}

const minimaxAuthTool: AnyAgentTool = {
  name: "minimax_auth",
  label: "MiniMax Auth",
  description: "Manage MiniMax authentication",
  parameters: {
    type: "object",
    properties: { action: { type: "string", enum: ["login", "refresh", "status"] } },
    required: ["action"],
  },
  async execute(_toolCallId: string, params: unknown) {
    const action = readAction(params);
    return {
      content: [{ type: "text" as const, text: `MiniMax auth ${action}` }],
      details: { action },
    };
  },
};

export default definePluginEntry({
  id: "minimax-auth",
  name: "MiniMax Auth",
  description: "MiniMax portal auth compatibility plugin",
  register(api) {
    api.registerTool(minimaxAuthTool);
    api.logger.info("MiniMax Auth compatibility plugin initialized");
  },
});
