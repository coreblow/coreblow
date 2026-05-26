import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";

type SessionEndHookEvent = {
  reason?: string;
  sessionId?: string;
  sessionKey?: string;
};

const mocks = vi.hoisted(() => ({
  runSessionEnd: vi.fn(async (_event: SessionEndHookEvent) => undefined),
  runSessionStart: vi.fn(async () => undefined),
  hasHooks: vi.fn((name: string) => name === "session_end"),
}));

vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: vi.fn(() => ({
    hasHooks: mocks.hasHooks,
    runSessionEnd: mocks.runSessionEnd,
    runSessionStart: mocks.runSessionStart,
  })),
}));

const {
  drainActiveSessionsForShutdown,
  emitGatewaySessionEndPluginHook,
  emitGatewaySessionStartPluginHook,
} = await import("./session-reset-service.js");
const { clearActiveSessionsForShutdownTracker, listActiveSessionsForShutdown } = await import(
  "./active-sessions-shutdown-tracker.js"
);

const cfg = {} as CoreBlowConfig;

function requireSessionEndHookEvent(index: number): SessionEndHookEvent {
  const call = mocks.runSessionEnd.mock.calls[index];
  if (!call) {
    throw new Error(`Expected session_end hook call ${index}`);
  }
  return call[0] as SessionEndHookEvent;
}

beforeEach(() => {
  clearActiveSessionsForShutdownTracker();
  mocks.runSessionEnd.mockReset();
  mocks.runSessionEnd.mockResolvedValue(undefined);
  mocks.runSessionStart.mockReset();
  mocks.runSessionStart.mockResolvedValue(undefined);
  mocks.hasHooks.mockReset();
  mocks.hasHooks.mockImplementation((name: string) => name === "session_end");
});

afterEach(() => {
  clearActiveSessionsForShutdownTracker();
});

describe("drainActiveSessionsForShutdown", () => {
  it("returns an empty result and skips hook emission when no sessions are tracked", async () => {
    const result = await drainActiveSessionsForShutdown({ reason: "shutdown" });

    expect(result).toEqual({ emittedSessionIds: [], timedOut: false });
    expect(mocks.runSessionEnd).not.toHaveBeenCalled();
  });

  it("fires session_end with reason=shutdown for every tracked session and clears them", async () => {
    emitGatewaySessionStartPluginHook({
      cfg,
      sessionKey: "agent:main:main",
      sessionId: "sess-A",
      storePath: "/tmp/store.json",
    });
    emitGatewaySessionStartPluginHook({
      cfg,
      sessionKey: "agent:main:other",
      sessionId: "sess-B",
      storePath: "/tmp/store.json",
    });

    const result = await drainActiveSessionsForShutdown({ reason: "shutdown" });

    expect(result.timedOut).toBe(false);
    expect(result.emittedSessionIds.toSorted()).toEqual(["sess-A", "sess-B"]);
    expect(mocks.runSessionEnd).toHaveBeenCalledTimes(2);
    expect(mocks.runSessionEnd.mock.calls.every(([event]) => event.reason === "shutdown")).toBe(
      true,
    );
    expect(listActiveSessionsForShutdown()).toEqual([]);
  });

  it("propagates reason=restart when called for a restart shutdown", async () => {
    emitGatewaySessionStartPluginHook({
      cfg,
      sessionKey: "agent:main:main",
      sessionId: "sess-A",
      storePath: "/tmp/store.json",
    });

    await drainActiveSessionsForShutdown({ reason: "restart" });

    expect(mocks.runSessionEnd).toHaveBeenCalledTimes(1);
    expect(requireSessionEndHookEvent(0).reason).toBe("restart");
  });

  it("does not double-fire for a session already finalized before shutdown", async () => {
    emitGatewaySessionStartPluginHook({
      cfg,
      sessionKey: "agent:main:main",
      sessionId: "sess-A",
      storePath: "/tmp/store.json",
    });
    emitGatewaySessionStartPluginHook({
      cfg,
      sessionKey: "agent:main:other",
      sessionId: "sess-B",
      storePath: "/tmp/store.json",
    });
    emitGatewaySessionEndPluginHook({
      cfg,
      sessionKey: "agent:main:main",
      sessionId: "sess-A",
      storePath: "/tmp/store.json",
      reason: "reset",
    });
    mocks.runSessionEnd.mockClear();

    await drainActiveSessionsForShutdown({ reason: "shutdown" });

    expect(mocks.runSessionEnd).toHaveBeenCalledTimes(1);
    expect(requireSessionEndHookEvent(0).sessionId).toBe("sess-B");
  });

  it("awaits each session_end handler so bounded timeout races real plugin work", async () => {
    let resolveHandler: (() => void) | undefined;
    const handlerLatch = new Promise<void>((resolve) => {
      resolveHandler = resolve;
    });
    mocks.runSessionEnd.mockImplementationOnce(async () => {
      await handlerLatch;
    });
    emitGatewaySessionStartPluginHook({
      cfg,
      sessionKey: "agent:main:main",
      sessionId: "sess-A",
      storePath: "/tmp/store.json",
    });

    let drainSettled = false;
    const drainPromise = drainActiveSessionsForShutdown({ reason: "shutdown" }).then((value) => {
      drainSettled = true;
      return value;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(drainSettled).toBe(false);
    expect(mocks.runSessionEnd).toHaveBeenCalledTimes(1);

    resolveHandler?.();
    const result = await drainPromise;
    expect(result.timedOut).toBe(false);
    expect(result.emittedSessionIds).toEqual(["sess-A"]);
  });

  it("returns timedOut=true while still starting later emissions when one handler hangs", async () => {
    mocks.runSessionEnd.mockImplementation(async (event: SessionEndHookEvent) => {
      if (event.sessionId === "sess-A") {
        await new Promise<void>(() => undefined);
      }
    });
    emitGatewaySessionStartPluginHook({
      cfg,
      sessionKey: "agent:main:main",
      sessionId: "sess-A",
      storePath: "/tmp/store.json",
    });
    emitGatewaySessionStartPluginHook({
      cfg,
      sessionKey: "agent:main:other",
      sessionId: "sess-B",
      storePath: "/tmp/store.json",
    });

    const result = await drainActiveSessionsForShutdown({
      reason: "shutdown",
      totalTimeoutMs: 120,
    });

    expect(result.timedOut).toBe(true);
    expect(result.emittedSessionIds.toSorted()).toEqual(["sess-A", "sess-B"]);
    expect(mocks.runSessionEnd).toHaveBeenCalledTimes(2);
    expect(mocks.runSessionEnd.mock.calls.map(([event]) => event.sessionId)).toEqual([
      "sess-A",
      "sess-B",
    ]);
  });

  it("forgets the session when no session_end plugins are registered", async () => {
    mocks.hasHooks.mockImplementation(() => false);
    emitGatewaySessionStartPluginHook({
      cfg,
      sessionKey: "agent:main:main",
      sessionId: "sess-A",
      storePath: "/tmp/store.json",
    });
    emitGatewaySessionEndPluginHook({
      cfg,
      sessionKey: "agent:main:main",
      sessionId: "sess-A",
      storePath: "/tmp/store.json",
      reason: "deleted",
    });

    expect(listActiveSessionsForShutdown()).toEqual([]);
    const result = await drainActiveSessionsForShutdown({ reason: "shutdown" });

    expect(result.emittedSessionIds).toEqual([]);
  });
});
