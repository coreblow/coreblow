import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayClient } from "../gateway/client.js";
import type { ExecApprovalRequest } from "./exec-approvals.js";
import type { PluginApprovalRequest, PluginApprovalResolved } from "./plugin-approvals.js";

const mockGatewayClientStarts = vi.hoisted(() => vi.fn());
const mockGatewayClientStops = vi.hoisted(() => vi.fn());
const mockGatewayClientRequests = vi.hoisted(() =>
  vi.fn<(method: string, params?: Record<string, unknown>) => Promise<unknown>>(async () => ({
    ok: true,
  })),
);
const mockCreateOperatorApprovalsGatewayClient = vi.hoisted(() => vi.fn());
const mockStartGatewayClientWhenEventLoopReady = vi.hoisted(() => vi.fn());
const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../gateway/operator-approvals-client.js", () => ({
  createOperatorApprovalsGatewayClient: mockCreateOperatorApprovalsGatewayClient,
}));

vi.mock("../gateway/client-start-readiness.js", () => ({
  startGatewayClientWhenEventLoopReady: mockStartGatewayClientWhenEventLoopReady,
}));

vi.mock("../logging/subsystem.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../logging/subsystem.js")>();
  const makeLogger = () => {
    const logger = {
      subsystem: "exec-approval-channel-runtime",
      isEnabled: () => true,
      trace: vi.fn(),
      debug: loggerMocks.debug,
      info: vi.fn(),
      warn: vi.fn(),
      error: loggerMocks.error,
      fatal: vi.fn(),
      raw: vi.fn(),
      child: () => logger,
    };
    return logger;
  };
  return {
    ...actual,
    createSubsystemLogger: vi.fn(() => makeLogger()),
  };
});

let createExecApprovalChannelRuntime: typeof import("./exec-approval-channel-runtime.js").createExecApprovalChannelRuntime;
let ExecApprovalChannelRuntimeTerminalStartError: typeof import("./exec-approval-channel-runtime.js").ExecApprovalChannelRuntimeTerminalStartError;

