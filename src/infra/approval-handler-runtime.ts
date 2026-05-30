import type { ChannelApprovalNativeAdapter } from "../channels/plugins/approval-native.types.js";
import type { ChannelApprovalCapability } from "../channels/plugins/types.adapters.js";
import type { CoreBlowConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  CHANNEL_APPROVAL_NATIVE_RUNTIME_CONTEXT_CAPABILITY,
  createLazyChannelApprovalNativeRuntimeAdapter,
} from "./approval-handler-adapter-runtime.js";
import type {
  ApprovalRequest,
  ApprovalResolved,
  ChannelApprovalCapabilityHandlerContext,
  ChannelApprovalKind,
  ChannelApprovalNativeFinalAction,
  ChannelApprovalNativePlannedTarget,
  ChannelApprovalNativeRuntimeAdapter,
  ChannelApprovalNativeRuntimeSpec,
  PreparedChannelNativeApprovalTarget,
} from "./approval-handler-runtime-types.js";
import {
  buildExpiredApprovalView,
  buildPendingApprovalView,
  buildResolvedApprovalView,
} from "./approval-view-model.js";
import type {
  ExpiredApprovalView,
  PendingApprovalView,
  ResolvedApprovalView,
} from "./approval-view-model.types.js";
import {
  createExecApprovalChannelRuntime,
  type ExecApprovalChannelRuntime,
} from "./exec-approval-channel-runtime.js";
import type { ExecApprovalChannelRuntimeEventKind } from "./exec-approval-channel-runtime.types.js";
import { resolveChannelNativeApprovalDeliveryPlan } from "./approval-native-runtime.js";

export type {
  ApprovalActionView,
  ApprovalMetadataView,
  ApprovalViewModel,
  ExecApprovalExpiredView,
  ExecApprovalPendingView,
  ExecApprovalResolvedView,
  ExpiredApprovalView,
  PendingApprovalView,
  PluginApprovalExpiredView,
  PluginApprovalPendingView,
  PluginApprovalResolvedView,
  ResolvedApprovalView,
} from "./approval-view-model.types.js";
export {
  CHANNEL_APPROVAL_NATIVE_RUNTIME_CONTEXT_CAPABILITY,
  createLazyChannelApprovalNativeRuntimeAdapter,
};
export type {
  ChannelApprovalCapabilityHandlerContext,
  ChannelApprovalNativeAvailabilityAdapter,
  ChannelApprovalNativeFinalAction,
  ChannelApprovalNativeInteractionAdapter,
  ChannelApprovalNativeObserveAdapter,
  ChannelApprovalNativePlannedTarget,
  ChannelApprovalNativePresentationAdapter,
  ChannelApprovalNativeRuntimeAdapter,
  ChannelApprovalNativeRuntimeSpec,
  ChannelApprovalNativeTransportAdapter,
  PreparedChannelNativeApprovalTarget,
} from "./approval-handler-runtime-types.js";

export type ChannelApprovalHandler<
  TRequest extends ApprovalRequest = ApprovalRequest,
  TResolved extends ApprovalResolved = ApprovalResolved,
> = ExecApprovalChannelRuntime<TRequest, TResolved>;

type ChannelApprovalHandlerRuntimeSpec<TRequest extends ApprovalRequest> = {
  label: string;
  clientDisplayName: string;
  cfg: CoreBlowConfig;
  gatewayUrl?: string;
  eventKinds?: readonly ExecApprovalChannelRuntimeEventKind[];
  channel?: string;
  channelLabel?: string;
  accountId?: string | null;
  nativeAdapter?: ChannelApprovalNativeAdapter | null;
  resolveApprovalKind?: (request: TRequest) => ChannelApprovalKind;
  isConfigured: () => boolean;
  shouldHandle: (request: TRequest) => boolean;
  nowMs?: () => number;
};

type ChannelApprovalHandlerContentSpec<
  TPendingContent,
  TRequest extends ApprovalRequest = ApprovalRequest,
> = {
  buildPendingContent: (params: {
    request: TRequest;
    approvalKind: ChannelApprovalKind;
    nowMs: number;
  }) => TPendingContent | Promise<TPendingContent>;
};

