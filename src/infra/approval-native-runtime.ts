import type { ChannelApprovalNativeAdapter } from "../channels/plugins/approval-native.types.js";
import type { CoreBlowConfig } from "../config/config.js";
import { buildChannelApprovalNativeTargetKey } from "./approval-native-target-key.js";
import type {
  ChannelApprovalNativeDeliveryPlan,
  ChannelApprovalNativePlannedTarget,
} from "./approval-handler-runtime-types.js";
import type {
  ChannelNativeApprovalDeliveryCallbacks,
  ChannelNativeApprovalTransportSpec,
  PreparedChannelNativeApprovalTarget,
} from "./approval-native-runtime-types.js";
import type { ChannelApprovalKind } from "./approval-types.js";
import {
  createExecApprovalChannelRuntime,
  type ExecApprovalChannelRuntime,
  type ExecApprovalChannelRuntimeAdapter,
} from "./exec-approval-channel-runtime.js";
import type { ExecApprovalChannelRuntimeEventKind } from "./exec-approval-channel-runtime.types.js";
import type { ExecApprovalRequest, ExecApprovalResolved } from "./exec-approvals.js";
import type { PluginApprovalRequest, PluginApprovalResolved } from "./plugin-approvals.js";

type ApprovalRequest = ExecApprovalRequest | PluginApprovalRequest;
type ApprovalResolved = ExecApprovalResolved | PluginApprovalResolved;

export type { PreparedChannelNativeApprovalTarget } from "./approval-native-runtime-types.js";
export type { ChannelApprovalNativeDeliveryPlan } from "./approval-handler-runtime-types.js";

type ChannelNativeApprovalPlanDeliveryResult<TPendingEntry> = {
  entries: TPendingEntry[];
  deliveryPlan: ChannelApprovalNativeDeliveryPlan;
  deliveredTargets: ChannelApprovalNativePlannedTarget[];
};

function dedupeTargets(
  targets: ChannelApprovalNativePlannedTarget[],
): ChannelApprovalNativePlannedTarget[] {
  const seen = new Set<string>();
  const deduped: ChannelApprovalNativePlannedTarget[] = [];
  for (const target of targets) {
    const key = buildChannelApprovalNativeTargetKey(target.target);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(target);
  }
  return deduped;
}

export async function resolveChannelNativeApprovalDeliveryPlan(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  approvalKind: ChannelApprovalKind;
  request: ApprovalRequest;
  adapter?: ChannelApprovalNativeAdapter | null;
}): Promise<ChannelApprovalNativeDeliveryPlan> {
  const adapter = params.adapter;
  if (!adapter) {
    return {
      targets: [],
      originTarget: null,
      notifyOriginWhenDmOnly: false,
    };
  }

  const capabilities = adapter.describeDeliveryCapabilities({
    cfg: params.cfg,
    accountId: params.accountId,
    approvalKind: params.approvalKind,
    request: params.request,
  });
  if (!capabilities.enabled) {
    return {
      targets: [],
      originTarget: null,
      notifyOriginWhenDmOnly: false,
    };
  }

  const originTarget =
    capabilities.supportsOriginSurface && adapter.resolveOriginTarget
      ? ((await adapter.resolveOriginTarget({
          cfg: params.cfg,
          accountId: params.accountId,
          approvalKind: params.approvalKind,
          request: params.request,
        })) ?? null)
      : null;
  const approverDmTargets =
    capabilities.supportsApproverDmSurface && adapter.resolveApproverDmTargets
      ? await adapter.resolveApproverDmTargets({
          cfg: params.cfg,
          accountId: params.accountId,
          approvalKind: params.approvalKind,
          request: params.request,
        })
      : [];

  const plannedTargets: ChannelApprovalNativePlannedTarget[] = [];
  const preferOrigin =
    capabilities.preferredSurface === "origin" || capabilities.preferredSurface === "both";
  const preferApproverDm =
    capabilities.preferredSurface === "approver-dm" || capabilities.preferredSurface === "both";

  if (preferOrigin && originTarget) {
    plannedTargets.push({
      surface: "origin",
      target: originTarget,
      reason: "preferred",
    });
  }

  if (preferApproverDm) {
    for (const target of approverDmTargets) {
      plannedTargets.push({
        surface: "approver-dm",
        target,
        reason: "preferred",
      });
    }
  } else if (!originTarget) {
    for (const target of approverDmTargets) {
      plannedTargets.push({
        surface: "approver-dm",
        target,
        reason: "fallback",
      });
    }
  }

  return {
    targets: dedupeTargets(plannedTargets),
    originTarget,
    notifyOriginWhenDmOnly:
      capabilities.preferredSurface === "approver-dm" &&
      capabilities.notifyOriginWhenDmOnly === true &&
      originTarget !== null,
  };
}

