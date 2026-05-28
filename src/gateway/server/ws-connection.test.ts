import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocketServer } from "ws";
import type { ResolvedGatewayAuth } from "../auth.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../protocol/client-info.js";

const { attachGatewayWsMessageHandlerMock, broadcastPresenceSnapshotMock, upsertPresenceMock } =
  vi.hoisted(() => ({
    attachGatewayWsMessageHandlerMock: vi.fn(),
    broadcastPresenceSnapshotMock: vi.fn(),
    upsertPresenceMock: vi.fn(),
  }));

vi.mock("./ws-connection/message-handler.js", () => ({
  attachGatewayWsMessageHandler: attachGatewayWsMessageHandlerMock,
}));

vi.mock("../../infra/system-presence.js", () => ({
  upsertPresence: upsertPresenceMock,
}));

vi.mock("./presence-events.js", () => ({
  broadcastPresenceSnapshot: broadcastPresenceSnapshotMock,
}));

import { attachGatewayWsConnectionHandler } from "./ws-connection.js";

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createResolvedAuth(token: string): ResolvedGatewayAuth {
  return {
    mode: "token",
    allowTailscale: false,
    token,
  };
}

function firstAttachedHandlerParams(): unknown {
  return attachGatewayWsMessageHandlerMock.mock.calls[0]?.[0];
}

async function waitForLazyMessageHandler() {
  await vi.dynamicImportSettled();
}

type TestSocket = EventEmitter & {
  _socket: {
    remoteAddress: string;
    remotePort: number;
    localAddress: string;
    localPort: number;
  };
  send: ReturnType<typeof vi.fn>;
  ping?: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

function createTestSocket(params: { ping?: boolean } = {}): TestSocket {
  return Object.assign(new EventEmitter(), {
    _socket: {
      remoteAddress: "127.0.0.1",
      remotePort: 1234,
      localAddress: "127.0.0.1",
      localPort: 5678,
    },
    send: vi.fn(),
    ...(params.ping ? { ping: vi.fn() } : {}),
    close: vi.fn(),
  });
}

async function connectTestWs(params?: { socket?: TestSocket; clients?: Set<unknown> }) {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const wss = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, handler);
    }),
  } as unknown as WebSocketServer;
  const socket = params?.socket ?? createTestSocket();
  const clients = params?.clients ?? new Set<unknown>();
  const unsubscribeAllSessionEvents = vi.fn();
  const nodeUnsubscribeAll = vi.fn();
  const nodeRegistry = { unregister: vi.fn(() => null) };

  attachGatewayWsConnectionHandler({
    wss,
    clients: clients as never,
    preauthConnectionBudget: { release: vi.fn() } as never,
    port: 19001,
    canvasHostEnabled: false,
    resolvedAuth: createResolvedAuth("token"),
    gatewayMethods: [],
    events: [],
    refreshHealthSnapshot: vi.fn(async () => ({}) as never),
    logGateway: createLogger() as never,
    logHealth: createLogger() as never,
    logWsControl: createLogger() as never,
    extraHandlers: {},
    broadcast: vi.fn(),
    buildRequestContext: () =>
      ({
        unsubscribeAllSessionEvents,
        nodeRegistry,
        nodeUnsubscribeAll,
      }) as never,
  });

  const onConnection = listeners.get("connection");
  expect(onConnection).toBeTypeOf("function");
  onConnection?.(socket, {
    headers: { host: "127.0.0.1:19001" },
    socket: { localAddress: "127.0.0.1" },
  });
  await waitForLazyMessageHandler();

  return {
    clients,
    socket,
    passed: firstAttachedHandlerParams(),
    nodeRegistry,
    nodeUnsubscribeAll,
    unsubscribeAllSessionEvents,
  };
}

describe("attachGatewayWsConnectionHandler", () => {
  beforeEach(() => {
    attachGatewayWsMessageHandlerMock.mockReset();
    broadcastPresenceSnapshotMock.mockReset();
    upsertPresenceMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects late client registration after a pre-connect socket close", async () => {
    const clients = new Set();
    const { passed, socket } = await connectTestWs({ clients });
    const handlerParams = passed as {
      setClient: (client: unknown) => boolean;
    };
    socket.emit("close", 1001, Buffer.from("client left"));

    const registered = handlerParams.setClient({
      socket,
      connect: {
        client: { id: GATEWAY_CLIENT_NAMES.CONTROL_UI, mode: GATEWAY_CLIENT_MODES.WEBCHAT },
      },
      connId: "late-client",
    });

    expect(registered).toBe(false);
    expect(clients.size).toBe(0);
  });

  it("sends protocol pings until the connection closes", async () => {
    vi.useFakeTimers();
    const socket = createTestSocket({ ping: true });
    const { passed } = await connectTestWs({ socket });
    const handlerParams = passed as {
      setClient: (client: unknown) => boolean;
    };

    expect(
      handlerParams.setClient({
        socket,
        connect: {
          client: { id: GATEWAY_CLIENT_NAMES.CONTROL_UI, mode: GATEWAY_CLIENT_MODES.WEBCHAT },
        },
        connId: "ping-client",
      }),
    ).toBe(true);

    vi.advanceTimersByTime(25_000);
    expect(socket.ping).toHaveBeenCalledTimes(1);

    socket.emit("close", 1000, Buffer.from("done"));
    vi.advanceTimersByTime(25_000);
    expect(socket.ping).toHaveBeenCalledTimes(1);
  });

  it("skips node presence disconnects for stale reconnected sockets", async () => {
    const { passed, socket, nodeRegistry, nodeUnsubscribeAll, unsubscribeAllSessionEvents } =
      await connectTestWs();
    const handlerParams = passed as {
      setClient: (client: unknown) => boolean;
    };
    expect(
      handlerParams.setClient({
        socket,
        connect: {
          role: "node",
          client: { id: GATEWAY_CLIENT_NAMES.MACOS_APP, mode: GATEWAY_CLIENT_MODES.NODE },
          device: { id: "node-1" },
        },
        connId: "conn-old",
        presenceKey: "node-1",
      }),
    ).toBe(true);

    socket.emit("close", 1000, Buffer.from("stale"));

    expect(nodeRegistry.unregister).toHaveBeenCalledTimes(1);
    expect(nodeUnsubscribeAll).not.toHaveBeenCalled();
    expect(unsubscribeAllSessionEvents).toHaveBeenCalledTimes(1);
    expect(upsertPresenceMock).not.toHaveBeenCalled();
    expect(broadcastPresenceSnapshotMock).not.toHaveBeenCalled();
  });
});
