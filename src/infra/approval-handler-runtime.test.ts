import { describe, expect, it, vi } from "vitest";
import {
  createChannelApprovalHandlerFromCapability,
  createLazyChannelApprovalNativeRuntimeAdapter,
  type ChannelApprovalNativeRuntimeAdapter,
} from "./approval-handler-runtime.js";
import type { ExecApprovalRequest } from "./exec-approvals.js";

const TEST_HANDLER_PARAMS = {
  label: "test/approval-handler",
  clientDisplayName: "Test Approval Handler",
  channel: "test",
  channelLabel: "Test",
  cfg: { channels: {} } as never,
  accountId: "default",
  nowMs: () => 1_000,
} as const;

function makeExecApprovalRequest(id: string): ExecApprovalRequest {
  return {
    id,
    expiresAtMs: 61_000,
    request: {
      command: "echo hi",
      turnSourceChannel: "test",
      turnSourceTo: "origin-chat",
    },
    createdAtMs: 1_000,
  };
}

function makeNativeRuntime(
  overrides: Partial<ChannelApprovalNativeRuntimeAdapter> = {},
): ChannelApprovalNativeRuntimeAdapter {
  return {
    availability: {
      isConfigured: vi.fn().mockReturnValue(true),
      shouldHandle: vi.fn().mockReturnValue(true),
    },
    presentation: {
      buildPendingPayload: vi.fn().mockResolvedValue({ text: "pending" }),
      buildResolvedResult: vi.fn().mockResolvedValue({ kind: "leave" }),
      buildExpiredResult: vi.fn().mockResolvedValue({ kind: "leave" }),
    },
    transport: {
      prepareTarget: vi.fn().mockResolvedValue({
        dedupeKey: "origin-chat",
        target: { to: "origin-chat" },
      }),
      deliverPending: vi.fn().mockResolvedValue({ messageId: "1" }),
    },
    interactions: {
      bindPending: vi.fn().mockResolvedValue({ bindingId: "bound" }),
      unbindPending: vi.fn(),
      cancelDelivered: vi.fn(),
    },
    ...overrides,
  };
}

function firstCallArg(mock: ReturnType<typeof vi.fn>): unknown {
  return mock.mock.calls[0]?.[0];
}

