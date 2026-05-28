import type { IncomingMessage } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import type { HealthSummary } from "../../../commands/health.js";
import type { ResolvedGatewayAuth } from "../../auth.js";
import { getOperatorApprovalRuntimeToken } from "../../operator-approval-runtime-token.js";
import { PROTOCOL_VERSION } from "../../protocol/index.js";
import type { GatewayRequestContext } from "../../server-methods/types.js";

const {
  buildGatewaySnapshotMock,
  getHealthCacheMock,
  getHealthVersionMock,
  incrementPresenceVersionMock,
  loadConfigMock,
  upsertPresenceMock,
} = vi.hoisted(() => ({
  buildGatewaySnapshotMock: vi.fn(() => ({
    presence: [],
    health: {},
    stateVersion: { presence: 1, health: 1 },
    uptimeMs: 1,
    sessionDefaults: {
      defaultAgentId: "main",
      mainKey: "main",
      mainSessionKey: "main",
      scope: "per-sender",
    },
  })),
  getHealthCacheMock: vi.fn(() => null),
  getHealthVersionMock: vi.fn(() => 1),
  incrementPresenceVersionMock: vi.fn(() => 2),
  loadConfigMock: vi.fn(() => ({
    gateway: {
      auth: { mode: "none" },
      controlUi: {
        allowedOrigins: ["http://127.0.0.1:19001"],
        dangerouslyDisableDeviceAuth: true,
      },
    },
  })),
  upsertPresenceMock: vi.fn(),
}));

vi.mock("../../../config/config.js", () => ({
  loadConfig: loadConfigMock,
}));

vi.mock("../../../infra/system-presence.js", () => ({
  upsertPresence: upsertPresenceMock,
}));

vi.mock("../../server-methods.js", () => ({
  handleGatewayRequest: vi.fn(),
}));

vi.mock("../health-state.js", () => ({
  buildGatewaySnapshot: buildGatewaySnapshotMock,
  getHealthCache: getHealthCacheMock,
  getHealthVersion: getHealthVersionMock,
  incrementPresenceVersion: incrementPresenceVersionMock,
  refreshGatewayHealthSnapshot: vi.fn(),
}));

import { attachGatewayWsMessageHandler } from "./message-handler.js";

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createHealthSummary(): HealthSummary {
  return {
    ok: true,
    ts: 1,
    durationMs: 1,
    channels: {},
    channelOrder: [],
    channelLabels: {},
    heartbeatSeconds: 0,
    defaultAgentId: "main",
    agents: [],
    sessions: {
      path: "",
      count: 0,
      recent: [],
    },
  };
}

function createConnectHarness(params?: {
  refreshHealthSnapshot?: GatewayRequestContext["refreshHealthSnapshot"];
}) {
  const socketSend = vi.fn((_payload: string, cb?: (err?: Error) => void) => {
    cb?.();
  });
  let onMessage: ((data: string) => void) | undefined;
  const socket = {
    _receiver: {},
    send: socketSend,
    on: vi.fn((event: string, handler: (data: string) => void) => {
      if (event === "message") {
        onMessage = handler;
      }
      return socket;
    }),
  } as unknown as WebSocket;
  const send = vi.fn();
  let client: unknown = null;
  const resolvedAuth: ResolvedGatewayAuth = {
    mode: "none",
    allowTailscale: false,
  };

  attachGatewayWsMessageHandler({
    socket,
    upgradeReq: {
      headers: { host: "127.0.0.1:19001", origin: "http://127.0.0.1:19001" },
      socket: { localAddress: "127.0.0.1", remoteAddress: "127.0.0.1" },
    } as unknown as IncomingMessage,
    connId: "conn-1",
    remoteAddr: "127.0.0.1",
    requestHost: "127.0.0.1:19001",
    requestOrigin: "http://127.0.0.1:19001",
    connectNonce: "nonce-1",
    resolvedAuth,
    gatewayMethods: [],
    events: [],
    extraHandlers: {},
    buildRequestContext: () => ({}) as GatewayRequestContext,
    ...(params?.refreshHealthSnapshot ? { refreshHealthSnapshot: params.refreshHealthSnapshot } : {}),
    send,
    close: vi.fn(),
    isClosed: vi.fn(() => false),
    clearHandshakeTimer: vi.fn(),
    getClient: () => client as never,
    setClient: (next) => {
      client = next;
    },
    setHandshakeState: vi.fn(),
    setCloseCause: vi.fn(),
    setLastFrameMeta: vi.fn(),
    originCheckMetrics: { hostHeaderFallbackAccepted: 0 },
    logGateway: createLogger() as never,
    logHealth: createLogger() as never,
    logWsControl: createLogger() as never,
  });

  if (onMessage === undefined) {
    throw new Error("expected websocket message handler");
  }
  return { onMessage, socketSend, send, getClient: () => client };
}