type ChannelApprovalHandlerTransportSpec<
  TPendingEntry,
  TPreparedTarget,
  TPendingContent,
  TRequest extends ApprovalRequest = ApprovalRequest,
> = {
  prepareTarget: (params: {
    plannedTarget: ChannelApprovalNativePlannedTarget;
    request: TRequest;
    approvalKind: ChannelApprovalKind;
    pendingContent: TPendingContent;
  }) =>
    | PreparedChannelNativeApprovalTarget<TPreparedTarget>
    | null
    | Promise<PreparedChannelNativeApprovalTarget<TPreparedTarget> | null>;
  deliverTarget: (params: {
    plannedTarget: ChannelApprovalNativePlannedTarget;
    preparedTarget: TPreparedTarget;
    request: TRequest;
    approvalKind: ChannelApprovalKind;
    pendingContent: TPendingContent;
  }) => TPendingEntry | null | Promise<TPendingEntry | null>;
};

type ChannelApprovalHandlerLifecycleSpec<
  TPendingEntry,
  TPreparedTarget,
  TPendingContent,
  TRequest extends ApprovalRequest = ApprovalRequest,
  TResolved extends ApprovalResolved = ApprovalResolved,
> = {
  onDeliveryError?: (params: {
    error: unknown;
    plannedTarget: ChannelApprovalNativePlannedTarget;
    request: TRequest;
    approvalKind: ChannelApprovalKind;
    pendingContent: TPendingContent;
  }) => void;
  onDuplicateSkipped?: (params: {
    plannedTarget: ChannelApprovalNativePlannedTarget;
    preparedTarget: PreparedChannelNativeApprovalTarget<TPreparedTarget>;
    request: TRequest;
    approvalKind: ChannelApprovalKind;
    pendingContent: TPendingContent;
  }) => void;
  onDelivered?: (params: {
    plannedTarget: ChannelApprovalNativePlannedTarget;
    preparedTarget: PreparedChannelNativeApprovalTarget<TPreparedTarget>;
    request: TRequest;
    approvalKind: ChannelApprovalKind;
    pendingContent: TPendingContent;
    entry: TPendingEntry;
  }) => void;
  finalizeResolved: (params: {
    request: TRequest;
    resolved: TResolved;
    entries: TPendingEntry[];
  }) => Promise<void>;
  finalizeExpired?: (params: { request: TRequest; entries: TPendingEntry[] }) => Promise<void>;
  onStopped?: () => Promise<void> | void;
};

export type ChannelApprovalHandlerAdapter<
  TPendingEntry,
  TPreparedTarget,
  TPendingContent,
  TRequest extends ApprovalRequest = ApprovalRequest,
  TResolved extends ApprovalResolved = ApprovalResolved,
> = {
  runtime: ChannelApprovalHandlerRuntimeSpec<TRequest>;
  content: ChannelApprovalHandlerContentSpec<TPendingContent, TRequest>;
  transport: ChannelApprovalHandlerTransportSpec<
    TPendingEntry,
    TPreparedTarget,
    TPendingContent,
    TRequest
  >;
  lifecycle: ChannelApprovalHandlerLifecycleSpec<
    TPendingEntry,
    TPreparedTarget,
    TPendingContent,
    TRequest,
    TResolved
  >;
};

type WrappedPendingEntry = {
  entry: unknown;
  binding?: unknown;
};

type ActiveApprovalEntries = {
  request: ApprovalRequest;
  approvalKind: ChannelApprovalKind;
  entries: WrappedPendingEntry[];
};

type WrappedPendingContent = {
  view: PendingApprovalView;
  payload: unknown;
};

type LegacyApprovalRuntimeCapability = {
  startHandler?: (params: {
    cfg: CoreBlowConfig;
    accountId: string;
    context: unknown;
    channelRuntime?: unknown;
  }) =>
    | Promise<ChannelApprovalHandler | { stop: () => Promise<void> | void } | null | undefined>
    | ChannelApprovalHandler
    | { stop: () => Promise<void> | void }
    | null
    | undefined;
};

