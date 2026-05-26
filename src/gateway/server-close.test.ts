import { afterEach, describe, expect, it, vi } from "vitest";
import type { InternalHookEvent } from "../hooks/internal-hooks.js";
import { createGatewayCloseHandler } from "./server-close.js";

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  triggerInternalHook: vi.fn<(event: unknown) => Promise<void>>(async (_event) => undefined),
  listChannelPlugins: vi.fn(() => [] as Array<{ id: "telegram" | "discord" }>),
  stopGmailWatcher: vi.fn(async () => undefined),
}));

vi.mock("../channels/plugins/index.js", () => ({
  listChannelPlugins: mocks.listChannelPlugins,
}));

vi.mock("../hooks/gmail-watcher.js", () => ({
  stopGmailWatcher: mocks.stopGmailWatcher,
}));

vi.mock("../hooks/internal-hooks.js", async () => {
  const actual = await vi.importActual<typeof import("../hooks/internal-hooks.js")>(
    "../hooks/internal-hooks.js",
  );
  return {
    ...actual,
    triggerInternalHook: mocks.triggerInternalHook,
  };
});

vi.mock("../logging/subsystem.js", () => ({
  createSubsystemLogger: vi.fn(() => ({
    info: mocks.logInfo,
    warn: mocks.logWarn,
  })),
}));

type GatewayCloseHandlerParams = Parameters<typeof createGatewayCloseHandler>[0];
type DrainActiveSessionsForShutdown = NonNullable<
  GatewayCloseHandlerParams["drainActiveSessionsForShutdown"]
>;
type GatewayCloseClient = GatewayCloseHandlerParams["clients"] extends Set<infer T> ? T : never;

const WEBSOCKET_CLOSE_GRACE_MS = 1_000;
const WEBSOCKET_CLOSE_FORCE_CONTINUE_MS = 250;
const HTTP_CLOSE_GRACE_MS = 1_000;
const HTTP_CLOSE_FORCE_WAIT_MS = 5_000;
const GATEWAY_SHUTDOWN_HOOK_TIMEOUT_MS = 5_000;
const GATEWAY_PRE_RESTART_HOOK_TIMEOUT_MS = 10_000;