describe("createChannelApprovalHandlerFromCapability", () => {
  it("returns null when the capability does not expose a native runtime", async () => {
    await expect(
      createChannelApprovalHandlerFromCapability({
        capability: {},
        ...TEST_HANDLER_PARAMS,
      }),
    ).resolves.toBeNull();
  });

  it("returns a runtime when the capability exposes a native runtime", async () => {
    const runtime = await createChannelApprovalHandlerFromCapability({
      capability: {
        nativeRuntime: makeNativeRuntime({
          presentation: {
            buildPendingPayload: vi.fn(),
            buildResolvedResult: vi.fn(),
            buildExpiredResult: vi.fn(),
          },
          transport: {
            prepareTarget: vi.fn(),
            deliverPending: vi.fn(),
          },
        }),
      },
      ...TEST_HANDLER_PARAMS,
    });

    expect(runtime).not.toBeNull();
    expect(typeof runtime?.handleRequested).toBe("function");
  });

  it("preserves the original request and resolved approval kind when stop-time cleanup unbinds", async () => {
    const unbindPending = vi.fn();
    const nativeRuntime = makeNativeRuntime({
      resolveApprovalKind: vi.fn().mockReturnValue("plugin"),
      interactions: {
        bindPending: vi.fn().mockResolvedValue({ bindingId: "bound" }),
        unbindPending,
        cancelDelivered: vi.fn(),
      },
    });
    const runtime = await createChannelApprovalHandlerFromCapability({
      capability: {
        native: {
          describeDeliveryCapabilities: vi.fn().mockReturnValue({
            enabled: true,
            preferredSurface: "origin",
            supportsOriginSurface: true,
            supportsApproverDmSurface: false,
          }),
          resolveOriginTarget: vi.fn().mockResolvedValue({ to: "origin-chat" }),
        },
        nativeRuntime,
      },
      ...TEST_HANDLER_PARAMS,
    });
    const request = {
      id: "custom:1",
      expiresAtMs: 61_000,
      request: {
        turnSourceChannel: "test",
        turnSourceTo: "origin-chat",
      },
      createdAtMs: 1_000,
    } as never;

    await runtime!.handleRequested(request);
    await runtime!.stop();

    expect(unbindPending).toHaveBeenCalledOnce();
    const stopUnbind = firstCallArg(unbindPending) as
      | { request?: unknown; approvalKind?: string }
      | undefined;
    expect(stopUnbind?.request).toBe(request);
    expect(stopUnbind?.approvalKind).toBe("plugin");
  });

  it("delivers pending approval through the native runtime adapter", async () => {
    const nativeRuntime = makeNativeRuntime();
    const runtime = await createChannelApprovalHandlerFromCapability({
      capability: {
        native: {
          describeDeliveryCapabilities: vi.fn().mockReturnValue({
            enabled: true,
            preferredSurface: "origin",
            supportsOriginSurface: true,
            supportsApproverDmSurface: false,
          }),
          resolveOriginTarget: vi.fn().mockResolvedValue({ to: "origin-chat" }),
        },
        nativeRuntime,
      },
      ...TEST_HANDLER_PARAMS,
    });

    expect(runtime).not.toBeNull();
    const request = makeExecApprovalRequest("exec:1");
    await runtime!.handleRequested(request);

    expect(nativeRuntime.presentation.buildPendingPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        request,
        approvalKind: "exec",
      }),
    );
    expect(nativeRuntime.transport.prepareTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedTarget: expect.objectContaining({
          surface: "origin",
          target: expect.objectContaining({ to: "origin-chat" }),
        }),
      }),
    );
    expect(nativeRuntime.transport.deliverPending).toHaveBeenCalledOnce();
    expect(nativeRuntime.interactions?.bindPending).toHaveBeenCalledOnce();
  });

  it("ignores duplicate pending request ids before finalization", async () => {
    const unbindPending = vi.fn();
    const buildResolvedResult = vi.fn().mockResolvedValue({ kind: "leave" });
    const nativeRuntime = makeNativeRuntime({
      presentation: {
        buildPendingPayload: vi.fn().mockResolvedValue({ text: "pending" }),
        buildResolvedResult,
        buildExpiredResult: vi.fn().mockResolvedValue({ kind: "leave" }),
      },
      transport: {
        prepareTarget: vi.fn().mockResolvedValue({
          dedupeKey: "origin-chat",
          target: { to: "origin-chat" },
        }),
        deliverPending: vi.fn().mockResolvedValueOnce({ messageId: "1" }).mockResolvedValueOnce({
          messageId: "2",
        }),
      },
      interactions: {
        bindPending: vi
          .fn()
          .mockResolvedValueOnce({ bindingId: "bound-1" })
          .mockResolvedValueOnce({ bindingId: "bound-2" }),
        unbindPending,
      },
    });
    const runtime = await createChannelApprovalHandlerFromCapability({
      capability: {
        native: {
          describeDeliveryCapabilities: vi.fn().mockReturnValue({
            enabled: true,
            preferredSurface: "origin",
            supportsOriginSurface: true,
            supportsApproverDmSurface: false,
          }),
          resolveOriginTarget: vi.fn().mockResolvedValue({ to: "origin-chat" }),
        },
        nativeRuntime,
      },
      ...TEST_HANDLER_PARAMS,
    });
    const request = makeExecApprovalRequest("exec:dup");

    await runtime!.handleRequested(request);
    await runtime!.handleRequested(request);
    await runtime!.handleResolved({
      id: "exec:dup",
      decision: "allow-once",
      resolvedBy: "operator",
      ts: 2_000,
    });

    expect(unbindPending).toHaveBeenCalledTimes(1);
    const unbind = firstCallArg(unbindPending) as
      | { entry?: unknown; binding?: unknown; request?: unknown }
      | undefined;
    expect(unbind?.entry).toEqual({ messageId: "1" });
    expect(unbind?.binding).toEqual({ bindingId: "bound-1" });
    expect(unbind?.request).toBe(request);
    expect(buildResolvedResult).toHaveBeenCalledTimes(1);
  });

  it("continues finalization cleanup after one resolved entry unbind failure", async () => {
    const unbindPending = vi
      .fn()
      .mockRejectedValueOnce(new Error("unbind failed"))
      .mockResolvedValueOnce(undefined);
    const buildResolvedResult = vi.fn().mockResolvedValue({ kind: "leave" });
    const nativeRuntime = makeNativeRuntime({
      presentation: {
        buildPendingPayload: vi.fn().mockResolvedValue({ text: "pending" }),
        buildResolvedResult,
        buildExpiredResult: vi.fn().mockResolvedValue({ kind: "leave" }),
      },
      transport: {
        prepareTarget: vi.fn().mockImplementation(async ({ plannedTarget }) => ({
          dedupeKey: String(plannedTarget.target.to),
          target: { to: plannedTarget.target.to },
        })),
        deliverPending: vi
          .fn()
          .mockResolvedValueOnce({ messageId: "1" })
          .mockResolvedValueOnce({ messageId: "2" }),
      },
      interactions: {
        bindPending: vi
          .fn()
          .mockResolvedValueOnce({ bindingId: "bound-1" })
          .mockResolvedValueOnce({ bindingId: "bound-2" }),
        unbindPending,
      },
    });
    const runtime = await createChannelApprovalHandlerFromCapability({
      capability: {
        native: {
          describeDeliveryCapabilities: vi.fn().mockReturnValue({
            enabled: true,
            preferredSurface: "both",
            supportsOriginSurface: true,
            supportsApproverDmSurface: true,
          }),
          resolveOriginTarget: vi.fn().mockResolvedValue({ to: "origin-chat" }),
          resolveApproverDmTargets: vi.fn().mockResolvedValue([{ to: "approver-dm" }]),
        },
        nativeRuntime,
      },
      ...TEST_HANDLER_PARAMS,
    });
    const request = makeExecApprovalRequest("exec:2");

    await runtime!.handleRequested(request);
    await expect(
      runtime!.handleResolved({
        id: "exec:2",
        decision: "allow-once",
        resolvedBy: "operator",
        ts: 2_000,
      }),
    ).resolves.toBeUndefined();

    expect(unbindPending).toHaveBeenCalledTimes(2);
    expect(buildResolvedResult).toHaveBeenCalledTimes(1);
    const resolvedPayload = firstCallArg(buildResolvedResult) as { entry?: unknown } | undefined;
    expect(resolvedPayload?.entry).toEqual({ messageId: "2" });
  });

  it("continues stop-time unbind cleanup when one binding throws", async () => {
    const unbindPending = vi
      .fn()
      .mockRejectedValueOnce(new Error("unbind failed"))
      .mockResolvedValueOnce(undefined);
    const nativeRuntime = makeNativeRuntime({
      transport: {
        prepareTarget: vi.fn().mockResolvedValue({
          dedupeKey: "origin-chat",
          target: { to: "origin-chat" },
        }),
        deliverPending: vi
          .fn()
          .mockResolvedValueOnce({ messageId: "1" })
          .mockResolvedValueOnce({ messageId: "2" }),
      },
      interactions: {
        bindPending: vi
          .fn()
          .mockResolvedValueOnce({ bindingId: "bound-1" })
          .mockResolvedValueOnce({ bindingId: "bound-2" }),
        unbindPending,
      },
    });
    const runtime = await createChannelApprovalHandlerFromCapability({
      capability: {
        native: {
          describeDeliveryCapabilities: vi.fn().mockReturnValue({
            enabled: true,
            preferredSurface: "origin",
            supportsOriginSurface: true,
            supportsApproverDmSurface: false,
          }),
          resolveOriginTarget: vi.fn().mockResolvedValue({ to: "origin-chat" }),
        },
        nativeRuntime,
      },
      ...TEST_HANDLER_PARAMS,
    });
    const request = makeExecApprovalRequest("exec:stop-1");

    await runtime!.handleRequested(request);
    await runtime!.handleRequested({
      ...request,
      id: "exec:stop-2",
    });

    await expect(runtime!.stop()).resolves.toBeUndefined();
    expect(unbindPending).toHaveBeenCalledTimes(2);
    await expect(runtime!.stop()).resolves.toBeUndefined();
    expect(unbindPending).toHaveBeenCalledTimes(2);
  });

  it("keeps legacy startHandler nativeRuntime compatibility", async () => {
    const stop = vi.fn();
    const runtime = await createChannelApprovalHandlerFromCapability({
      capability: {
        nativeRuntime: {
          startHandler: vi.fn().mockResolvedValue({ stop }),
        },
      },
      ...TEST_HANDLER_PARAMS,
      context: { app: true },
    });

    await runtime!.start();
    await runtime!.stop();

    expect(stop).toHaveBeenCalledOnce();
  });
});

