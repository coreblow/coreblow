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
