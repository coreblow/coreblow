/**
 * tests/contracts/acp-protocol.contract.test.ts
 *
 * Contract test: verifikasi bahwa ACP protocol public API
 * tidak berubah secara breaking — shape, method signatures,
 * dan response invariants tetap stabil.
 */
import type {
  InitializeRequest,
  LoadSessionRequest,
  NewSessionRequest,
  PromptRequest,
} from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import { createInMemorySessionStore } from "../../src/acp/session.js";
import { AcpGatewayAgent } from "../../src/acp/translator.js";
import {
  createAcpConnection,
  createAcpGateway,
} from "../../src/acp/translator.test-helpers.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeAgent() {
  const sessionStore = createInMemorySessionStore();
  const requestSpy = async (method: string) => {
    if (method === "chat.send") return new Promise<never>(() => {});
    return {};
  };
  return new AcpGatewayAgent(
    createAcpConnection(),
    createAcpGateway(requestSpy),
    { sessionStore },
  );
}

// ─── AcpGatewayAgent shape contract ─────────────────────────────────────────

describe("AcpGatewayAgent — API shape contract", () => {
  it("has required public methods", () => {
    const agent = makeAgent();
    const required = [
      "initialize",
      "newSession",
      "loadSession",
      "prompt",
      "cancel",
      "handleGatewayEvent",
    ];
    for (const method of required) {
      expect(typeof (agent as unknown as Record<string, unknown>)[method]).toBe("function");
    }
  });

  it("initialize returns correct shape", async () => {
    const agent = makeAgent();
    const res = await agent.initialize({
      clientInfo: { name: "test", version: "1.0" },
      _meta: {},
    } as unknown as InitializeRequest);

    // CB uses numeric PROTOCOL_VERSION from @agentclientprotocol/sdk
    expect(res).toMatchObject({
      protocolVersion: expect.anything(), // number or string depending on SDK version
      agentCapabilities: expect.objectContaining({
        loadSession: true,
      }),
    });
  });

  it("newSession returns sessionId string", async () => {
    const agent = makeAgent();
    const res = await agent.newSession({
      cwd: "/tmp",
      mcpServers: [],
      _meta: {},
    } as unknown as NewSessionRequest);

    expect(typeof res.sessionId).toBe("string");
    expect(res.sessionId.length).toBeGreaterThan(0);
  });

  it("loadSession accepts existing session without throwing", async () => {
    const agent = makeAgent();
    const newRes = await agent.newSession({
      cwd: "/tmp",
      mcpServers: [],
      _meta: {},
    } as unknown as NewSessionRequest);

    // Contract: loadSession must resolve (not throw) for existing session
    await expect(
      agent.loadSession({
        sessionId: newRes.sessionId,
        cwd: "/tmp",
        mcpServers: [],
        _meta: {},
      } as unknown as LoadSessionRequest),
    ).resolves.toBeDefined();
  });

  it("cancel resolves without throwing for unknown session", async () => {
    const agent = makeAgent();
    await expect(
      agent.cancel({ sessionId: "ghost-session", _meta: {} } as Parameters<
        AcpGatewayAgent["cancel"]
      >[0]),
    ).resolves.not.toThrow();
  });
});

// ─── PromptResponse shape contract ──────────────────────────────────────────

describe("AcpGatewayAgent prompt — response invariants", () => {
  it("prompt resolves with stopReason on final event", async () => {
    const sessionStore = createInMemorySessionStore();
    const agent = new AcpGatewayAgent(
      createAcpConnection(),
      createAcpGateway(async (method: string) => {
        if (method === "chat.send") return new Promise<never>(() => {});
        return {};
      }),
      { sessionStore },
    );

    const newRes = await agent.newSession({
      cwd: "/tmp",
      mcpServers: [],
      _meta: {},
    } as unknown as NewSessionRequest);

    const promptPromise = agent.prompt({
      sessionId: newRes.sessionId,
      prompt: [{ type: "text", text: "hello" }],
      _meta: {},
    } as unknown as PromptRequest);

    const runId = sessionStore.getSession(newRes.sessionId)?.activeRunId;
    const sessionKey = sessionStore.getSession(newRes.sessionId)?.sessionKey;

    await agent.handleGatewayEvent({
      type: "event",
      event: "chat",
      payload: { sessionKey, runId, state: "final", stopReason: "end_turn" },
    } as Parameters<AcpGatewayAgent["handleGatewayEvent"]>[0]);

    const res = await promptPromise;
    // Contract: response MUST contain stopReason
    expect(res).toHaveProperty("stopReason");
    expect(typeof res.stopReason).toBe("string");
  });
});
