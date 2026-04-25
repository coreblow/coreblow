import type { AgentSideConnection } from "@agentclientprotocol/sdk";
import { vi , Mock } from "vitest";
import type { GatewayClient } from "../gateway/client.js";

export type TestAcpConnection = AgentSideConnection & {
  __sessionUpdateMock: Mock;
};

export function createAcpConnection(): TestAcpConnection {
  const sessionUpdate = vi.fn(async () => {});
  return {
    sessionUpdate,
    __sessionUpdateMock: sessionUpdate,
  } as unknown as TestAcpConnection;
}

export function createAcpGateway(
  request: GatewayClient["request"] = vi.fn(async () => ({ ok: true })) as GatewayClient["request"],
): GatewayClient {
  return {
    request,
  } as unknown as GatewayClient;
}
