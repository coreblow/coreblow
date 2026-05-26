type McpLoopbackRuntime = {
  port: number;
  ownerToken: string;
  nonOwnerToken: string;
};

let activeRuntime: McpLoopbackRuntime | undefined;

export function getActiveMcpLoopbackRuntime(): McpLoopbackRuntime | undefined {
  return activeRuntime ? { ...activeRuntime } : undefined;
}

export function setActiveMcpLoopbackRuntime(runtime: McpLoopbackRuntime): void {
  activeRuntime = { ...runtime };
}

export function resolveMcpLoopbackBearerToken(
  runtime: McpLoopbackRuntime,
  senderIsOwner: boolean,
): string {
  return senderIsOwner ? runtime.ownerToken : runtime.nonOwnerToken;
}

export function clearActiveMcpLoopbackRuntimeByOwnerToken(ownerToken: string): void {
  if (activeRuntime?.ownerToken === ownerToken) {
    activeRuntime = undefined;
  }
}

export function createMcpLoopbackServerConfig(port: number) {
  return {
    mcpServers: {
      coreblow: {
        type: "http",
        url: `http://127.0.0.1:${port}/mcp`,
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
  };
}