function createDeferred<T>() {
  let resolve: ((value: T | PromiseLike<T>) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  if (!resolve || !reject) {
    throw new Error("Expected deferred callbacks to be initialized");
  }
  return { promise, resolve, reject };
}

type GatewayEventClientParams = {
  onEvent?: (evt: { event: string; payload: unknown }) => void;
  onHelloOk?: (hello: unknown) => void;
  onConnectError?: (err: Error) => void;
  onReconnectPaused?: (info: {
    code: number;
    reason: string;
    detailCode?: string | null;
  }) => void;
  onClose?: (code: number, reason: string) => void;
};

function firstMockCall(
  mock: { mock: { calls: Array<readonly unknown[]> } },
  label: string,
): readonly unknown[] {
  const call = mock.mock.calls[0];
  if (!call) {
    throw new Error(`expected ${label} call`);
  }
  return call;
}

function lastGatewayEventClientParams(): GatewayEventClientParams | undefined {
  return firstMockCall(mockCreateOperatorApprovalsGatewayClient, "operator approvals client")[0] as
    | GatewayEventClientParams
    | undefined;
}

function createExecReplayRequest(id = "abc"): ExecApprovalRequest {
  return {
    id,
    request: {
      command: "echo abc",
    },
    createdAtMs: 1000,
    expiresAtMs: 2000,
  };
}

function createPluginReplayRequest(id = "plugin:abc"): PluginApprovalRequest {
  return {
    id,
    request: {
      title: "Plugin approval",
      description: "Let plugin proceed",
    },
    createdAtMs: 1000,
    expiresAtMs: 2000,
  };
}

function mockReplayLists(params: {
  exec?: ExecApprovalRequest[];
  plugin?: PluginApprovalRequest[];
}) {
  mockGatewayClientRequests.mockImplementation(async (method: string) => {
    if (method === "exec.approval.list") {
      return params.exec ?? [];
    }
    if (method === "plugin.approval.list") {
      return params.plugin ?? [];
    }
    return { ok: true };
  });
}

function expectFinalizedResolved(
  finalizedResolved: ReturnType<typeof vi.fn>,
  params: { id: string; decision: string; entries: Array<{ id: string }> },
) {
  expect(finalizedResolved).toHaveBeenCalledTimes(1);
  const payload = firstMockCall(finalizedResolved, "resolved approval finalization")[0] as
    | {
        request?: { id?: string };
        resolved?: { id?: string; decision?: string };
        entries?: Array<{ id: string }>;
      }
    | undefined;
  expect(payload?.request?.id).toBe(params.id);
  expect(payload?.resolved?.id).toBe(params.id);
  expect(payload?.resolved?.decision).toBe(params.decision);
  expect(payload?.entries).toEqual(params.entries);
}

function expectDeliveredRequestId(deliverRequested: ReturnType<typeof vi.fn>, id: string) {
  expect(
    deliverRequested.mock.calls.some(
      ([request]) => (request as { id?: unknown } | undefined)?.id === id,
    ),
  ).toBe(true);
}

beforeEach(() => {
  mockGatewayClientStarts.mockReset();
  mockGatewayClientStops.mockReset();
  mockGatewayClientRequests.mockReset();
  mockGatewayClientRequests.mockImplementation(async (method: string) =>
    method.endsWith(".approval.list") ? [] : { ok: true },
  );
  mockStartGatewayClientWhenEventLoopReady.mockReset().mockImplementation(async (client) => {
    client.start();
    return { ready: true, elapsedMs: 0, maxDriftMs: 0, checks: 2, aborted: false };
  });
  loggerMocks.debug.mockReset();
  loggerMocks.error.mockReset();
  mockCreateOperatorApprovalsGatewayClient.mockReset().mockImplementation(async (params) => ({
    start: () => {
      mockGatewayClientStarts();
      queueMicrotask(() => {
        params.onHelloOk?.({ type: "hello-ok" });
      });
    },
    stop: mockGatewayClientStops,
    request: mockGatewayClientRequests,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

beforeAll(async () => {
  ({ createExecApprovalChannelRuntime, ExecApprovalChannelRuntimeTerminalStartError } =
    await import("./exec-approval-channel-runtime.js"));
});

describe("createExecApprovalChannelRuntime", () => {
  it("does not connect when the adapter is not configured", async () => {
    const runtime = createExecApprovalChannelRuntime({
      label: "test/exec-approvals",
      clientDisplayName: "Test Exec Approvals",
      cfg: {},
      isConfigured: () => false,
      shouldHandle: () => true,
      deliverRequested: async () => [],
      finalizeResolved: async () => undefined,
    });

    await runtime.start();

    expect(mockCreateOperatorApprovalsGatewayClient).not.toHaveBeenCalled();
  });

  it("finalizes approvals that resolve while delivery is still in flight", async () => {
    const pendingDelivery = createDeferred<Array<{ id: string }>>();
    const finalizeResolved = vi.fn(async () => undefined);
    const runtime = createExecApprovalChannelRuntime<
      { id: string },
      PluginApprovalRequest,
      PluginApprovalResolved
    >({
      label: "test/plugin-approvals",
      clientDisplayName: "Test Plugin Approvals",
      cfg: {},
      eventKinds: ["plugin"],
      isConfigured: () => true,
      shouldHandle: () => true,
      deliverRequested: async () => pendingDelivery.promise,
      finalizeResolved,
    });

    const requestPromise = runtime.handleRequested(createPluginReplayRequest());
    await runtime.handleResolved({
      id: "plugin:abc",
      decision: "allow-once",
      ts: 1500,
    });

    pendingDelivery.resolve([{ id: "plugin:abc" }]);
    await requestPromise;

    expectFinalizedResolved(finalizeResolved, {
      id: "plugin:abc",
      decision: "allow-once",
      entries: [{ id: "plugin:abc" }],
    });
  });

  it("surfaces reconnect pauses as terminal startup errors", async () => {
    const authError = Object.assign(new Error("pairing required"), {
      details: {
        code: "PAIRING_REQUIRED",
      },
    });
    mockCreateOperatorApprovalsGatewayClient.mockImplementationOnce(async (params) => ({
      start: () => {
        mockGatewayClientStarts();
        params.onConnectError?.(authError);
        params.onReconnectPaused?.({
          code: 1008,
          reason: "pairing required",
          detailCode: "PAIRING_REQUIRED",
        });
        params.onClose?.(1008, "pairing required");
      },
      stop: mockGatewayClientStops,
      request: mockGatewayClientRequests,
    }));
    const runtime = createExecApprovalChannelRuntime({
      label: "test/exec-approvals",
      clientDisplayName: "Test Exec Approvals",
      cfg: {},
      isConfigured: () => true,
      shouldHandle: () => true,
      deliverRequested: async () => [],
      finalizeResolved: async () => undefined,
    });

    let caught: unknown;
    await runtime.start().catch((error) => {
      caught = error;
    });

    expect(caught).toBeInstanceOf(ExecApprovalChannelRuntimeTerminalStartError);
    expect((caught as { detailCode?: string }).detailCode).toBe("PAIRING_REQUIRED");

    expect(mockGatewayClientStarts).toHaveBeenCalledTimes(1);
    expect(mockGatewayClientStops).toHaveBeenCalledTimes(1);
  });

  it("does not leave a gateway client running when stop wins the startup race", async () => {
    const pendingClient = createDeferred<GatewayClient>();
    mockCreateOperatorApprovalsGatewayClient.mockReturnValueOnce(pendingClient.promise);
    const runtime = createExecApprovalChannelRuntime({
      label: "test/exec-approvals",
      clientDisplayName: "Test Exec Approvals",
      cfg: {},
      isConfigured: () => true,
      shouldHandle: () => true,
      deliverRequested: async () => [],
      finalizeResolved: async () => undefined,
    });

    const startPromise = runtime.start();
    const stopPromise = runtime.stop();
    pendingClient.resolve({
      start: mockGatewayClientStarts,
      stop: mockGatewayClientStops,
      request: mockGatewayClientRequests as GatewayClient["request"],
    } as unknown as GatewayClient);
    await startPromise;
    await stopPromise;

    expect(mockGatewayClientStarts).not.toHaveBeenCalled();
    expect(mockGatewayClientStops).toHaveBeenCalledTimes(1);
    await expect(runtime.request("exec.approval.resolve", { id: "abc" })).rejects.toThrow(
      "gateway client not connected",
    );
  });

  it("subscribes to plugin approval events when requested", async () => {
    const deliverRequested = vi.fn(async (request) => [{ id: request.id }]);
    const finalizeResolved = vi.fn(async () => undefined);
    const runtime = createExecApprovalChannelRuntime<
      { id: string },
      PluginApprovalRequest,
      PluginApprovalResolved
    >({
      label: "test/plugin-approvals",
      clientDisplayName: "Test Plugin Approvals",
      cfg: {},
      eventKinds: ["plugin"],
      isConfigured: () => true,
      shouldHandle: () => true,
      deliverRequested,
      finalizeResolved,
    });

    await runtime.start();
    const clientParams = lastGatewayEventClientParams();
    expect(clientParams?.onEvent).toBeTypeOf("function");

    clientParams?.onEvent?.({
      event: "plugin.approval.requested",
      payload: createPluginReplayRequest(),
    });
    await vi.waitFor(() => {
      expectDeliveredRequestId(deliverRequested, "plugin:abc");
    });

    clientParams?.onEvent?.({
      event: "plugin.approval.resolved",
      payload: {
        id: "plugin:abc",
        decision: "allow-once",
        ts: 1500,
      },
    });
    await vi.waitFor(() => {
      expectFinalizedResolved(finalizeResolved, {
        id: "plugin:abc",
        decision: "allow-once",
        entries: [{ id: "plugin:abc" }],
      });
    });
  });

  it("replays pending approvals after the gateway connection is ready", async () => {
    mockReplayLists({ exec: [createExecReplayRequest()] });
    const deliverRequested = vi.fn(async (request) => [{ id: request.id }]);
    const runtime = createExecApprovalChannelRuntime({
      label: "test/replay",
      clientDisplayName: "Test Replay",
      cfg: {},
      isConfigured: () => true,
      shouldHandle: () => true,
      deliverRequested,
      finalizeResolved: async () => undefined,
    });

    await runtime.start();

    await vi.waitFor(() => {
      expect(mockGatewayClientRequests).toHaveBeenCalledWith("exec.approval.list", {});
      expectDeliveredRequestId(deliverRequested, "abc");
    });
  });

  it("logs replay list failures without failing startup", async () => {
    mockGatewayClientRequests.mockImplementation(async (method: string) => {
      if (method === "exec.approval.list") {
        throw new Error("list failed");
      }
      return { ok: true };
    });
    const deliverRequested = vi.fn(async (request) => [{ id: request.id }]);
    const runtime = createExecApprovalChannelRuntime({
      label: "test/replay-list-error",
      clientDisplayName: "Test Replay List Error",
      cfg: {},
      isConfigured: () => true,
      shouldHandle: () => true,
      deliverRequested,
      finalizeResolved: async () => undefined,
    });

    await expect(runtime.start()).resolves.toBeUndefined();

    await vi.waitFor(() => {
      expect(loggerMocks.error).toHaveBeenCalledWith(
        "error replaying pending approvals: list failed",
      );
    });
    expect(deliverRequested).not.toHaveBeenCalled();
  });

  it("clears pending state when delivery throws", async () => {
    const deliverRequested = vi
      .fn<() => Promise<Array<{ id: string }>>>()
      .mockRejectedValueOnce(new Error("deliver failed"))
      .mockResolvedValueOnce([{ id: "abc" }]);
    const finalizeResolved = vi.fn(async () => undefined);
    const runtime = createExecApprovalChannelRuntime({
      label: "test/delivery-failure",
      clientDisplayName: "Test Delivery Failure",
      cfg: {},
      isConfigured: () => true,
      shouldHandle: () => true,
      deliverRequested,
      finalizeResolved,
    });

    await expect(runtime.handleRequested(createExecReplayRequest())).rejects.toThrow(
      "deliver failed",
    );

    await runtime.handleRequested(createExecReplayRequest());
    await runtime.handleResolved({
      id: "abc",
      decision: "allow-once",
      ts: 1500,
    });

    expectFinalizedResolved(finalizeResolved, {
      id: "abc",
      decision: "allow-once",
      entries: [{ id: "abc" }],
    });
  });
});
