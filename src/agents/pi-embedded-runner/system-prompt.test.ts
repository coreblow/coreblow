// @ts-nocheck
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { describe, expect, it, vi , Mock } from "vitest";
import { applySystemPromptOverrideToSession, createSystemPromptOverride } from "./system-prompt.js";

type MutableSession = {
  _baseSystemPrompt?: string;
  _rebuildSystemPrompt?: (toolNames: string[]) => string;
};

type MockSession = MutableSession & {
  agent: {
    setSystemPrompt: Mock;
  };
};

function createMockSession(): {
  session: MockSession;
  setSystemPrompt: Mock;
} {
  const setSystemPrompt = vi.fn();
  const session = {
    agent: { setSystemPrompt },
  } as MockSession;
  return { session, setSystemPrompt };
}

function applyAndGetMutableSession(
  prompt: Parameters<typeof applySystemPromptOverrideToSession>[1],
) {
  const { session, setSystemPrompt } = createMockSession();
  applySystemPromptOverrideToSession(session as unknown as AgentSession, prompt);
  return {
    mutable: session,
    setSystemPrompt,
  };
}

describe("applySystemPromptOverrideToSession", () => {
  it("applies a string override to the session system prompt", () => {
    const prompt = "You are a helpful assistant with custom context.";
    const { mutable, setSystemPrompt } = applyAndGetMutableSession(prompt);

    expect(setSystemPrompt).toHaveBeenCalledWith(prompt);
    expect(mutable._baseSystemPrompt).toBe(prompt);
  });

  it("trims whitespace from string overrides", () => {
    const { setSystemPrompt } = applyAndGetMutableSession("  padded prompt  ");

    expect(setSystemPrompt).toHaveBeenCalledWith("padded prompt");
  });

  it("applies a function override to the session system prompt", () => {
    const override = createSystemPromptOverride("function-based prompt");
    const { setSystemPrompt } = applyAndGetMutableSession(override);

    expect(setSystemPrompt).toHaveBeenCalledWith("function-based prompt");
  });

  it("sets _rebuildSystemPrompt that returns the override", () => {
    const { mutable } = applyAndGetMutableSession("rebuild test");
    expect(mutable._rebuildSystemPrompt?.(["tool1"])).toBe("rebuild test");
  });

  it("updates agent.state.systemPrompt when agent.setSystemPrompt is absent (pi-agent-core >=0.70)", () => {
    const session = {
      agent: {
        state: { systemPrompt: "" },
      },
    } as unknown as AgentSession & {
      agent: { state: { systemPrompt: string } };
      _baseSystemPrompt?: string;
    };
    applySystemPromptOverrideToSession(session, "  state-backed prompt  ");
    expect(session.agent.state.systemPrompt).toBe("state-backed prompt");
    expect(session._baseSystemPrompt).toBe("state-backed prompt");
  });
});
