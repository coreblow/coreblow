import { definePluginEntry, type AnyAgentTool } from "coreblow/plugin-sdk/plugin-entry";

function readAction(params: unknown): string {
  if (!params || typeof params !== "object" || !("action" in params)) {
    return "status";
  }
  const action = params.action;
  return typeof action === "string" && action ? action : "status";
}

const geminiAuthTool: AnyAgentTool = {
  name: "gemini_auth",
  label: "Gemini Auth",
  description: "Manage Gemini authentication tokens",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["login", "refresh", "status", "logout"] },
    },
    required: ["action"],
  },
  async execute(_toolCallId: string, params: unknown) {
    const action = readAction(params);
    throw new Error(
      `gemini_auth is deprecated and non-functional. Configure GEMINI_API_KEY in environment or run 'coreblow configure' for Gemini provider credentials. (action requested: ${action})`,
    );
  },
};

export default definePluginEntry({
  id: "gemini-auth",
  name: "Gemini Auth",
  description: "Google Gemini CLI auth compatibility plugin",
  register(api) {
    api.registerTool(geminiAuthTool);
    api.logger.info("Gemini Auth compatibility plugin initialized");
  },
});
