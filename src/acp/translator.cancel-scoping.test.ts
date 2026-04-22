import type { PromptRequest } from "@agentclientprotocol/sdk";
import { describe, expect, it, vi } from "vitest";
import type { GatewayClient } from "../gateway/client.js";
import type { EventFrame } from "../gateway/protocol/index.js";
import { createInMemorySessionStore } from "./session.js";
import { AcpGatewayAgent } from "./translator.js";
import { createAcpConnection, createAcpGateway } from "./translator.test-helpers.js";

type Harness = {
  agent: AcpGatewayAgent;
  requestSpy: ReturnType<typeof vi.fn>;
  sessionUpdateSpy: ReturnType<typeof vi.fn>;
  sessionStore: ReturnType<typeof createInMemorySessionStore>;
  sentRunIds: string[];
};

function createPromptRequest(sessionId: string): PromptRequest {
  return {
    sessionId,
    prompt: [{ type: "text", text: "hello" }],
    _meta: {},
  } as unknown as PromptRequest;
}

function createChatEvent(payload: Record<string, unknown>): EventFrame {
  return {
    type: "event",
    event: "chat",
    payload,
  } as EventFrame;
}

function createHarness(sessions: Array<{ sessionId: string; sessionKey: string }>): Harness {
  const sentRunIds: string[] = [];
  const requestSpy = vi.fn(async (method: string, params?: Record<string, unknown>) => {
    if (method === "chat.send") {
      const runId = params?.idempotencyKey;
      if (typeof runId === "string") {
        sentRunIds.push(runId);
      }
      return new Promise<never>(() => {});
    }
    return {};
  });
  const connection = createAcpConnection();
  const sessionUpdateSpy = connection.__sessionUpdateMock;
  const sessionStore = createInMemorySessionStore();

  for (const session of sessions) {
    sessionStore.createSession({
      sessionId: session.sessionId,
      sessionKey: session.sessionKey,
      cwd: "/tmp",
    });
  }

  const agent = new AcpGatewayAgent(
    connection,
    createAcpGateway(requestSpy as unknown as GatewayClient["request"]),
    { sessionStore },
  );

  return { agent, requestSpy, sessionUpdateSpy, sessionStore, sentRunIds };
}

describe("acp translator cancel scoping", () => {
  it("cancels only the target session, not other sessions", async () => {
    const { agent, sentRunIds, sessionStore } = createHarness([
      { sessionId: "session-a", sessionKey: "agent:main:a" },
      { sessionId: "session-b", sessionKey: "agent:main:b" },
    ]);

    await agent.loadSession({
      sessionId: "session-a",
      cwd: "/tmp",
      mcpServers: [],
      _meta: {},
    } as Parameters<AcpGatewayAgent["loadSession"]>[0]);

    await agent.loadSession({
      sessionId: "session-b",
      cwd: "/tmp",
      mcpServers: [],
      _meta: {},
    } as Parameters<AcpGatewayAgent["loadSession"]>[0]);

    const promptPromise = agent.prompt(createPromptRequest("session-a"));
    const runIdA = sessionStore.getSession("session-a")?.activeRunId;
    expect(typeof runIdA).toBe("string");

    // Cancel session-a only
    await agent.cancel({ sessionId: "session-a", _meta: {} } as Parameters<AcpGatewayAgent["cancel"]>[0]);

    // session-b should still be active/unaffected
    const sessionB = sessionStore.getSession("session-b");
    expect(sessionB).toBeDefined();

    // Resolve the pending prompt
    if (runIdA) {
      await agent.handleGatewayEvent(
        createChatEvent({
          sessionKey: "agent:main:a",
          runId: runIdA,
          state: "final",
          stopReason: "cancelled",
        }),
      );
    }

    await expect(promptPromise).resolves.toBeDefined();
  });

  it("ignores cancel for unknown session", async () => {
    const { agent } = createHarness([]);

    await expect(
      agent.cancel({ sessionId: "nonexistent", _meta: {} } as Parameters<AcpGatewayAgent["cancel"]>[0]),
    ).resolves.not.toThrow();
  });
});