function isNativeRuntimeAdapter(value: unknown): value is ChannelApprovalNativeRuntimeAdapter {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ChannelApprovalNativeRuntimeAdapter>;
  return Boolean(
    candidate.availability &&
      candidate.presentation &&
      candidate.transport &&
      typeof candidate.availability.isConfigured === "function" &&
      typeof candidate.availability.shouldHandle === "function" &&
      typeof candidate.presentation.buildPendingPayload === "function" &&
      typeof candidate.transport.prepareTarget === "function" &&
      typeof candidate.transport.deliverPending === "function",
  );
}

function isLegacyApprovalRuntimeCapability(value: unknown): value is LegacyApprovalRuntimeCapability {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LegacyApprovalRuntimeCapability).startHandler === "function",
  );
}

function consumeActiveWrappedEntries(
  activeEntries: Map<string, ActiveApprovalEntries>,
  requestId: string,
  fallbackEntries: WrappedPendingEntry[],
): WrappedPendingEntry[] {
  const entries = activeEntries.get(requestId)?.entries ?? fallbackEntries;
  activeEntries.delete(requestId);
  return entries;
}

async function finalizeWrappedEntries(params: {
  entries: WrappedPendingEntry[];
  phase: "resolved" | "expired";
  request: ApprovalRequest;
  log: ReturnType<typeof createSubsystemLogger>;
  runEntry: (wrapped: WrappedPendingEntry) => Promise<void>;
}): Promise<void> {
  for (const wrapped of params.entries) {
    try {
      await params.runEntry(wrapped);
    } catch (error) {
      params.log.error(
        `failed to finalize ${params.phase} native approval entry ` +
          `approval=${params.request.id}: ${String(error)}`,
      );
    }
  }
}

async function unbindWrappedEntries(params: {
  entries: WrappedPendingEntry[];
  request: ApprovalRequest;
  approvalKind: ChannelApprovalKind;
  baseContext: ChannelApprovalCapabilityHandlerContext;
  nativeRuntime: ChannelApprovalNativeRuntimeAdapter;
  log: ReturnType<typeof createSubsystemLogger>;
}): Promise<void> {
  if (!params.nativeRuntime.interactions?.unbindPending) {
    return;
  }
  for (const wrapped of params.entries) {
    if (wrapped.binding === undefined) {
      continue;
    }
    try {
      await params.nativeRuntime.interactions.unbindPending({
        ...params.baseContext,
        entry: wrapped.entry,
        binding: wrapped.binding,
        request: params.request,
        approvalKind: params.approvalKind,
      });
    } catch (error) {
      params.log.error(
        `failed to unbind stopped native approval entry ` +
          `approval=${params.request.id}: ${String(error)}`,
      );
    }
  }
}

async function applyApprovalFinalAction(params: {
  nativeRuntime: ChannelApprovalNativeRuntimeAdapter;
  baseContext: ChannelApprovalCapabilityHandlerContext;
  wrapped: WrappedPendingEntry;
  result: ChannelApprovalNativeFinalAction<unknown>;
  phase: "resolved" | "expired";
}): Promise<void> {
  switch (params.result.kind) {
    case "update":
      await params.nativeRuntime.transport.updateEntry?.({
        ...params.baseContext,
        entry: params.wrapped.entry,
        payload: params.result.payload,
        phase: params.phase,
      });
      return;
    case "delete":
      await params.nativeRuntime.transport.deleteEntry?.({
        ...params.baseContext,
        entry: params.wrapped.entry,
        phase: params.phase,
      });
      return;
    case "clear-actions":
      await params.nativeRuntime.interactions?.clearPendingActions?.({
        ...params.baseContext,
        entry: params.wrapped.entry,
        phase: params.phase,
      });
      return;
    case "leave":
      return;
  }
}

function defaultResolveApprovalKind(request: ApprovalRequest): ChannelApprovalKind {
  return request.id.startsWith("plugin:") ? "plugin" : "exec";
}

async function resolvePlannedTargets(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  approvalKind: ChannelApprovalKind;
  request: ApprovalRequest;
  nativeAdapter?: ChannelApprovalNativeAdapter | null;
}): Promise<ChannelApprovalNativePlannedTarget[]> {
  const deliveryPlan = await resolveChannelNativeApprovalDeliveryPlan({
    cfg: params.cfg,
    accountId: params.accountId,
    approvalKind: params.approvalKind,
    request: params.request,
    adapter: params.nativeAdapter,
  });
  return deliveryPlan.targets;
}