function sendConnect(
  onMessage: (data: string) => void,
  params?: {
    id?: string;
    auth?: Record<string, string>;
  },
) {
  onMessage(
    JSON.stringify({
      type: "req",
      id: params?.id ?? "connect-1",
      method: "connect",
      params: {
        minProtocol: PROTOCOL_VERSION,
        maxProtocol: PROTOCOL_VERSION,
        client: {
          id: "gateway-client",
          version: "dev",
          platform: "test",
          mode: "backend",
        },
        role: "operator",
        scopes: ["operator.approvals"],
        caps: [],
        ...(params?.auth ? { auth: params.auth } : {}),
      },
    }),
  );
}

describe("attachGatewayWsMessageHandler post-connect health refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the injected runtime-aware health refresh after hello", async () => {
    let resolveRefresh: (() => void) | undefined;
    const refreshHealthSnapshot = vi.fn<GatewayRequestContext["refreshHealthSnapshot"]>(
      () =>
        new Promise((resolve) => {
          resolveRefresh = () => resolve(createHealthSummary());
        }),
    );
    const { onMessage, send } = createConnectHarness({ refreshHealthSnapshot });

    sendConnect(onMessage);

    await vi.waitFor(() => {
      expect(send).toHaveBeenCalled();
    });
    const hello = send.mock.calls.at(0)?.[0] as { ok?: boolean } | undefined;
    expect(hello?.ok).toBe(true);
    await vi.waitFor(() => {
      expect(refreshHealthSnapshot).toHaveBeenCalledWith({ probe: true });
    });
    resolveRefresh?.();
  });

  it("does not mark local backend self-pairing clients as approval runtimes", async () => {
    const refreshHealthSnapshot = vi.fn<GatewayRequestContext["refreshHealthSnapshot"]>(async () =>
      createHealthSummary(),
    );
    const { onMessage, send, getClient } = createConnectHarness({ refreshHealthSnapshot });

    sendConnect(onMessage, { id: "connect-approval-runtime-spoof" });

    await vi.waitFor(() => {
      expect(send).toHaveBeenCalled();
    });
    const connectedClient = getClient() as {
      connect?: { scopes?: string[] };
      internal?: { approvalRuntime?: boolean };
    } | null;
    expect(connectedClient?.connect?.scopes).toEqual(["operator.approvals"]);
    expect(connectedClient?.internal?.approvalRuntime).not.toBe(true);
  });

  it("marks operator approval clients with the server runtime token", async () => {
    const refreshHealthSnapshot = vi.fn<GatewayRequestContext["refreshHealthSnapshot"]>(async () =>
      createHealthSummary(),
    );
    const { onMessage, send, getClient } = createConnectHarness({ refreshHealthSnapshot });

    sendConnect(onMessage, {
      id: "connect-approval-runtime-token",
      auth: {
        approvalRuntimeToken: getOperatorApprovalRuntimeToken(),
      },
    });

    await vi.waitFor(() => {
      expect(send).toHaveBeenCalled();
    });
    const connectedClient = getClient() as {
      internal?: { approvalRuntime?: boolean };
    } | null;
    expect(connectedClient?.internal?.approvalRuntime).toBe(true);
  });
});
