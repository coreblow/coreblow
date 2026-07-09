import type { Context } from "@mariozechner/pi-ai";

// CoreBlow does not have COPILOT_INTEGRATION_ID / buildCopilotIdeHeaders.
// Provide minimal CoreBlow-native equivalents for transport layer compatibility.

const COPILOT_INTEGRATION_ID = "vscode-chat";

const COPILOT_EDITOR_VERSION = "0.0.0";
const COPILOT_EDITOR_PLUGIN_VERSION = "0.0.0";
const COPILOT_USER_AGENT = "coreblow/1.0";
const COPILOT_GITHUB_API_VERSION = "2024-12-15";

export { COPILOT_INTEGRATION_ID };

function inferCopilotInitiator(messages: Context["messages"]): "agent" | "user" {
  const last = messages[messages.length - 1];
  if (!last) {
    return "user";
  }
  if (last.role === "user" && containsCopilotContentType(last.content, "tool_result")) {
    return "agent";
  }
  return last.role === "user" ? "user" : "agent";
}

function containsCopilotContentType(value: unknown, type: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsCopilotContentType(item, type));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as { type?: unknown; content?: unknown };
  return entry.type === type || containsCopilotContentType(entry.content, type);
}

export function hasCopilotVisionInput(messages: Context["messages"]): boolean {
  return messages.some((message) => {
    if (message.role === "user" && Array.isArray(message.content)) {
      return message.content.some((item) => containsCopilotContentType(item, "image"));
    }
    if (message.role === "toolResult" && Array.isArray(message.content)) {
      return message.content.some((item) => containsCopilotContentType(item, "image"));
    }
    return false;
  });
}

/** @deprecated Copilot-specific helper; only for OpenAI Codex transport. */
export function buildCopilotIdeHeaders(
  params: {
    includeApiVersion?: boolean;
  } = {},
): Record<string, string> {
  return {
    "Accept-Encoding": "identity",
    "Editor-Version": COPILOT_EDITOR_VERSION,
    "Editor-Plugin-Version": COPILOT_EDITOR_PLUGIN_VERSION,
    "User-Agent": COPILOT_USER_AGENT,
    ...(params.includeApiVersion ? { "X-Github-Api-Version": COPILOT_GITHUB_API_VERSION } : {}),
  };
}

export function buildCopilotDynamicHeaders(params: {
  messages: Context["messages"];
  hasImages: boolean;
}): Record<string, string> {
  return {
    ...buildCopilotIdeHeaders(),
    "Copilot-Integration-Id": COPILOT_INTEGRATION_ID,
    "Openai-Organization": "github-copilot",
    "x-initiator": inferCopilotInitiator(params.messages),
    ...(params.hasImages ? { "Copilot-Vision-Request": "true" } : {}),
  };
}