export function createChannelApprovalNativeRuntimeAdapter<
  TPendingPayload,
  TPreparedTarget,
  TPendingEntry,
  TBinding = unknown,
  TFinalPayload = unknown,
  TPendingView extends PendingApprovalView = PendingApprovalView,
  TResolvedView extends ResolvedApprovalView = ResolvedApprovalView,
  TExpiredView extends ExpiredApprovalView = ExpiredApprovalView,
>(
  spec: ChannelApprovalNativeRuntimeSpec<
    TPendingPayload,
    TPreparedTarget,
    TPendingEntry,
    TBinding,
    TFinalPayload,
    TPendingView,
    TResolvedView,
    TExpiredView
  >,
): ChannelApprovalNativeRuntimeAdapter<
  TPendingPayload,
  TPreparedTarget,
  TPendingEntry,
  TBinding,
  TFinalPayload
> {
  return {
    ...(spec.eventKinds ? { eventKinds: spec.eventKinds } : {}),
    ...(spec.resolveApprovalKind ? { resolveApprovalKind: spec.resolveApprovalKind } : {}),
    availability: {
      isConfigured: spec.availability.isConfigured,
      shouldHandle: spec.availability.shouldHandle,
    },
    presentation: {
      buildPendingPayload: async (params) =>
        await spec.presentation.buildPendingPayload(params as never),
      buildResolvedResult: async (params) =>
        await spec.presentation.buildResolvedResult(params as never),
      buildExpiredResult: async (params) =>
        await spec.presentation.buildExpiredResult(params as never),
    },
    transport: {
      prepareTarget: async (params) => await spec.transport.prepareTarget(params as never),
      deliverPending: async (params) => await spec.transport.deliverPending(params as never),
      ...(spec.transport.updateEntry
        ? {
            updateEntry: async (params) => await spec.transport.updateEntry?.(params as never),
          }
        : {}),
      ...(spec.transport.deleteEntry
        ? {
            deleteEntry: async (params) => await spec.transport.deleteEntry?.(params as never),
          }
        : {}),
    },
    ...(spec.interactions
      ? {
          interactions: {
            ...(spec.interactions.bindPending
              ? {
                  bindPending: async (params) =>
                    (await spec.interactions?.bindPending?.(params as never)) ?? null,
                }
              : {}),
            ...(spec.interactions.unbindPending
              ? {
                  unbindPending: async (params) =>
                    await spec.interactions?.unbindPending?.(params as never),
                }
              : {}),
            ...(spec.interactions.clearPendingActions
              ? {
                  clearPendingActions: async (params) =>
                    await spec.interactions?.clearPendingActions?.(params as never),
                }
              : {}),
            ...(spec.interactions.cancelDelivered
              ? {
                  cancelDelivered: async (params) =>
                    await spec.interactions?.cancelDelivered?.(params as never),
                }
              : {}),
          },
        }
      : {}),
    ...(spec.observe
      ? {
          observe: {
            ...(spec.observe.onDeliveryError
              ? {
                  onDeliveryError: (params) => spec.observe?.onDeliveryError?.(params as never),
                }
              : {}),
            ...(spec.observe.onDuplicateSkipped
              ? {
                  onDuplicateSkipped: (params) =>
                    spec.observe?.onDuplicateSkipped?.(params as never),
                }
              : {}),
            ...(spec.observe.onDelivered
              ? {
                  onDelivered: (params) => spec.observe?.onDelivered?.(params as never),
                }
              : {}),
          },
        }
      : {}),
  };
}

export function createChannelApprovalHandler<
  TPendingEntry,
  TPreparedTarget,
  TPendingContent,
  TRequest extends ApprovalRequest = ApprovalRequest,
  TResolved extends ApprovalResolved = ApprovalResolved,
