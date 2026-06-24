import type { ReplyPayload } from "../auto-reply/types.js";
import type { CoreBlowConfig } from "../config/config.js";
import type { ExecApprovalForwardTarget } from "../config/types.approvals.js";
import { matchesApprovalRequestFilters } from "../infra/approval-request-filters.js";
import { getExecApprovalReplyMetadata } from "../infra/exec-approval-reply.js";
import type { ExecApprovalRequest } from "../infra/exec-approvals.js";
import type { PluginApprovalRequest } from "../infra/plugin-approvals.js";
import {
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "../shared/string-coerce.js";
import { normalizeAccountId } from "./routing.js";

type ApprovalRequest = ExecApprovalRequest | PluginApprovalRequest;
type ApprovalTarget = "dm" | "channel" | "both";
type ChannelApprovalConfig = {
  enabled?: boolean | "auto";
  target?: ApprovalTarget;
  agentFilter?: string[];
  sessionFilter?: string[];
};
type ApprovalProfileParams = { cfg: CoreBlowConfig; accountId?: string | null };

function isApprovalTargetsMode(cfg: CoreBlowConfig): boolean {
  const execApprovals = cfg.approvals?.exec;
  return Boolean(
    execApprovals?.enabled &&
      (execApprovals.mode === "targets" || execApprovals.mode === "both"),
  );
}

export { getExecApprovalReplyMetadata, matchesApprovalRequestFilters };

export function isChannelExecApprovalClientEnabledFromConfig(params: {
  enabled?: boolean | "auto";
  approverCount: number;
}): boolean {
  return params.approverCount > 0 && (params.enabled === true || params.enabled === "auto");
}

export function isChannelExecApprovalTargetRecipient(params: {
  cfg: CoreBlowConfig;
  senderId?: string | null;
  accountId?: string | null;
  channel: string;
  normalizeSenderId?: (value: string) => string | undefined;
  matchTarget: (params: {
    target: ExecApprovalForwardTarget;
    normalizedSenderId: string;
    normalizedAccountId?: string;
  }) => boolean;
}): boolean {
  const normalizeSenderId = params.normalizeSenderId ?? normalizeOptionalString;
  const senderId = params.senderId ? normalizeSenderId(params.senderId) : undefined;
  const channel = normalizeOptionalLowercaseString(params.channel);
  const targets = params.cfg.approvals?.exec?.targets;
  if (!senderId || !isApprovalTargetsMode(params.cfg) || !targets) {
    return false;
  }
  const accountId = params.accountId ? normalizeAccountId(params.accountId) : undefined;
  return targets.some((target) => {
    if (normalizeOptionalLowercaseString(target.channel) !== channel) {
      return false;
    }
    if (accountId && target.accountId && normalizeAccountId(target.accountId) !== accountId) {
      return false;
    }
    return params.matchTarget({
      target,
      normalizedSenderId: senderId,
      normalizedAccountId: accountId,
    });
  });
}

export function createChannelExecApprovalProfile(params: {
  resolveConfig: (params: ApprovalProfileParams) => ChannelApprovalConfig | undefined;
  resolveApprovers: (params: ApprovalProfileParams) => string[];
  normalizeSenderId?: (value: string) => string | undefined;
  isTargetRecipient?: (params: ApprovalProfileParams & { senderId?: string | null }) => boolean;
  matchesRequestAccount?: (params: ApprovalProfileParams & { request: ApprovalRequest }) => boolean;
  fallbackAgentIdFromSessionKey?: boolean;
  requireClientEnabledForLocalPromptSuppression?: boolean;
}) {
  const normalizeSenderId = params.normalizeSenderId ?? normalizeOptionalString;
  const isClientEnabled = (input: ApprovalProfileParams): boolean => {
    const config = params.resolveConfig(input);
    return isChannelExecApprovalClientEnabledFromConfig({
      enabled: config?.enabled,
      approverCount: params.resolveApprovers(input).length,
    });
  };
  const isApprover = (input: ApprovalProfileParams & { senderId?: string | null }): boolean => {
    const senderId = input.senderId ? normalizeSenderId(input.senderId) : undefined;
    return Boolean(senderId && params.resolveApprovers(input).includes(senderId));
  };
  const isAuthorizedSender = (
    input: ApprovalProfileParams & { senderId?: string | null },
  ): boolean => isApprover(input) || (params.isTargetRecipient?.(input) ?? false);
  const resolveTarget = (input: ApprovalProfileParams): ApprovalTarget =>
    params.resolveConfig(input)?.target ?? "dm";
  const shouldHandleRequest = (
    input: ApprovalProfileParams & { request: ApprovalRequest },
  ): boolean => {
    if (params.matchesRequestAccount && !params.matchesRequestAccount(input)) {
      return false;
    }
    const config = params.resolveConfig(input);
    return (
      isChannelExecApprovalClientEnabledFromConfig({
        enabled: config?.enabled,
        approverCount: params.resolveApprovers(input).length,
      }) &&
      matchesApprovalRequestFilters({
        request: input.request.request,
        agentFilter: config?.agentFilter,
        sessionFilter: config?.sessionFilter,
        fallbackAgentIdFromSessionKey: params.fallbackAgentIdFromSessionKey === true,
      })
    );
  };
  const shouldSuppressLocalPrompt = (
    input: ApprovalProfileParams & { payload: ReplyPayload },
  ): boolean =>
    (params.requireClientEnabledForLocalPromptSuppression === false || isClientEnabled(input)) &&
    getExecApprovalReplyMetadata(input.payload) !== null;
  return {
    isClientEnabled,
    isApprover,
    isAuthorizedSender,
    resolveTarget,
    shouldHandleRequest,
    shouldSuppressLocalPrompt,
  };
}