export async function deliverApprovalRequestViaChannelNativePlan<
  TPreparedTarget,
  TPendingEntry,
  TRequest extends ApprovalRequest = ApprovalRequest,
>(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  approvalKind: ChannelApprovalKind;
  request: TRequest;
  adapter?: ChannelApprovalNativeAdapter | null;
  prepareTarget: (params: {
    plannedTarget: ChannelApprovalNativePlannedTarget;
    request: TRequest;
  }) =>
    | PreparedChannelNativeApprovalTarget<TPreparedTarget>
    | null
    | Promise<PreparedChannelNativeApprovalTarget<TPreparedTarget> | null>;
  deliverTarget: (params: {
    plannedTarget: ChannelApprovalNativePlannedTarget;
    preparedTarget: TPreparedTarget;
    request: TRequest;
  }) => TPendingEntry | null | Promise<TPendingEntry | null>;
  onDeliveryError?: (params: {
    error: unknown;
    plannedTarget: ChannelApprovalNativePlannedTarget;
    request: TRequest;
  }) => void;
  onDuplicateSkipped?: (params: {
    plannedTarget: ChannelApprovalNativePlannedTarget;
    preparedTarget: PreparedChannelNativeApprovalTarget<TPreparedTarget>;
    request: TRequest;
  }) => void;
  onDelivered?: (params: {
    plannedTarget: ChannelApprovalNativePlannedTarget;
    preparedTarget: PreparedChannelNativeApprovalTarget<TPreparedTarget>;
    request: TRequest;
    entry: TPendingEntry;
  }) => void;
}): Promise<ChannelNativeApprovalPlanDeliveryResult<TPendingEntry>> {
  const deliveryPlan = await resolveChannelNativeApprovalDeliveryPlan({
    cfg: params.cfg,
    accountId: params.accountId,
    approvalKind: params.approvalKind,
    request: params.request,
    adapter: params.adapter,
  });

  const deliveredKeys = new Set<string>();
  const pendingEntries: TPendingEntry[] = [];
  const deliveredTargets: ChannelApprovalNativePlannedTarget[] = [];
  for (const plannedTarget of deliveryPlan.targets) {
    try {
      const preparedTarget = await params.prepareTarget({
        plannedTarget,
        request: params.request,
      });
      if (!preparedTarget) {
        continue;
      }
      if (deliveredKeys.has(preparedTarget.dedupeKey)) {
        params.onDuplicateSkipped?.({
          plannedTarget,
          preparedTarget,
          request: params.request,
        });
        continue;
      }

      const entry = await params.deliverTarget({
        plannedTarget,
        preparedTarget: preparedTarget.target,
        request: params.request,
      });
      if (!entry) {
        continue;
      }

      deliveredKeys.add(preparedTarget.dedupeKey);
      pendingEntries.push(entry);
      deliveredTargets.push(plannedTarget);
      params.onDelivered?.({
        plannedTarget,
        preparedTarget,
        request: params.request,
        entry,
      });
    } catch (error) {
      params.onDeliveryError?.({
        error,
        plannedTarget,
        request: params.request,
      });
    }
  }

  return {
    entries: pendingEntries,
    deliveryPlan,
    deliveredTargets,
  };
}

function defaultResolveApprovalKind(request: ApprovalRequest): ChannelApprovalKind {
  return request.id.startsWith("plugin:") ? "plugin" : "exec";
}

