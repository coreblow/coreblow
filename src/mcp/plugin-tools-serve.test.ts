import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnyAgentTool } from "../agents/tools/common.js";
import {
  initializeGlobalHookRunner,
  resetGlobalHookRunner,
} from "../plugins/hook-runner-global.js";
import { createMockPluginRegistry } from "../plugins/hooks.test-helpers.js";
import { createPluginToolsMcpHandlers } from "./plugin-tools-handlers.js";

const callGatewayTool = vi.hoisted(() => vi.fn());
const connectToolsMcpServerToStdioMock = vi.hoisted(() => vi.fn());
const createToolsMcpServerMock = vi.hoisted(() => vi.fn(() => ({ close: vi.fn() })));
const loadConfigMock = vi.hoisted(() => vi.fn(() => ({ plugins: { enabled: true } })));
const resolvePluginToolsMock = vi.hoisted(() => vi.fn<() => AnyAgentTool[]>(() => []));
const routeLogsToStderrMock = vi.hoisted(() => vi.fn());

vi.mock("../agents/tools/gateway.js", () => ({
  callGatewayTool,
}));

vi.mock("../config/config.js", () => ({
  loadConfig: loadConfigMock,
}));

vi.mock("../logging/console.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../logging/console.js")>();
  return {
    ...actual,
    routeLogsToStderr: routeLogsToStderrMock,
  };
});

vi.mock("../plugins/tools.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../plugins/tools.js")>();
  return {
    ...actual,
    resolvePluginTools: resolvePluginToolsMock,
  };
});

vi.mock("./tools-stdio-server.js", () => ({
  connectToolsMcpServerToStdio: connectToolsMcpServerToStdioMock,
  createToolsMcpServer: createToolsMcpServerMock,
}));

afterEach(() => {
  vi.restoreAllMocks();
  callGatewayTool.mockReset();
  connectToolsMcpServerToStdioMock.mockReset();
  createToolsMcpServerMock.mockClear();
  loadConfigMock.mockClear();
  resolvePluginToolsMock.mockReset();
  resolvePluginToolsMock.mockReturnValue([]);
  routeLogsToStderrMock.mockReset();
  resetGlobalHookRunner();
});

function requireFirstMockCall(calls: readonly unknown[][], label: string): unknown[] {
  const call = calls.at(0);
  if (!call) {
    throw new Error(`expected ${label} call`);
  }
  return call;
}

function requireToolPolicyParams(mock: ReturnType<typeof vi.fn>) {
  const params = requireFirstMockCall(mock.mock.calls, "plugin tool policy")[0] as
    | { toolAllowlist?: string[]; toolDenylist?: string[] }
    | undefined;
  if (!params) {
    throw new Error("expected plugin tool policy params");
  }
  return params;
}

describe("plugin tools MCP server", () => {
  it("routes logs to stderr before resolving tools for stdio", async () => {
    const { servePluginToolsMcp } = await import("./plugin-tools-serve.js");
    resolvePluginToolsMock.mockReturnValue([
      {
        name: "memory_recall",
        label: "Recall memory",
        description: "Recall stored memory",
        parameters: { type: "object", properties: {} },
        execute: vi.fn(),
      },
    ]);

    await servePluginToolsMcp();

    expect(routeLogsToStderrMock).toHaveBeenCalledTimes(1);
    expect(resolvePluginToolsMock).toHaveBeenCalledTimes(1);
    expect(connectToolsMcpServerToStdioMock).toHaveBeenCalledOnce();
  });

  it("threads global plugin tool policy into plugin resolution", async () => {
    loadConfigMock.mockReturnValueOnce({
      plugins: { enabled: true },
      tools: {
        alsoAllow: ["memory_search"],
        deny: ["memory_forget"],
      },
    } as never);
    const { servePluginToolsMcp } = await import("./plugin-tools-serve.js");

    await servePluginToolsMcp();

    const resolvePolicy = requireToolPolicyParams(resolvePluginToolsMock);
    expect(resolvePolicy.toolAllowlist).toContain("memory_search");
    expect(resolvePolicy.toolDenylist).toEqual(["memory_forget"]);
  });

  it("lists registered plugin tools and serializes non-array tool content", async () => {
    const execute = vi.fn().mockResolvedValue({
      content: "Stored.",
    });
    const tool = {
      name: "memory_recall",
      description: "Recall stored memory",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
      execute,
    } as unknown as AnyAgentTool;

    const handlers = createPluginToolsMcpHandlers([tool]);
    const listed = await handlers.listTools();
    expect(listed.tools).toHaveLength(1);
    expect(listed.tools[0]?.name).toBe("memory_recall");
    expect(listed.tools[0]?.description).toBe("Recall stored memory");
    const inputSchema = listed.tools[0]?.inputSchema as
      | { type?: unknown; required?: unknown }
      | undefined;
    expect(inputSchema?.type).toBe("object");
    expect(inputSchema?.required).toEqual(["query"]);

    const result = await handlers.callTool({
      name: "memory_recall",
      arguments: { query: "remember this" },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    const executeCall = requireFirstMockCall(execute.mock.calls, "plugin tool execute");
    const requestId = executeCall[0];
    expect(typeof requestId).toBe("string");
    expect((requestId as string).startsWith("mcp-")).toBe(true);
    expect(executeCall[1]).toEqual({ query: "remember this" });
    expect(executeCall[2]).toBeUndefined();
    expect(result.content).toEqual([{ type: "text", text: "Stored." }]);
  });

  it("returns MCP errors for unknown tools and thrown tool errors", async () => {
    const failingTool = {
      name: "memory_forget",
      description: "Forget memory",
      parameters: { type: "object", properties: {} },
      execute: vi.fn().mockRejectedValue(new Error("boom")),
    } as unknown as AnyAgentTool;

    const handlers = createPluginToolsMcpHandlers([failingTool]);
    const unknown = await handlers.callTool({
      name: "missing_tool",
      arguments: {},
    });
    expect(unknown.isError).toBe(true);
    expect(unknown.content).toEqual([{ type: "text", text: "Unknown tool: missing_tool" }]);

    const failed = await handlers.callTool({
      name: "memory_forget",
      arguments: {},
    });
    expect(failed.isError).toBe(true);
    expect(failed.content).toEqual([{ type: "text", text: "Tool error: boom" }]);
  });

  it("blocks tool execution when before_tool_call requires approval on the MCP bridge", async () => {
    let hookCalls = 0;
    const execute = vi.fn().mockResolvedValue({
      content: "Stored.",
    });
    initializeGlobalHookRunner(
      createMockPluginRegistry([
        {
          hookName: "before_tool_call",
          handler: async () => {
            hookCalls += 1;
            return {
              requireApproval: {
                pluginId: "test-plugin",
                title: "Approval required",
                description: "Approval required",
              },
            };
          },
        },
      ]),
    );
    callGatewayTool.mockRejectedValueOnce(new Error("gateway unavailable"));
    const tool = {
      name: "memory_store",
      description: "Store memory",
      parameters: { type: "object", properties: {} },
      execute,
    } as unknown as AnyAgentTool;

    const handlers = createPluginToolsMcpHandlers([tool]);
    const result = await handlers.callTool({
      name: "memory_store",
      arguments: { text: "remember this" },
    });
    expect(hookCalls).toBe(1);
    expect(execute).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: "Tool error: Plugin approval required (gateway unavailable)" },
    ]);
  });
});
