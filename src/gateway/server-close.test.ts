import { afterEach, describe, expect, it, vi } from "vitest";
import { createGatewayCloseHandler } from "./server-close.js";

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../channels/plugins/index.js", () => ({
  listChannelPlugins: () => [],
}));

vi.mock("../hooks/gmail-watcher.js", () => ({
  stopGmailWatcher: vi.fn(async () => undefined),
}));

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: vi.fn(() => ({
    info: mocks.logInfo,
    warn: mocks.logWarn,
  })),
}));

type GatewayCloseHandlerParams = Parameters<typeof createGatewayCloseHandler>[0];
type GatewayCloseClient = GatewayCloseHandlerParams["clients"] extends Set<infer T> ? T : never;

const WEBSOCKET_CLOSE_GRACE_MS = 1_000;
const WEBSOCKET_CLOSE_FORCE_CONTINUE_MS = 250;
const HTTP_CLOSE_GRACE_MS = 1_000;
const HTTP_CLOSE_FORCE_WAIT_MS = 5_000;

describe("createGatewayCloseHandler", () => {
  afterEach(() => {
    mocks.logInfo.mockClear();
    mocks.logWarn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(mocks.logInfo).toHaveBeenCalledWith("shutdown started: test shutdown");
    expect(
      mocks.logInfo.mock.calls.some(([message]) =>
        String(message).startsWith("shutdown completed cleanly in "),
      ),
    ).toBe(true);
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
    expect(mocks.logWarn).toHaveBeenCalledWith("failed to close 1 WebSocket client(s)");
    expect(
      mocks.logWarn.mock.calls.some(([message]) =>
        String(message).includes("shutdown completed in") &&
        String(message).includes("ws-clients, http-server"),
      ),
    ).toBe(true);
  });

  it("terminates lingering websocket clients when websocket close exceeds the grace window", async () => {
    vi.useFakeTimers();

    let closeCallback: (() => void) | null = null;
    const terminate = vi.fn(() => {
      closeCallback?.();
    });
    const close = createGatewayCloseHandler(
      createCloseDeps({
        wss: {
          clients: new Set([{ terminate }]),
          close: (cb: () => void) => {
            closeCallback = cb;
          },
        } as never,
      }),
    );

    const closePromise = close({ reason: "test shutdown" });
    await vi.advanceTimersByTimeAsync(WEBSOCKET_CLOSE_GRACE_MS);
    const result = await closePromise;

    expect(result.warnings).toContain("websocket-server");
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(
      mocks.logWarn.mock.calls.some(([message]) =>
        String(message).includes("websocket server close exceeded 1000ms"),
      ),
    ).toBe(true);
  });

  it("continues shutdown when websocket close hangs without tracked clients", async () => {
    vi.useFakeTimers();

    const close = createGatewayCloseHandler(
      createCloseDeps({
        wss: {
          clients: new Set(),
          close: () => undefined,
        } as never,
      }),
    );

    const closePromise = close({ reason: "test shutdown" });
    await vi.advanceTimersByTimeAsync(WEBSOCKET_CLOSE_GRACE_MS + WEBSOCKET_CLOSE_FORCE_CONTINUE_MS);
    const result = await closePromise;

    expect(result.warnings).toContain("websocket-server");
    expect(
      mocks.logWarn.mock.calls.some(([message]) =>
        String(message).includes("websocket server close still pending after 250ms force window"),
      ),
    ).toBe(true);
  });

  it("forces lingering HTTP connections closed and records a timeout warning", async () => {
    vi.useFakeTimers();

    let closeCallback: ((err?: Error | null) => void) | null = null;
    const closeAllConnections = vi.fn(() => {
      closeCallback?.(null);
    });
    const close = createGatewayCloseHandler(
      createCloseDeps({
        httpServer: {
          close: (cb: (err?: Error | null) => void) => {
            closeCallback = cb;
          },
          closeAllConnections,
          closeIdleConnections: vi.fn(),
        } as never,
      }),
    );

    const closePromise = close({ reason: "test shutdown" });
    await vi.advanceTimersByTimeAsync(HTTP_CLOSE_GRACE_MS);
    const result = await closePromise;

    expect(result.warnings).toContain("http-server");
    expect(closeAllConnections).toHaveBeenCalledTimes(1);
    expect(
      mocks.logWarn.mock.calls.some(([message]) =>
        String(message).includes("http-server close exceeded 1000ms"),
      ),
    ).toBe(true);
  });

  it("fails shutdown when HTTP server close still hangs after force close", async () => {
    vi.useFakeTimers();

    const close = createGatewayCloseHandler(
      createCloseDeps({
        httpServer: {
          close: () => undefined,
          closeAllConnections: vi.fn(),
          closeIdleConnections: vi.fn(),
        } as never,
      }),
    );

    const closePromise = close({ reason: "test shutdown" });
    const closeExpectation = expect(closePromise).rejects.toThrow(
      "http-server close still pending after forced connection shutdown (5000ms)",
    );
    await vi.advanceTimersByTimeAsync(HTTP_CLOSE_GRACE_MS);
    await vi.advanceTimersByTimeAsync(HTTP_CLOSE_FORCE_WAIT_MS);
    await closeExpectation;
  });
});
