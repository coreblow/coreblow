import { getChannelPlugin } from "../channels/plugins/index.js";
import type { ChannelApprovalCapability } from "../channels/plugins/types.adapters.js";
import type { CoreBlowConfig } from "../config/config.js";
import {
  type ApprovalAuthorizationResult,
  isImplicitSameChatApprovalAuthorization,
} from "../plugin-sdk/approval-auth-helpers.js";
import { normalizeMessageChannel } from "../utils/message-channel.js";

type ApprovalKind = "exec" | "plugin";

type ApprovalCommandAuthorization = {
  authorized: boolean;
  reason?: string;
  explicit: boolean;
};

type ApprovalActionAvailabilityState = {
  kind?: string;
};

type ApprovalActorActionAuthorizer = (params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  senderId?: string | null;
  action: "approve";
  approvalKind: ApprovalKind;
}) => ApprovalAuthorizationResult | null | undefined;

type ApprovalActionAvailabilityResolver = (params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  action: "approve";
  approvalKind: ApprovalKind;
}) => ApprovalActionAvailabilityState | null | undefined;

function resolveApprovalCapability(
  channel: string,
): Pick<ChannelApprovalCapability, "authorizeActorAction" | "getActionAvailabilityState"> | undefined {
  return getChannelPlugin(channel)?.approvalCapability;
}

function asApprovalActorActionAuthorizer(value: unknown): ApprovalActorActionAuthorizer | undefined {
  return typeof value === "function" ? (value as ApprovalActorActionAuthorizer) : undefined;
}

function asApprovalActionAvailabilityResolver(
  value: unknown,
): ApprovalActionAvailabilityResolver | undefined {
  return typeof value === "function" ? (value as ApprovalActionAvailabilityResolver) : undefined;
}

export function resolveApprovalCommandAuthorization(params: {
  cfg: CoreBlowConfig;
  channel?: string | null;
  accountId?: string | null;
  senderId?: string | null;
  kind: ApprovalKind;
}): ApprovalCommandAuthorization {
  const channel = normalizeMessageChannel(params.channel);
  if (!channel) {
    return { authorized: true, explicit: false };
  }

  const approvalCapability = resolveApprovalCapability(channel);
  const authorizeActorAction = asApprovalActorActionAuthorizer(
    approvalCapability?.authorizeActorAction,
  );
  const resolved = authorizeActorAction?.({
    cfg: params.cfg,
    accountId: params.accountId,
    senderId: params.senderId,
    action: "approve",
    approvalKind: params.kind,
  });
  if (!resolved) {
    return { authorized: true, explicit: false };
  }

  const implicitSameChatAuthorization = isImplicitSameChatApprovalAuthorization(resolved);
  const getActionAvailabilityState = asApprovalActionAvailabilityResolver(
    approvalCapability?.getActionAvailabilityState,
  );
  const availability = getActionAvailabilityState?.({
    cfg: params.cfg,
    accountId: params.accountId,
    action: "approve",
    approvalKind: params.kind,
  });
  return {
    authorized: resolved.authorized,
    reason: resolved.reason,
    explicit: resolved.authorized
      ? !implicitSameChatAuthorization && availability?.kind !== "disabled"
      : true,
  };
}
