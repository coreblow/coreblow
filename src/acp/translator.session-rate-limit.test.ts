import type { LoadSessionRequest, PromptRequest } from "@agentclientprotocol/sdk";
import { describe, expect, it, vi } from "vitest";
import type { GatewayClient } from "../gateway/client.js";
import { createInMemorySessionStore } from "./session.js";
import { AcpGatewayAgent } from "./translator.js";
import { createAcpConnection, createAcpGateway } from "./translator.test-helpers.js";

function createLoadSessionRequest(sessionId: string, cwd = "/tmp"): LoadSessionRequest {
  return {
    sessionId,
    cwd,
    mcpServers: [],
    _meta: {},
  } as unknown as LoadSessionRequest;
}

function createPromptRequest(
  sessionId: string,
  text: string,
): PromptRequest {
  return {
    sessionId,
    prompt: [{ type: "text", text }],
    _meta: {},
  } as unknown as PromptRequest;
}

function createHangingRequestSpy() {
  return vi.fn(async (method: string) => {
    if (method === "chat.send") {
      return new Promise<never>(() => {});
    }
    return {};
  });
}

describe("acp session rate limit", () => {
  it("allows a second prompt after first completes", async () => {
    const sessionStore = createInMemorySessionStore();
    const requestSpy = createHangingRequestSpy();
    const connection = createAcpConnection();

    const agent = new AcpGatewayAgent(
      connection,
      createAcpGateway(requestSpy as unknown as GatewayClient["request"]),
      { sessionStore },
    );

    await agent.loadSession(createLoadSessionRequest("rate-session"));

    const prompt1 = agent.prompt(createPromptRequest("rate-session", "first"));

    const runId = sessionStore.getSession("rate-session")?.activeRunId;
    expect(runId).toBeDefined();

    // Resolve prompt 1
    await agent.handleGatewayEvent({
      type: "event",
      event: "chat",
      payload: {
        sessionKey: sessionStore.getSession("rate-session")?.sessionKey,
        runId,
        state: "final",
        stopReason: "end_turn",
      },
    } as Parameters<AcpGatewayAgent["handleGatewayEvent"]>[0]);

    await expect(prompt1).resolves.toEqual({ stopReason: "end_turn" });

    // Second prompt should now be allowed
    const prompt2 = agent.prompt(createPromptRequest("rate-session", "second"));
    const runId2 = sessionStore.getSession("rate-session")?.activeRunId;
    expect(runId2).toBeDefined();
    expect(runId2).not.toBe(runId);

    await agent.handleGatewayEvent({
      type: "event",
      event: "chat",
      payload: {
        sessionKey: sessionStore.getSession("rate-session")?.sessionKey,
        runId: runId2,
        state: "final",
        stopReason: "end_turn",
      },
    } as Parameters<AcpGatewayAgent["handleGatewayEvent"]>[0]);

    await expect(prompt2).resolves.toEqual({ stopReason: "end_turn" });
  });

  it("rejects second prompt when first is still running", async () => {
    const sessionStore = createInMemorySessionStore();
    const requestSpy = createHangingRequestSpy();
    const connection = createAcpConnection();

    const agent = new AcpGatewayAgent(
      connection,
      createAcpGateway(requestSpy as unknown as GatewayClient["request"]),
      { sessionStore },
    );

    await agent.loadSession(createLoadSessionRequest("rate-limit-session"));

    // First prompt — hangs
    const prompt1 = agent.prompt(createPromptRequest("rate-limit-session", "first"));

    // Verify first prompt is in-flight
    const runId = sessionStore.getSession("rate-limit-session")?.activeRunId;
    expect(runId).toBeDefined();

    // Cancel to unblock — CB resolves with stopReason:'cancelled' rather than rejecting
    await agent.cancel({ sessionId: "rate-limit-session", _meta: {} } as Parameters<AcpGatewayAgent["cancel"]>[0]);
    // Prompt resolves or rejects — either way it completes
    await Promise.allSettled([prompt1]);
    // Session should no longer have activeRunId after cancel (CB sets it to null)
    const afterCancel = sessionStore.getSession("rate-limit-session")?.activeRunId;
    expect(afterCancel == null).toBe(true); // null or undefined
  }, 10_000);
});
