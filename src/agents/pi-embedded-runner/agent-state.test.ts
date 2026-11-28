import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it, vi } from "vitest";
import { replaceAgentMessages, setAgentSystemPrompt } from "./agent-state.js";

describe("pi-embedded-runner agent state helpers", () => {
  it("updates agent.state.messages when replaceMessages is absent (pi-agent-core >=0.70)", () => {
    const messages = [{ role: "user", content: "hello", timestamp: 1 }] as AgentMessage[];
    const agent = { state: { messages: [] as AgentMessage[] } };

    replaceAgentMessages(agent, messages);
    expect(agent.state.messages).toEqual(messages);
  });

  it("supports legacy replaceMessages mocks alongside state updates", () => {
    const messages = [{ role: "user", content: "hi", timestamp: 2 }] as AgentMessage[];
    const replaceMessages = vi.fn();
    const agent = { replaceMessages, state: { messages: [] as AgentMessage[] } };

    replaceAgentMessages(agent, messages);
    expect(replaceMessages).toHaveBeenCalledWith(messages);
    expect(agent.state.messages).toEqual(messages);
  });

  it("updates agent.state.systemPrompt and supports legacy setSystemPrompt mocks", () => {
    const stateOnly = { state: { systemPrompt: "" } };
    setAgentSystemPrompt(stateOnly, "prompt-1");
    expect(stateOnly.state.systemPrompt).toBe("prompt-1");

    const setSystemPrompt = vi.fn();
    const withLegacy = { setSystemPrompt, state: { systemPrompt: "" } };
    setAgentSystemPrompt(withLegacy, "prompt-2");
    expect(setSystemPrompt).toHaveBeenCalledWith("prompt-2");
    expect(withLegacy.state.systemPrompt).toBe("prompt-2");
  });
});
