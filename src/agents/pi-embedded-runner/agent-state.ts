import type { AgentMessage } from "@mariozechner/pi-agent-core";

export type MutablePiAgentLike = {
  setSystemPrompt?: (prompt: string) => void;
  replaceMessages?: (messages: AgentMessage[]) => void;
  state?: {
    systemPrompt?: string;
    messages?: AgentMessage[];
  };
};

/**
 * Replaces the live agent message transcript across both pi-agent-core >=0.70 (`agent.state.messages`)
 * and legacy test mocks (`agent.replaceMessages`).
 */
export function replaceAgentMessages(agent: unknown, messages: AgentMessage[]): void {
  const target = agent as MutablePiAgentLike | undefined;
  if (!target) {
    return;
  }
  if (typeof target.replaceMessages === "function") {
    target.replaceMessages(messages);
  }
  if (target.state && typeof target.state === "object") {
    target.state.messages = messages;
  }
}

/**
 * Applies a system prompt override across both pi-agent-core >=0.70 (`agent.state.systemPrompt`)
 * and legacy test mocks (`agent.setSystemPrompt`).
 */
export function setAgentSystemPrompt(agent: unknown, prompt: string): void {
  const target = agent as MutablePiAgentLike | undefined;
  if (!target) {
    return;
  }
  if (typeof target.setSystemPrompt === "function") {
    target.setSystemPrompt(prompt);
  }
  if (target.state && typeof target.state === "object") {
    target.state.systemPrompt = prompt;
  }
}

/**
 * Maps CoreBlow's `customTools` list into `createAgentSession` options for pi-coding-agent >=0.70,
 * where `options.tools` is a name allowlist and `noTools: "builtin"` suppresses default built-in tools.
 */
export function resolveSdkSessionToolOptions(customTools: ReadonlyArray<{ name: string }>): {
  noTools: "builtin" | "all";
  tools: string[];
} {
  const toolNames = customTools.map((tool) => tool.name);
  return {
    noTools: toolNames.length > 0 ? "builtin" : "all",
    tools: toolNames,
  };
}
