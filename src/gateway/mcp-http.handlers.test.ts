import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpLoopbackTool, McpToolSchemaEntry } from "./mcp-http.schema.js";
import { handleMcpJsonRpc } from "./mcp-http.handlers.js";

const runBeforeToolCallHookMock = vi.hoisted(() =>
  vi.fn(async ({ params }: { params: unknown }) => ({
    blocked: false as boolean,
    reason: undefined as string | undefined,
    params,
  })),
);

vi.mock("../agents/pi-tools.before-tool-call.js", () => ({
  runBeforeToolCallHook: runBeforeToolCallHookMock,
}));

const TOOL_SCHEMA: McpToolSchemaEntry[] = [
  {
    name: "demo",
    description: "Demo tool",
    inputSchema: { type: "object", properties: {} },
  },
];

function createTool(
  execute: (...args: unknown[]) => Promise<unknown> = vi.fn(async () => ({
    content: [{ type: "text", text: "done" }],
  })),
) {
  return {
    name: "demo",
    label: "demo",
    description: "Demo tool",
    parameters: { type: "object", properties: {} },
    execute,
  } as unknown as McpLoopbackTool;
}

describe("MCP loopback JSON-RPC handler", () => {
  beforeEach(() => {
    runBeforeToolCallHookMock.mockReset();
    runBeforeToolCallHookMock.mockImplementation(async ({ params }: { params: unknown }) => ({
      blocked: false,
      reason: undefined,
      params,
    }));
  });

  it("negotiates initialize using the CoreBlow MCP identity", async () => {
    await expect(
      handleMcpJsonRpc({
        message: {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2024-11-05" },
        },
        tools: [],
        toolSchema: [],
      }),
    ).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "coreblow", version: "0.1.0" },
      },
    });
  });

  it("falls back to the preferred protocol version and exposes tool schema", async () => {
    const initialized = await handleMcpJsonRpc({
      message: {
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: { protocolVersion: "unsupported" },
      },
      tools: [],
      toolSchema: [],
    });
    const listed = await handleMcpJsonRpc({
      message: { jsonrpc: "2.0", id: 3, method: "tools/list" },
      tools: [],
      toolSchema: TOOL_SCHEMA,
    });

    expect(initialized).toMatchObject({ result: { protocolVersion: "2025-03-26" } });
    expect(listed).toEqual({ jsonrpc: "2.0", id: 3, result: { tools: TOOL_SCHEMA } });
  });

  it("ignores initialized and cancelled notifications", async () => {
    await expect(
      handleMcpJsonRpc({
        message: { jsonrpc: "2.0", method: "notifications/initialized" },
        tools: [],
        toolSchema: [],
      }),
    ).resolves.toBeNull();
    await expect(
      handleMcpJsonRpc({
        message: { jsonrpc: "2.0", method: "notifications/cancelled" },
        tools: [],
        toolSchema: [],
      }),
    ).resolves.toBeNull();
  });

  it("executes a discovered tool with hook-adjusted arguments", async () => {
    const execute = vi.fn(async () => "ok");
    runBeforeToolCallHookMock.mockResolvedValueOnce({
      blocked: false,
      reason: undefined,
      params: { adjusted: true },
    });

    const result = await handleMcpJsonRpc({
      message: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "demo", arguments: { raw: true } },
      },
      tools: [createTool(execute)],
      toolSchema: TOOL_SCHEMA,
      hookContext: { sessionKey: "agent:main:main" },
    });

    expect(runBeforeToolCallHookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "demo",
        params: { raw: true },
        ctx: { sessionKey: "agent:main:main" },
      }),
    );
    expect(execute).toHaveBeenCalledWith(expect.stringMatching(/^mcp-/), { adjusted: true }, undefined);
    expect(result).toEqual({
      jsonrpc: "2.0",
      id: 4,
      result: { content: [{ type: "text", text: "ok" }], isError: false },
    });
  });

  it("returns tool errors for unavailable, blocked, and throwing tools", async () => {
    const unavailable = await handleMcpJsonRpc({
      message: {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "missing" },
      },
      tools: [],
      toolSchema: [],
    });
    runBeforeToolCallHookMock.mockResolvedValueOnce({
      blocked: true,
      reason: "not allowed",
      params: undefined,
    });
    const blocked = await handleMcpJsonRpc({
      message: {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "demo" },
      },
      tools: [createTool()],
      toolSchema: TOOL_SCHEMA,
    });
    const throwing = await handleMcpJsonRpc({
      message: {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "demo" },
      },
      tools: [createTool(vi.fn(async () => Promise.reject(new Error("failed demo"))))],
      toolSchema: TOOL_SCHEMA,
    });

    expect(unavailable).toMatchObject({
      result: { content: [{ text: "Tool not available: missing" }], isError: true },
    });
    expect(blocked).toMatchObject({
      result: { content: [{ text: "not allowed" }], isError: true },
    });
    expect(throwing).toMatchObject({
      result: { content: [{ text: "failed demo" }], isError: true },
    });
  });

  it("returns JSON-RPC method-not-found errors for unsupported methods", async () => {
    await expect(
      handleMcpJsonRpc({
        message: { jsonrpc: "2.0", id: 8, method: "resources/list" },
        tools: [],
        toolSchema: [],
      }),
    ).resolves.toEqual({
      jsonrpc: "2.0",
      id: 8,
      error: { code: -32601, message: "Method not found: resources/list" },
    });
  });
});
