import { definePluginEntry, type AnyAgentTool } from "coreblow/plugin-sdk/plugin-entry";

function readAction(params: unknown): string {
  if (!params || typeof params !== "object" || !("action" in params)) {
    return "status";
  }
  const action = params.action;
  return typeof action === "string" && action ? action : "status";
}

const qwenAuthTool: AnyAgentTool = {
  name: "qwen_auth",
  label: "Qwen Auth",
  description: "Manage Qwen authentication",
  parameters: {
    type: "object",
    properties: { action: { type: "string", enum: ["login", "refresh", "status"] } },
    required: ["action"],
  },
  async execute(_toolCallId: string, params: unknown) {
    const action = readAction(params);
    return {
      content: [{ type: "text" as const, text: `Qwen auth ${action}` }],
      details: { action },
    };
  },
};

export default definePluginEntry({
  id: "qwen-auth",
  name: "Qwen Auth",
  description: "Qwen portal auth compatibility plugin",
  register(api) {
    api.registerTool(qwenAuthTool);
    api.logger.info("Qwen Auth compatibility plugin initialized");
  },
});