>(
  adapter: ChannelApprovalHandlerAdapter<
    TPendingEntry,
    TPreparedTarget,
    TPendingContent,
    TRequest,
    TResolved
  >,
): ChannelApprovalHandler<TRequest, TResolved> {
  const nowMs = adapter.runtime.nowMs ?? Date.now;
  const resolveApprovalKind = adapter.runtime.resolveApprovalKind ?? defaultResolveApprovalKind;
  return createExecApprovalChannelRuntime<TPendingEntry, TRequest, TResolved>({
    label: adapter.runtime.label,
    clientDisplayName: adapter.runtime.clientDisplayName,
    cfg: adapter.runtime.cfg,
    gatewayUrl: adapter.runtime.gatewayUrl,
    eventKinds: adapter.runtime.eventKinds,
    isConfigured: adapter.runtime.isConfigured,
    shouldHandle: adapter.runtime.shouldHandle,
    nowMs,
    deliverRequested: async (request) => {
      const approvalKind = resolveApprovalKind(request);
      const pendingContent = await adapter.content.buildPendingContent({
        request,
        approvalKind,
        nowMs: nowMs(),
      });
      const plannedTargets = await resolvePlannedTargets({
        cfg: adapter.runtime.cfg,
        accountId: adapter.runtime.accountId,
        approvalKind,
        request,
        nativeAdapter: adapter.runtime.nativeAdapter,
      });
      const deliveredKeys = new Set<string>();
      const entries: TPendingEntry[] = [];
      for (const plannedTarget of plannedTargets) {
        try {
          const preparedTarget = await adapter.transport.prepareTarget({
            plannedTarget,
            request,
            approvalKind,
            pendingContent,
          });
          if (!preparedTarget) {
            continue;
          }
          if (deliveredKeys.has(preparedTarget.dedupeKey)) {
            adapter.lifecycle.onDuplicateSkipped?.({
              plannedTarget,
              preparedTarget,
              request,
              approvalKind,
              pendingContent,
            });
            continue;
          }
          const entry = await adapter.transport.deliverTarget({
            plannedTarget,
            preparedTarget: preparedTarget.target,
            request,
            approvalKind,
            pendingContent,
          });
          if (!entry) {
            continue;
          }
          deliveredKeys.add(preparedTarget.dedupeKey);
          entries.push(entry);
          adapter.lifecycle.onDelivered?.({
            plannedTarget,
            preparedTarget,
            request,
            approvalKind,
            pendingContent,
            entry,
          });
        } catch (error) {
          adapter.lifecycle.onDeliveryError?.({
            error,
            plannedTarget,
            request,
            approvalKind,
            pendingContent,
          });
        }
      }
      return entries;
    },
    finalizeResolved: adapter.lifecycle.finalizeResolved,
    finalizeExpired: adapter.lifecycle.finalizeExpired,
    onStopped: adapter.lifecycle.onStopped,
  });
}

