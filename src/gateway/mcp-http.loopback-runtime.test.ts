import { describe, expect, it } from "vitest";
import {
  clearActiveMcpLoopbackRuntimeByOwnerToken,
  createMcpLoopbackServerConfig,
  getActiveMcpLoopbackRuntime,
  resolveMcpLoopbackBearerToken,
  setActiveMcpLoopbackRuntime,
} from "./mcp-http.loopback-runtime.js";

describe("MCP loopback runtime state", () => {
  it("stores active runtime by value and resolves owner/non-owner bearer tokens", () => {
    const runtime = { port: 3210, ownerToken: "owner", nonOwnerToken: "non-owner" };
    setActiveMcpLoopbackRuntime(runtime);
    runtime.ownerToken = "mutated";

    const active = getActiveMcpLoopbackRuntime();
    expect(active).toEqual({ port: 3210, ownerToken: "owner", nonOwnerToken: "non-owner" });
    expect(active).not.toBe(runtime);
    expect(resolveMcpLoopbackBearerToken(active!, true)).toBe("owner");
    expect(resolveMcpLoopbackBearerToken(active!, false)).toBe("non-owner");

    clearActiveMcpLoopbackRuntimeByOwnerToken("wrong");
    expect(getActiveMcpLoopbackRuntime()).toEqual(active);
    clearActiveMcpLoopbackRuntimeByOwnerToken("owner");
    expect(getActiveMcpLoopbackRuntime()).toBeUndefined();
  });

  it("creates CoreBlow-branded MCP loopback server config", () => {
    expect(createMcpLoopbackServerConfig(4567)).toEqual({
      mcpServers: {
        coreblow: {
          type: "http",
          url: "http://127.0.0.1:4567/mcp",
          headers: {
            Authorization: "Bearer ${COREBLOW_MCP_TOKEN}",
            "x-session-key": "${COREBLOW_MCP_SESSION_KEY}",
            "x-coreblow-agent-id": "${COREBLOW_MCP_AGENT_ID}",
            "x-coreblow-account-id": "${COREBLOW_MCP_ACCOUNT_ID}",
            "x-coreblow-message-channel": "${COREBLOW_MCP_MESSAGE_CHANNEL}",
            "x-coreblow-inbound-event-kind": "${COREBLOW_MCP_INBOUND_EVENT_KIND}",
          },
        },
      },
    });
  });
});
