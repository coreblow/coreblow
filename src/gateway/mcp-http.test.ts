import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import type { McpLoopbackTool } from "./mcp-http.schema.js";

const runtimeConfig: CoreBlowConfig = {
  agents: { list: [{ id: "main", default: true }] },
};

const resolveGatewayScopedToolsMock = vi.hoisted(() => vi.fn());
const runBeforeToolCallHookMock = vi.hoisted(() => vi.fn());

vi.mock("../config/config.js", () => {
  return {
    getRuntimeConfigSnapshot: () => runtimeConfig,
    loadConfig: () => runtimeConfig,
  };
});

vi.mock("./tools-invoke-shared.js", () => ({
  resolveGatewayScopedTools: resolveGatewayScopedToolsMock,
}));

vi.mock("../agents/pi-tools.before-tool-call.js", () => ({
  runBeforeToolCallHook: runBeforeToolCallHookMock,
}));

function createTool(name: string): McpLoopbackTool {
  return {
    name,
    label: name,
    description: `${name} tool`,
    parameters: {
      type: "object",
      properties: {
        input: { type: "string" },
      },
      required: ["input"],
    },
    execute: vi.fn(async (_toolCallId: string, params: unknown) => ({
      content: [{ type: "text", text: JSON.stringify(params) }],
    })),
  } as unknown as McpLoopbackTool;
}

async function postMcp(params: {
  port: number;
  token: string;
  body: unknown;
  headers?: Record<string, string>;
}) {
  return await fetch(`http://127.0.0.1:${params.port}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.token}`,
      "content-type": "application/json",
      ...params.headers,
    },
    body: typeof params.body === "string" ? params.body : JSON.stringify(params.body),
  });
}

describe("MCP loopback HTTP server", () => {
  beforeEach(() => {
    resolveGatewayScopedToolsMock.mockReset();
    runBeforeToolCallHookMock.mockReset();
    runBeforeToolCallHookMock.mockResolvedValue({ blocked: false, params: { input: "approved" } });
  });

  afterEach(async () => {
    const { closeMcpLoopbackServer } = await import("./mcp-http.js");
    await closeMcpLoopbackServer();
  });

  it("starts a loopback server, publishes runtime, and handles tools/list", async () => {
    const tool = createTool("agents_list");
    resolveGatewayScopedToolsMock.mockReturnValue({
      agentId: "main",
      sessionKey: "agent:main:main",
      tools: [tool],
    });
    const { getActiveMcpLoopbackRuntime, startMcpLoopbackServer } = await import("./mcp-http.js");
    const server = await startMcpLoopbackServer(0);
    const runtime = getActiveMcpLoopbackRuntime();

    expect(runtime?.port).toBe(server.port);
    expect(runtime?.ownerToken).toHaveLength(64);
    expect(runtime?.nonOwnerToken).toHaveLength(64);

    const response = await postMcp({
      port: server.port,
      token: runtime!.ownerToken,
      body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      headers: {
        "x-session-key": "main",
        "x-coreblow-message-channel": "telegram",
        "x-coreblow-account-id": "acct-1",
        "x-coreblow-inbound-event-kind": "user_request",
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: [
          {
            name: "agents_list",
            description: "agents_list tool",
            inputSchema: {
              type: "object",
              properties: { input: { type: "string" } },
              required: ["input"],
            },
          },
        ],
      },
    });
    expect(resolveGatewayScopedToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cfg: runtimeConfig,
        sessionKey: "agent:main:main",
        messageChannel: "telegram",
        accountId: "acct-1",
        senderIsOwner: true,
        surface: "loopback",
      }),
    );
  });

  it("executes tools/call through the shared handler and hook context", async () => {
    const tool = createTool("echo");
    resolveGatewayScopedToolsMock.mockReturnValue({
      agentId: "main",
      sessionKey: "agent:main:main",
      tools: [tool],
    });
    const { getActiveMcpLoopbackRuntime, startMcpLoopbackServer } = await import("./mcp-http.js");
    const server = await startMcpLoopbackServer(0);
    const runtime = getActiveMcpLoopbackRuntime()!;

    const response = await postMcp({
      port: server.port,
      token: runtime.nonOwnerToken,
      body: {
        jsonrpc: "2.0",
        id: "call-1",
        method: "tools/call",
        params: { name: "echo", arguments: { input: "raw" } },
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: "call-1",
      result: {
        content: [{ type: "text", text: JSON.stringify({ input: "approved" }) }],
        isError: false,
      },
    });
    expect(runBeforeToolCallHookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "echo",
        params: { input: "raw" },
        ctx: { agentId: "main", sessionKey: "agent:main:main" },
      }),
    );
    expect(tool.execute).toHaveBeenCalledWith(
      expect.stringMatching(/^mcp-/),
      { input: "approved" },
      expect.any(AbortSignal),
    );
    expect(resolveGatewayScopedToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({ senderIsOwner: false }),
    );
  });

  it("returns 202 when a batch contains notifications only", async () => {
    resolveGatewayScopedToolsMock.mockReturnValue({
      agentId: "main",
      sessionKey: "agent:main:main",
      tools: [],
    });
    const { getActiveMcpLoopbackRuntime, startMcpLoopbackServer } = await import("./mcp-http.js");
    const server = await startMcpLoopbackServer(0);
    const runtime = getActiveMcpLoopbackRuntime()!;

    const response = await postMcp({
      port: server.port,
      token: runtime.ownerToken,
      body: [{ jsonrpc: "2.0", method: "notifications/initialized" }],
    });

    expect(response.status).toBe(202);
    await expect(response.text()).resolves.toBe("");
  });

  it("rejects invalid JSON with a JSON-RPC parse error", async () => {
    const { getActiveMcpLoopbackRuntime, startMcpLoopbackServer } = await import("./mcp-http.js");
    const server = await startMcpLoopbackServer(0);
    const runtime = getActiveMcpLoopbackRuntime()!;

    const response = await postMcp({
      port: server.port,
      token: runtime.ownerToken,
      body: "{not-json",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  });

  it("reuses ensured server and clears active runtime on close", async () => {
    const { closeMcpLoopbackServer, ensureMcpLoopbackServer, getActiveMcpLoopbackRuntime } =
      await import("./mcp-http.js");
    const first = await ensureMcpLoopbackServer(0);
    const second = await ensureMcpLoopbackServer(0);

    expect(second).toBe(first);
    expect(getActiveMcpLoopbackRuntime()?.port).toBe(first.port);

    await closeMcpLoopbackServer();
    expect(getActiveMcpLoopbackRuntime()).toBeUndefined();
    await closeMcpLoopbackServer();
  });
});
