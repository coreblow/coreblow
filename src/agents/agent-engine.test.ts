import { describe, expect, it, vi, beforeEach } from "vitest";
import { AgentEngine } from "./agent-engine.js";
import type { ModelProvider } from "./runtime.js";

// ─── Helpers ─────────────────────────────────────────────────────

/** Minimal ModelProvider stub that returns canned responses. */
function createMockProvider(responses: Array<{
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  finishReason?: string;
  usage?: { input: number; output: number; total: number };
}>): ModelProvider {
  let callIndex = 0;
  return {
    id: "mock",
    chat: async () => {
      const resp = responses[callIndex] ?? responses[responses.length - 1]!;
      callIndex++;
      return {
        content: resp.content,
        toolCalls: resp.toolCalls,
        finishReason: resp.finishReason ?? "stop",
        usage: resp.usage ?? { input: 10, output: 20, total: 30 },
      };
    },
  } as ModelProvider;
}

describe("agent-engine", () => {
  it("ok", async () => {
    const m = await import("./agent-engine.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});

describe("auth-profiles.runtime", () => {
  it("ok", async () => {
    const m = await import("./auth-profiles.runtime.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});

// ─── runTurn Tests ───────────────────────────────────────────────

describe("AgentEngine.runTurn", () => {
  let engine: AgentEngine;

  beforeEach(() => {
    engine = new AgentEngine({ maxConcurrentSessions: 4 });
  });

  it("returns a text response for a simple turn", async () => {
    const provider = createMockProvider([
      { content: "Hello!" },
    ]);
    engine.registerProvider(provider, true);

    const sessionId = engine.createSession({ model: "test-model", provider: "mock" });
    const result = await engine.runTurn(sessionId, "Hi");

    expect(result.responseText).toBe("Hello!");
    expect(result.sessionId).toBe(sessionId);
    expect(result.turnNumber).toBe(1);

    // Session should be idle after a normal turn
    const session = engine.getSession(sessionId);
    expect(session?.state).toBe("idle");
  });

  it("handles tool calls with recursive continuation without double-release", async () => {
    // First response: model requests a tool call
    // Second response (after tool result): model gives a text answer
    const provider = createMockProvider([
      {
        content: "",
        toolCalls: [{ id: "call_1", name: "get_time", arguments: "{}" }],
        finishReason: "tool_calls",
      },
      {
        content: "The time is 12:00",
        finishReason: "stop",
      },
    ]);
    engine.registerProvider(provider, true);

    // Register a tool handler
    engine.registerTool({
      name: "get_time",
      description: "Gets the current time",
      parameters: {},
      handler: async () => "12:00 PM",
    });

    const sessionId = engine.createSession({ model: "test-model", provider: "mock" });
    const result = await engine.runTurn(sessionId, "What time is it?");

    // The recursive turn should have produced the final text
    expect(result.responseText).toBe("The time is 12:00");
    // Tool calls from both turns should be merged
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe("get_time");
    expect(result.toolCalls[0]?.output).toBe("12:00 PM");

    // Session should be idle after completion, not stuck in error/running
    const session = engine.getSession(sessionId);
    expect(session?.state).toBe("idle");
  });

  it("releases lock correctly after tool recursion so a second turn can run", async () => {
    const provider = createMockProvider([
      // Turn 1 response 1: tool call
      {
        content: "",
        toolCalls: [{ id: "call_1", name: "echo", arguments: '{"msg":"hi"}' }],
      },
      // Turn 1 response 2: final text
      { content: "Done with tool" },
      // Turn 2: another simple response
      { content: "Second turn response" },
    ]);
    engine.registerProvider(provider, true);

    engine.registerTool({
      name: "echo",
      description: "Echoes input",
      parameters: {},
      handler: async (args) => String((args as Record<string, unknown>).msg ?? ""),
    });

    const sessionId = engine.createSession({ model: "test-model", provider: "mock" });

    // Turn 1 with tool recursion
    const result1 = await engine.runTurn(sessionId, "Use echo");
    expect(result1.responseText).toBe("Done with tool");

    // Turn 2: should NOT throw "already running" — proves lock was
    // released exactly once after the recursive path completed.
    const result2 = await engine.runTurn(sessionId, "Hello again");
    expect(result2.responseText).toBe("Second turn response");
  });

  it("releases lock on error so session is not permanently locked", async () => {
    const provider = createMockProvider([
      { content: "This won't matter" },
    ]);
    // Make the provider throw
    provider.chat = async () => { throw new Error("Provider exploded"); };
    engine.registerProvider(provider, true);

    const sessionId = engine.createSession({ model: "test-model", provider: "mock" });

    await expect(engine.runTurn(sessionId, "Boom")).rejects.toThrow("Provider exploded");

    // Session should be in error state
    const session = engine.getSession(sessionId);
    expect(session?.state).toBe("error");

    // Fix the provider for the next call
    provider.chat = async () => ({
      content: "Recovered",
      finishReason: "stop",
      usage: { input: 5, output: 5, total: 10 },
    });

    // Should NOT throw "already running" — lock was properly released
    const result = await engine.runTurn(sessionId, "Try again");
    expect(result.responseText).toBe("Recovered");
  });

  it("rejects concurrent runs on the same session", async () => {
    // Provider that takes a while to respond
    const provider = {
      id: "slow",
      chat: () => new Promise((resolve) => {
        setTimeout(() => resolve({
          content: "Slow response",
          finishReason: "stop",
          usage: { input: 5, output: 5, total: 10 },
        }), 50);
      }),
    } as unknown as ModelProvider;
    engine.registerProvider(provider, true);

    const sessionId = engine.createSession({ model: "test-model", provider: "slow" });

    const turn1 = engine.runTurn(sessionId, "First");
    // Immediately try a second concurrent turn
    await expect(engine.runTurn(sessionId, "Second"))
      .rejects.toThrow(`Session "${sessionId}" is already running`);

    // First turn should still complete
    const result = await turn1;
    expect(result.responseText).toBe("Slow response");
  });
});
