import os from "node:os";
import path from "node:path";
import type { PromptRequest } from "@agentclientprotocol/sdk";
import { describe, expect, it, vi } from "vitest";
import type { GatewayClient } from "../gateway/client.js";
import { createInMemorySessionStore } from "./session.js";
import { AcpGatewayAgent } from "./translator.js";
import { createAcpConnection, createAcpGateway } from "./translator.test-helpers.js";

const TEST_SESSION_ID = "session-1";
const TEST_SESSION_KEY = "agent:main:main";
const TEST_PROMPT = {
  sessionId: TEST_SESSION_ID,
  prompt: [{ type: "text", text: "hello" }],
  _meta: {},
} as unknown as PromptRequest;

describe("acp prompt cwd prefix", () => {
  const createStopAfterSendSpy = () =>
    vi.fn(async (method: string) => {
      if (method === "chat.send") {
        throw new Error("stop-after-send");
      }
      return {};
    });

  async function runPromptAndCaptureRequest(
    options: {
      cwd?: string;
      prefixCwd?: boolean;
    } = {},
  ) {
    const sessionStore = createInMemorySessionStore();
    sessionStore.createSession({
      sessionId: TEST_SESSION_ID,
      sessionKey: TEST_SESSION_KEY,
      cwd: options.cwd ?? path.join(os.homedir(), "coreblow-test"),
    });

    const requestSpy = createStopAfterSendSpy();
    const agent = new AcpGatewayAgent(
      createAcpConnection(),
      createAcpGateway(requestSpy as unknown as GatewayClient["request"]),
      {
        sessionStore,
        prefixCwd: options.prefixCwd,
      },
    );

    await expect(agent.prompt(TEST_PROMPT)).rejects.toThrow("stop-after-send");
    return requestSpy;
  }

  it("does not include cwd prefix when prefixCwd is false", async () => {
    const spy = await runPromptAndCaptureRequest({ prefixCwd: false });
    const chatSendCall = spy.mock.calls.find(([method]) => method === "chat.send");
    expect(chatSendCall).toBeDefined();
    const params = chatSendCall![1] as Record<string, unknown>;
    const messages = params?.messages as Array<{ content?: unknown }> | undefined;
    if (messages && messages.length > 0) {
      const firstContent = JSON.stringify(messages[0]);
      expect(firstContent).not.toMatch(/Working directory/i);
    }
  });

  it("includes cwd prefix in prompt when prefixCwd is true", async () => {
    const cwd = path.join(os.tmpdir(), "test-workspace");
    const spy = await runPromptAndCaptureRequest({ cwd, prefixCwd: true });
    const chatSendCall = spy.mock.calls.find(([method]) => method === "chat.send");
    expect(chatSendCall).toBeDefined();
  });

  it("sends a chat.send request for a valid prompt", async () => {
    const spy = await runPromptAndCaptureRequest({});
    const chatSendCall = spy.mock.calls.find(([method]) => method === "chat.send");
    expect(chatSendCall).toBeDefined();
  });
});
