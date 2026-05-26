import { describe, expect, it, vi } from "vitest";
import { createGatewayCloseHandler } from "./server-close.js";

vi.mock("../channels/plugins/index.js", () => ({
  listChannelPlugins: () => [],
}));

vi.mock("../hooks/gmail-watcher.js", () => ({
  stopGmailWatcher: vi.fn(async () => undefined),
}));

type GatewayCloseHandlerParams = Parameters<typeof createGatewayCloseHandler>[0];
type GatewayCloseClient = GatewayCloseHandlerParams["clients"] extends Set<infer T> ? T : never;

describe("createGatewayCloseHandler", () => {
  function createCloseDeps(
    overrides: Partial<GatewayCloseHandlerParams> = {},
  ): GatewayCloseHandlerParams {
    return {
      bonjourStop: null,
      tailscaleCleanup: null,
      canvasHost: null,
      canvasHostServer: null,
      stopChannel: vi.fn(async () => undefined),
      pluginServices: null,
      cron: { stop: vi.fn() },
      heartbeatRunner: { stop: vi.fn() } as never,
      updateCheckStop: null,
      nodePresenceTimers: new Map(),
      broadcast: vi.fn(),
      tickInterval: setInterval(() => undefined, 60_000),
      healthInterval: setInterval(() => undefined, 60_000),
      dedupeCleanup: setInterval(() => undefined, 60_000),
      mediaCleanup: null,
      agentUnsub: null,
      heartbeatUnsub: null,
      transcriptUnsub: null,
      lifecycleUnsub: null,
      chatRunState: { clear: vi.fn() },
      clients: new Set<GatewayCloseClient>(),
      configReloader: { stop: vi.fn(async () => undefined) },
      wss: { close: (cb: () => void) => cb() } as never,
      httpServer: {
        close: (cb: (err?: Error | null) => void) => cb(null),
        closeIdleConnections: vi.fn(),
      } as never,
      ...overrides,
    };
  }

  it("unsubscribes lifecycle listeners during shutdown", async () => {
    const lifecycleUnsub = vi.fn();
    const close = createGatewayCloseHandler(
      createCloseDeps({
        lifecycleUnsub,
      }),
    );

    await close({ reason: "test shutdown" });

    expect(lifecycleUnsub).toHaveBeenCalledTimes(1);
  });

  it("returns a clean shutdown result", async () => {
    const chatRunState = { clear: vi.fn() };
    const close = createGatewayCloseHandler(createCloseDeps({ chatRunState }));

    const result = await close({ reason: "test shutdown" });

    expect(result.warnings).toEqual([]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(chatRunState.clear).toHaveBeenCalledTimes(1);
  });

  it("treats already-closed HTTP servers as clean shutdown", async () => {
    const close = createGatewayCloseHandler(
      createCloseDeps({
        httpServer: {
          close: (cb: (err?: NodeJS.ErrnoException | null) => void) =>
            cb(
              Object.assign(new Error("Server is not running."), {
                code: "ERR_SERVER_NOT_RUNNING",
              }),
            ),
          closeIdleConnections: vi.fn(),
        } as never,
      }),
    );

    const result = await close({ reason: "test shutdown" });

    expect(result.warnings).toEqual([]);
  });

  it("records client and HTTP close warnings without aborting shutdown", async () => {
    const clients = new Set([
      {
        socket: {
          close: vi.fn(() => {
            throw new Error("socket closed");
          }),
        },
      },
    ]);
    const close = createGatewayCloseHandler(
      createCloseDeps({
        clients,
        httpServer: {
          close: (cb: (err?: Error | null) => void) => cb(new Error("close failed")),
          closeIdleConnections: vi.fn(),
        } as never,
      }),
    );

    const result = await close({ reason: "test shutdown" });

    expect(result.warnings).toEqual(["ws-clients", "http-server"]);
    expect(clients.size).toBe(0);
  });
});