async function deliverPendingContent(params: {
  nativeRuntime: ChannelApprovalNativeRuntimeAdapter;
  baseContext: ChannelApprovalCapabilityHandlerContext;
  nativeAdapter?: ChannelApprovalNativeAdapter | null;
  request: ApprovalRequest;
  approvalKind: ChannelApprovalKind;
  pendingContent: WrappedPendingContent;
  stopped: () => boolean;
  activeEntries: Map<string, ActiveApprovalEntries>;
}): Promise<WrappedPendingEntry[]> {
  const plannedTargets = await resolvePlannedTargets({
    cfg: params.baseContext.cfg,
    accountId: params.baseContext.accountId,
    approvalKind: params.approvalKind,
    request: params.request,
    nativeAdapter: params.nativeAdapter,
  });
  const deliveredKeys = new Set<string>();
  const wrappedEntries: WrappedPendingEntry[] = [];
  for (const plannedTarget of plannedTargets) {
    try {
      const preparedTarget = await params.nativeRuntime.transport.prepareTarget({
        ...params.baseContext,
        plannedTarget,
        request: params.request,
        approvalKind: params.approvalKind,
        view: params.pendingContent.view,
        pendingPayload: params.pendingContent.payload,
      });
      if (!preparedTarget) {
        continue;
      }
      if (deliveredKeys.has(preparedTarget.dedupeKey)) {
        params.nativeRuntime.observe?.onDuplicateSkipped?.({
          ...params.baseContext,
          plannedTarget,
          preparedTarget: preparedTarget as PreparedChannelNativeApprovalTarget<unknown>,
          request: params.request,
          approvalKind: params.approvalKind,
          view: params.pendingContent.view,
          pendingPayload: params.pendingContent.payload,
        });
        continue;
      }
      const entry = await params.nativeRuntime.transport.deliverPending({
        ...params.baseContext,
        plannedTarget,
        preparedTarget: preparedTarget.target,
        request: params.request,
        approvalKind: params.approvalKind,
        view: params.pendingContent.view,
        pendingPayload: params.pendingContent.payload,
      });
      if (!entry) {
        continue;
      }
      deliveredKeys.add(preparedTarget.dedupeKey);
      if (params.stopped()) {
        await params.nativeRuntime.interactions?.cancelDelivered?.({
          ...params.baseContext,
          entry,
          request: params.request,
          approvalKind: params.approvalKind,
        });
        continue;
      }
      const binding = await params.nativeRuntime.interactions?.bindPending?.({
        ...params.baseContext,
        entry,
        request: params.request,
        approvalKind: params.approvalKind,
        view: params.pendingContent.view,
        pendingPayload: params.pendingContent.payload,
      });
      if (params.stopped()) {
        if (binding !== undefined && binding !== null) {
          await params.nativeRuntime.interactions?.unbindPending?.({
            ...params.baseContext,
            entry,
            binding,
            request: params.request,
            approvalKind: params.approvalKind,
          });
        } else {
          await params.nativeRuntime.interactions?.cancelDelivered?.({
            ...params.baseContext,
            entry,
            request: params.request,
            approvalKind: params.approvalKind,
          });
        }
        continue;
      }
      const wrapped: WrappedPendingEntry = {
        entry,
        ...(binding === undefined || binding === null ? {} : { binding }),
      };
      const activeRequest = params.activeEntries.get(params.request.id) ?? {
        request: params.request,
        approvalKind: params.approvalKind,
        entries: [],
      };
      activeRequest.entries.push(wrapped);
      params.activeEntries.set(params.request.id, activeRequest);
      wrappedEntries.push(wrapped);
      params.nativeRuntime.observe?.onDelivered?.({
        ...params.baseContext,
        plannedTarget,
        preparedTarget: preparedTarget as PreparedChannelNativeApprovalTarget<unknown>,
        request: params.request,
        approvalKind: params.approvalKind,
        view: params.pendingContent.view,
        pendingPayload: params.pendingContent.payload,
        entry,
      });
    } catch (error) {
      params.nativeRuntime.observe?.onDeliveryError?.({
        ...params.baseContext,
        error,
        plannedTarget,
        request: params.request,
        approvalKind: params.approvalKind,
        view: params.pendingContent.view,
        pendingPayload: params.pendingContent.payload,
      });
    }
  }
  return wrappedEntries;
}