type ChannelNativeApprovalRuntimeAdapter<
  TPendingEntry,
  TPreparedTarget,
  TPendingContent,
  TRequest extends ApprovalRequest = ApprovalRequest,
  TResolved extends ApprovalResolved = ApprovalResolved,
> = Omit<
  ExecApprovalChannelRuntimeAdapter<TPendingEntry, TRequest, TResolved>,
  "deliverRequested"
> &
  ChannelNativeApprovalTransportSpec<TPendingEntry, TPreparedTarget, TPendingContent, TRequest> &
  ChannelNativeApprovalDeliveryCallbacks<
    TPendingEntry,
    TPreparedTarget,
    TPendingContent,
    TRequest
  > & {
    channel?: string;
    channelLabel?: string;
    accountId?: string | null;
    nativeAdapter?: ChannelApprovalNativeAdapter | null;
    resolveApprovalKind?: (request: TRequest) => ChannelApprovalKind;
    buildPendingContent: (params: {
      request: TRequest;
      approvalKind: ChannelApprovalKind;
      nowMs: number;
    }) => TPendingContent | Promise<TPendingContent>;
    onStopped?: () => Promise<void> | void;
  };

export function createChannelNativeApprovalRuntime<
  TPendingEntry,
  TPreparedTarget,
  TPendingContent,
  TRequest extends ApprovalRequest = ApprovalRequest,
  TResolved extends ApprovalResolved = ApprovalResolved,
>(
  adapter: ChannelNativeApprovalRuntimeAdapter<
    TPendingEntry,
    TPreparedTarget,
    TPendingContent,
    TRequest,
    TResolved
  >,
): ExecApprovalChannelRuntime<TRequest, TResolved> {
  const nowMs = adapter.nowMs ?? Date.now;
  const resolveApprovalKind =
    adapter.resolveApprovalKind ?? ((request: TRequest) => defaultResolveApprovalKind(request));

  return createExecApprovalChannelRuntime<TPendingEntry, TRequest, TResolved>({
    label: adapter.label,
    clientDisplayName: adapter.clientDisplayName,
    cfg: adapter.cfg,
    gatewayUrl: adapter.gatewayUrl,
    eventKinds: adapter.eventKinds,
    isConfigured: adapter.isConfigured,
    shouldHandle: adapter.shouldHandle,
    finalizeResolved: adapter.finalizeResolved,
    finalizeExpired: adapter.finalizeExpired,
    onStopped: adapter.onStopped,
    nowMs,
    deliverRequested: async (request) => {
      const approvalKind = resolveApprovalKind(request);
      const pendingContent = await adapter.buildPendingContent({
        request,
        approvalKind,
        nowMs: nowMs(),
      });
      const deliveryResult = await deliverApprovalRequestViaChannelNativePlan({
        cfg: adapter.cfg,
        accountId: adapter.accountId,
        approvalKind,
        request,
        adapter: adapter.nativeAdapter,
        prepareTarget: async ({ plannedTarget, request }) =>
          await adapter.prepareTarget({
            plannedTarget,
            request,
            approvalKind,
            pendingContent,
          }),
        deliverTarget: async ({ plannedTarget, preparedTarget, request }) =>
          await adapter.deliverTarget({
            plannedTarget,
            preparedTarget,
            request,
            approvalKind,
            pendingContent,
          }),
        onDeliveryError: adapter.onDeliveryError
          ? ({ error, plannedTarget, request }) => {
              adapter.onDeliveryError?.({
                error,
                plannedTarget,
                request,
                approvalKind,
                pendingContent,
              });
            }
          : undefined,
        onDuplicateSkipped: adapter.onDuplicateSkipped
          ? ({ plannedTarget, preparedTarget, request }) => {
              adapter.onDuplicateSkipped?.({
                plannedTarget,
                preparedTarget,
                request,
                approvalKind,
                pendingContent,
              });
            }
          : undefined,
        onDelivered: adapter.onDelivered
          ? ({ plannedTarget, preparedTarget, request, entry }) => {
              adapter.onDelivered?.({
                plannedTarget,
                preparedTarget,
                request,
                approvalKind,
                pendingContent,
                entry,
              });
            }
          : undefined,
      });
      return deliveryResult.entries;
    },
  });
}