describe("createLazyChannelApprovalNativeRuntimeAdapter", () => {
  it("loads the runtime lazily and reuses the loaded adapter", async () => {
    const explicitIsConfigured = vi.fn().mockReturnValue(true);
    const explicitShouldHandle = vi.fn().mockReturnValue(false);
    const buildPendingPayload = vi.fn().mockResolvedValue({ text: "pending" });
    const load = vi.fn().mockResolvedValue(
      makeNativeRuntime({
        presentation: {
          buildPendingPayload,
          buildResolvedResult: vi.fn(),
          buildExpiredResult: vi.fn(),
        },
      }),
    );
    const adapter = createLazyChannelApprovalNativeRuntimeAdapter({
      eventKinds: ["exec"],
      isConfigured: explicitIsConfigured,
      shouldHandle: explicitShouldHandle,
      load,
    });

    const cfg = { channels: {} } as never;
    const request = makeExecApprovalRequest("exec:lazy");
    const view = {} as never;

    expect(adapter.eventKinds).toEqual(["exec"]);
    expect(adapter.availability.isConfigured({ cfg })).toBe(true);
    expect(adapter.availability.shouldHandle({ cfg, request })).toBe(false);
    await expect(
      adapter.presentation.buildPendingPayload({
        cfg,
        request,
        approvalKind: "exec",
        nowMs: 1,
        view,
      }),
    ).resolves.toEqual({ text: "pending" });
    expect(load).toHaveBeenCalledTimes(1);
    expect(buildPendingPayload).toHaveBeenCalledOnce();
  });

  it("keeps observe hooks synchronous and only uses the already-loaded runtime", async () => {
    const onDelivered = vi.fn();
    const load = vi.fn().mockResolvedValue(
      makeNativeRuntime({
        observe: {
          onDelivered,
        },
      }),
    );
    const adapter = createLazyChannelApprovalNativeRuntimeAdapter({
      isConfigured: vi.fn().mockReturnValue(true),
      shouldHandle: vi.fn().mockReturnValue(true),
      load,
    });

    adapter.observe?.onDelivered?.({ request: { id: "exec:1" } } as never);
    expect(load).not.toHaveBeenCalled();
    expect(onDelivered).not.toHaveBeenCalled();

    await adapter.presentation.buildPendingPayload({
      cfg: {} as never,
      request: makeExecApprovalRequest("exec:1"),
      approvalKind: "exec",
      nowMs: 1,
      view: {} as never,
    });

    adapter.observe?.onDelivered?.({ request: { id: "exec:1" } } as never);
    expect(onDelivered).toHaveBeenCalledWith({ request: { id: "exec:1" } });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
