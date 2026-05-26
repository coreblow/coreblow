import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import type { McpLoopbackTool } from "./mcp-http.schema.js";
import {
  MCP_LOOPBACK_NATIVE_TOOL_EXCLUDE,
  MCP_LOOPBACK_TOOL_CACHE_TTL_MS,
  McpLoopbackToolCache,
} from "./mcp-http.runtime.js";

const resolveGatewayScopedToolsMock = vi.hoisted(() => vi.fn());

vi.mock("./tools-invoke-shared.js", () => ({
  resolveGatewayScopedTools: resolveGatewayScopedToolsMock,
}));

function createTool(name: string): McpLoopbackTool {
  return {
    name,
    label: name,
    description: `${name} tool`,
    parameters: { type: "object", properties: {} },
    execute: vi.fn(),
  } as unknown as McpLoopbackTool;
}

function mockScopedTools(names: string[], agentId = "main") {
  resolveGatewayScopedToolsMock.mockReturnValueOnce({
    agentId,
    sessionKey: "agent:main:main",
    tools: names.map((name) => createTool(name)),
  });
}

describe("MCP loopback tool cache", () => {
  beforeEach(() => {
    resolveGatewayScopedToolsMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves loopback-scoped tools with native tool excludes and schema", () => {
    const cfg: CoreBlowConfig = {};
    mockScopedTools(["agents_list"]);

    const resolved = new McpLoopbackToolCache().resolve({
      cfg,
      sessionKey: "agent:main:main",
      messageProvider: "telegram",
      accountId: "acct-1",
      inboundEventKind: "user_request",
      senderIsOwner: true,
    });

    expect(resolveGatewayScopedToolsMock).toHaveBeenCalledWith({
      cfg,
      sessionKey: "agent:main:main",
      messageChannel: "telegram",
      accountId: "acct-1",
      senderIsOwner: true,
      surface: "loopback",
      excludeToolNames: MCP_LOOPBACK_NATIVE_TOOL_EXCLUDE,
    });
    expect(resolved.agentId).toBe("main");
    expect(resolved.tools.map((tool) => tool.name)).toEqual(["agents_list"]);
    expect(resolved.toolSchema).toEqual([
      {
        name: "agents_list",
        description: "agents_list tool",
        inputSchema: { type: "object", properties: {} },
      },
    ]);
  });

  it("reuses cached entries for the same context and config reference within ttl", () => {
    const cfg: CoreBlowConfig = {};
    const cache = new McpLoopbackToolCache();
    mockScopedTools(["agents_list"]);

    const first = cache.resolve({
      cfg,
      sessionKey: "agent:main:main",
      messageProvider: undefined,
      accountId: undefined,
      senderIsOwner: false,
    });
    vi.advanceTimersByTime(MCP_LOOPBACK_TOOL_CACHE_TTL_MS - 1);
    const second = cache.resolve({
      cfg,
      sessionKey: "agent:main:main",
      messageProvider: undefined,
      accountId: undefined,
      senderIsOwner: false,
    });

    expect(second).toBe(first);
    expect(resolveGatewayScopedToolsMock).toHaveBeenCalledTimes(1);
  });

  it("invalidates cache entries when ttl expires or config reference changes", () => {
    const cache = new McpLoopbackToolCache();
    const cfgA: CoreBlowConfig = {};
    const cfgB: CoreBlowConfig = {};
    mockScopedTools(["first"]);
    mockScopedTools(["second"]);
    mockScopedTools(["third"]);

    const first = cache.resolve({
      cfg: cfgA,
      sessionKey: "agent:main:main",
      messageProvider: undefined,
      accountId: undefined,
      senderIsOwner: false,
    });
    const second = cache.resolve({
      cfg: cfgB,
      sessionKey: "agent:main:main",
      messageProvider: undefined,
      accountId: undefined,
      senderIsOwner: false,
    });
    vi.advanceTimersByTime(MCP_LOOPBACK_TOOL_CACHE_TTL_MS);
    const third = cache.resolve({
      cfg: cfgB,
      sessionKey: "agent:main:main",
      messageProvider: undefined,
      accountId: undefined,
      senderIsOwner: false,
    });

    expect(first.tools.map((tool) => tool.name)).toEqual(["first"]);
    expect(second.tools.map((tool) => tool.name)).toEqual(["second"]);
    expect(third.tools.map((tool) => tool.name)).toEqual(["third"]);
    expect(resolveGatewayScopedToolsMock).toHaveBeenCalledTimes(3);
  });

  it("keys cache entries by message context and owner status", () => {
    const cfg: CoreBlowConfig = {};
    const cache = new McpLoopbackToolCache();
    mockScopedTools(["telegram-owner"]);
    mockScopedTools(["telegram-non-owner"]);
    mockScopedTools(["slack-owner"]);

    const owner = cache.resolve({
      cfg,
      sessionKey: "agent:main:main",
      messageProvider: "telegram",
      accountId: "acct",
      inboundEventKind: "user_request",
      senderIsOwner: true,
    });
    const nonOwner = cache.resolve({
      cfg,
      sessionKey: "agent:main:main",
      messageProvider: "telegram",
      accountId: "acct",
      inboundEventKind: "user_request",
      senderIsOwner: false,
    });
    const otherProvider = cache.resolve({
      cfg,
      sessionKey: "agent:main:main",
      messageProvider: "slack",
      accountId: "acct",
      inboundEventKind: "user_request",
      senderIsOwner: true,
    });

    expect(owner.tools.map((tool) => tool.name)).toEqual(["telegram-owner"]);
    expect(nonOwner.tools.map((tool) => tool.name)).toEqual(["telegram-non-owner"]);
    expect(otherProvider.tools.map((tool) => tool.name)).toEqual(["slack-owner"]);
    expect(resolveGatewayScopedToolsMock).toHaveBeenCalledTimes(3);
  });
});