export async function createChannelApprovalHandlerFromCapability(params: {
  capability?: Pick<ChannelApprovalCapability, "native" | "nativeRuntime"> | null;
  label: string;
  clientDisplayName: string;
  channel: string;
  channelLabel: string;
  cfg: CoreBlowConfig;
  accountId?: string | null;
  gatewayUrl?: string;
  context?: unknown;
  channelRuntime?: unknown;
  nowMs?: () => number;
}): Promise<ChannelApprovalHandler | null> {
  const capability = params.capability;
  const candidateRuntime = capability?.nativeRuntime;
  if (!candidateRuntime) {
    return null;
  }
  if (isLegacyApprovalRuntimeCapability(candidateRuntime)) {
    const legacyHandler = await candidateRuntime.startHandler?.({
      cfg: params.cfg,
      accountId: params.accountId ?? "",
      context: params.context,
      channelRuntime: params.channelRuntime,
    });
    if (!legacyHandler) {
      return null;
    }
    return {
      start: async () => {},
      stop: async () => {
        await legacyHandler.stop();
      },
      handleRequested: async () => {},
      handleResolved: async () => {},
      handleExpired: async () => {},
      request: async () => {
        throw new Error(`${params.label}: legacy approval handler is not gateway-backed`);
      },
    };
  }
  if (!isNativeRuntimeAdapter(candidateRuntime)) {
    return null;
  }

  const nativeRuntime = candidateRuntime;
  const log = createSubsystemLogger(params.label);
  const activeEntries = new Map<string, ActiveApprovalEntries>();
  let stopped = false;
  const resolveApprovalKind = nativeRuntime.resolveApprovalKind ?? defaultResolveApprovalKind;
  const baseContext: ChannelApprovalCapabilityHandlerContext = {
    cfg: params.cfg,
    accountId: params.accountId,
    gatewayUrl: params.gatewayUrl,
    context: params.context,
  };

  return createExecApprovalChannelRuntime<WrappedPendingEntry, ApprovalRequest, ApprovalResolved>({
    label: params.label,
    clientDisplayName: params.clientDisplayName,
    cfg: params.cfg,
    gatewayUrl: params.gatewayUrl,
    eventKinds: nativeRuntime.eventKinds,
    isConfigured: () => nativeRuntime.availability.isConfigured(baseContext),
    shouldHandle: (request) => nativeRuntime.availability.shouldHandle({ ...baseContext, request }),
    nowMs: params.nowMs,
    deliverRequested: async (request) => {
      const approvalKind = resolveApprovalKind(request);
      const view = buildPendingApprovalView(request);
      const pendingContent: WrappedPendingContent = {
        view,
        payload: await nativeRuntime.presentation.buildPendingPayload({
          ...baseContext,
          request,
          approvalKind,
          nowMs: params.nowMs?.() ?? Date.now(),
          view,
        }),
      };
      return await deliverPendingContent({
        nativeRuntime,
        baseContext,
        nativeAdapter: capability.native as ChannelApprovalNativeAdapter | null,
        request,
        approvalKind,
        pendingContent,
        stopped: () => stopped,
        activeEntries,
      });
    },
    finalizeResolved: async ({ request, resolved, entries }) => {
      const resolvedEntries = consumeActiveWrappedEntries(activeEntries, request.id, entries);
      const view = buildResolvedApprovalView(request, resolved);
      await finalizeWrappedEntries({
        entries: resolvedEntries,
        phase: "resolved",
        request,
        log,
        runEntry: async (wrapped) => {
          const approvalKind = resolveApprovalKind(request);
          if (wrapped.binding !== undefined) {
            await nativeRuntime.interactions?.unbindPending?.({
              ...baseContext,
              entry: wrapped.entry,
              binding: wrapped.binding,
              request,
              approvalKind,
            });
          }
          const result = await nativeRuntime.presentation.buildResolvedResult({
            ...baseContext,
            request,
            resolved,
            view,
            entry: wrapped.entry,
          });
          await applyApprovalFinalAction({
            nativeRuntime,
            baseContext,
            wrapped,
            result,
            phase: "resolved",
          });
        },
      });
    },
    finalizeExpired: async ({ request, entries }) => {
      const expiredEntries = consumeActiveWrappedEntries(activeEntries, request.id, entries);
      const view = buildExpiredApprovalView(request);
      await finalizeWrappedEntries({
        entries: expiredEntries,
        phase: "expired",
        request,
        log,
        runEntry: async (wrapped) => {
          const approvalKind = resolveApprovalKind(request);
          if (wrapped.binding !== undefined) {
            await nativeRuntime.interactions?.unbindPending?.({
              ...baseContext,
              entry: wrapped.entry,
              binding: wrapped.binding,
              request,
              approvalKind,
            });
          }
          const result = await nativeRuntime.presentation.buildExpiredResult({
            ...baseContext,
            request,
            view,
            entry: wrapped.entry,
          });
          await applyApprovalFinalAction({
            nativeRuntime,
            baseContext,
            wrapped,
            result,
            phase: "expired",
          });
        },
      });
    },
    onStopped: async () => {
      stopped = true;
      if (activeEntries.size === 0) {
        activeEntries.clear();
        return;
      }
      for (const activeRequest of activeEntries.values()) {
        await unbindWrappedEntries({
          entries: activeRequest.entries,
          request: activeRequest.request,
          approvalKind: activeRequest.approvalKind,
          baseContext,
          nativeRuntime,
          log,
        });
      }
      activeEntries.clear();
    },
  });
}