describe("createGatewayCloseHandler", () => {
  afterEach(() => {
    mocks.logInfo.mockClear();
    mocks.logWarn.mockClear();
    mocks.triggerInternalHook.mockReset();
    mocks.triggerInternalHook.mockResolvedValue(undefined);
    mocks.listChannelPlugins.mockReset();
    mocks.listChannelPlugins.mockReturnValue([]);
    mocks.stopGmailWatcher.mockReset();
    mocks.stopGmailWatcher.mockResolvedValue(undefined);
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

  it("emits gateway shutdown and pre-restart hooks", async () => {
    const close = createGatewayCloseHandler(createCloseDeps());

    await close({ reason: "gateway restarting", restartExpectedMs: 123 });

    const hookCalls = mocks.triggerInternalHook.mock.calls as unknown as Array<
      [{ type?: string; action?: string; context?: Record<string, unknown> }]
    >;
    const shutdownEvent = hookCalls.find(
      ([event]) => event?.type === "gateway" && event?.action === "shutdown",
    )?.[0];
    const preRestartEvent = hookCalls.find(
      ([event]) => event?.type === "gateway" && event?.action === "pre-restart",
    )?.[0];

    expect(shutdownEvent?.context?.reason).toBe("gateway restarting");
    expect(shutdownEvent?.context?.restartExpectedMs).toBe(123);
    expect(preRestartEvent?.context?.reason).toBe("gateway restarting");
    expect(preRestartEvent?.context?.restartExpectedMs).toBe(123);
  });

  it("emits only the shutdown hook for non-restart close", async () => {
    const close = createGatewayCloseHandler(createCloseDeps());

    await close({ reason: "test shutdown" });

    const hookCalls = mocks.triggerInternalHook.mock.calls as unknown as Array<
      [{ type?: string; action?: string }]
    >;
    expect(hookCalls.map(([event]) => event?.action)).toEqual(["shutdown"]);
  });

  it("continues shutdown and records a warning when gateway shutdown hook stalls", async () => {
    vi.useFakeTimers();
    mocks.triggerInternalHook.mockImplementation((event: unknown) => {
      if ((event as InternalHookEvent).action === "shutdown") {
        return new Promise<void>(() => undefined);
      }
      return Promise.resolve(undefined);
    });
    const chatRunState = { clear: vi.fn() };
    const close = createGatewayCloseHandler(createCloseDeps({ chatRunState }));

    const closePromise = close({ reason: "test shutdown" });
    await vi.advanceTimersByTimeAsync(GATEWAY_SHUTDOWN_HOOK_TIMEOUT_MS);
    const result = await closePromise;

    expect(result.warnings).toContain("gateway:shutdown");
    expect(chatRunState.clear).toHaveBeenCalledTimes(1);
    expect(
      mocks.logWarn.mock.calls.some(([message]) =>
        String(message).includes("gateway:shutdown hook timed out after 5000ms"),
      ),
    ).toBe(true);
  });

  it("continues restart shutdown and records a warning when gateway pre-restart hook stalls", async () => {
    vi.useFakeTimers();
    mocks.triggerInternalHook.mockImplementation((event: unknown) => {
      if ((event as InternalHookEvent).action === "pre-restart") {
        return new Promise<void>(() => undefined);
      }
      return Promise.resolve(undefined);
    });
    const chatRunState = { clear: vi.fn() };
    const close = createGatewayCloseHandler(createCloseDeps({ chatRunState }));

    const closePromise = close({ reason: "test restart", restartExpectedMs: 123 });
    await vi.advanceTimersByTimeAsync(GATEWAY_PRE_RESTART_HOOK_TIMEOUT_MS);
    const result = await closePromise;

    expect(result.warnings).toContain("gateway:pre-restart");
    expect(mocks.triggerInternalHook).toHaveBeenCalledTimes(2);
    expect(chatRunState.clear).toHaveBeenCalledTimes(1);
    expect(
      mocks.logWarn.mock.calls.some(([message]) =>
        String(message).includes("gateway:pre-restart hook timed out after 10000ms"),
      ),
    ).toBe(true);
  });

  it("drains the active-session tracker with reason=shutdown on normal close", async () => {
    const drainActiveSessionsForShutdown = vi.fn<DrainActiveSessionsForShutdown>(async () => ({
      emittedSessionIds: ["session-A", "session-B"],
      timedOut: false,
    }));
    const close = createGatewayCloseHandler(
      createCloseDeps({
        drainActiveSessionsForShutdown,
      }),
    );

    await close({ reason: "SIGTERM" });

    expect(drainActiveSessionsForShutdown).toHaveBeenCalledTimes(1);
    expect(drainActiveSessionsForShutdown.mock.calls[0]?.[0].reason).toBe("shutdown");
  });

  it("drains the active-session tracker with reason=restart when restartExpectedMs is set", async () => {
    const drainActiveSessionsForShutdown = vi.fn<DrainActiveSessionsForShutdown>(async () => ({
      emittedSessionIds: ["session-A"],
      timedOut: false,
    }));
    const close = createGatewayCloseHandler(
      createCloseDeps({
        drainActiveSessionsForShutdown,
      }),
    );

    await close({ reason: "gateway restarting", restartExpectedMs: 1234 });

    expect(drainActiveSessionsForShutdown).toHaveBeenCalledTimes(1);
    expect(drainActiveSessionsForShutdown.mock.calls[0]?.[0].reason).toBe("restart");
  });

  it("records a warning and continues shutdown when the session-end drain reports a timeout", async () => {
    const drainActiveSessionsForShutdown = vi.fn<DrainActiveSessionsForShutdown>(async () => ({
      emittedSessionIds: ["session-A"],
      timedOut: true,
    }));
    const close = createGatewayCloseHandler(
      createCloseDeps({
        drainActiveSessionsForShutdown,
      }),
    );

    const result = await close({ reason: "SIGTERM" });

    expect(drainActiveSessionsForShutdown).toHaveBeenCalledTimes(1);
    expect(result.warnings).toContain("session-end-drain");
    expect(
      mocks.logWarn.mock.calls.some(([message]) =>
        String(message).includes("session-end-drain timed out"),
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

  it("records subsystem shutdown warnings without aborting later cleanup", async () => {
    mocks.listChannelPlugins.mockReturnValue([{ id: "telegram" }, { id: "discord" }]);
    const lifecycleUnsub = vi.fn();
    const stopChannel = vi.fn(async (id: string) => {
      if (id === "telegram") {
        throw new Error("telegram stuck");
      }
    });
    const close = createGatewayCloseHandler(
      createCloseDeps({
        bonjourStop: vi.fn(async () => {
          throw new Error("mdns unavailable");
        }),
        canvasHost: {
          close: vi.fn(async () => {
            throw new Error("canvas unavailable");
          }),
        } as never,
        lifecycleUnsub,
        stopChannel: stopChannel as GatewayCloseHandlerParams["stopChannel"],
      }),
    );

    const result = await close({ reason: "test shutdown" });

    expect(result.warnings).toContain("bonjour");
    expect(result.warnings).toContain("canvas-host");
    expect(result.warnings).toContain("channel/telegram");
    expect(result.warnings).not.toContain("channel/discord");
    expect(lifecycleUnsub).toHaveBeenCalledTimes(1);
    expect(stopChannel).toHaveBeenCalledTimes(2);
    expect(mocks.logWarn).toHaveBeenCalledWith("bonjour: mdns unavailable");
    expect(mocks.logWarn).toHaveBeenCalledWith("channel/telegram: telegram stuck");
  });

  it("records optional cleanup warnings without aborting later cleanup", async () => {
    const chatRunState = { clear: vi.fn() };
    const close = createGatewayCloseHandler(
      createCloseDeps({
        tailscaleCleanup: vi.fn(async () => {
          throw new Error("tailscale down");
        }),
        canvasHostServer: {
          close: vi.fn(async () => {
            throw new Error("canvas server down");
          }),
        } as never,
        pluginServices: {
          stop: vi.fn(async () => {
            throw new Error("plugins down");
          }),
        } as never,
        configReloader: {
          stop: vi.fn(async () => {
            throw new Error("reload down");
          }),
        },
        updateCheckStop: vi.fn(() => {
          throw new Error("update down");
        }),
        agentUnsub: vi.fn(() => {
          throw new Error("agent down");
        }),
        heartbeatUnsub: vi.fn(() => {
          throw new Error("heartbeat down");
        }),
        transcriptUnsub: vi.fn(() => {
          throw new Error("transcript down");
        }),
        lifecycleUnsub: vi.fn(() => {
          throw new Error("lifecycle down");
        }),
        chatRunState,
      }),
    );
    mocks.stopGmailWatcher.mockRejectedValueOnce(new Error("gmail down"));

    const result = await close({ reason: "test shutdown" });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "tailscale",
        "canvas-host-server",
        "plugin-services",
        "gmail-watcher",
        "update-check",
        "agent-unsub",
        "heartbeat-unsub",
        "transcript-unsub",
        "lifecycle-unsub",
        "config-reloader",
      ]),
    );
    expect(chatRunState.clear).toHaveBeenCalledTimes(1);
    expect(
      mocks.logWarn.mock.calls.some(([message]) => String(message) === "config-reloader: reload down"),
    ).toBe(true);
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
