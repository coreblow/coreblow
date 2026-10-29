import { resolveApprovalApprovers } from "coreblow/plugin-sdk/approval-auth-runtime";
import {
  createChannelExecApprovalProfile,
  isChannelExecApprovalClientEnabledFromConfig,
  isChannelExecApprovalTargetRecipient,
  matchesApprovalRequestFilters,
} from "coreblow/plugin-sdk/approval-client-runtime";
import { resolveApprovalRequestChannelAccountId } from "coreblow/plugin-sdk/approval-native-runtime";
import type {
  ExecApprovalRequest,
  PluginApprovalRequest,
} from "coreblow/plugin-sdk/approval-runtime";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import type { TelegramExecApprovalConfig } from "coreblow/plugin-sdk/config-runtime";
import type { ReplyPayload } from "coreblow/plugin-sdk/reply-runtime";
import { normalizeAccountId } from "coreblow/plugin-sdk/routing";
import { listTelegramAccountIds, resolveTelegramAccount } from "./accounts.js";
import { resolveTelegramInlineButtonsConfigScope } from "./inline-buttons.js";
import { normalizeTelegramChatId, resolveTelegramTargetChatType } from "./targets.js";

function normalizeApproverId(value: string | number): string {
  const trimmed = String(value).trim();
  return trimmed || "";
}

function normalizeTelegramDirectApproverId(value: string | number): string | undefined {
  const normalized = normalizeApproverId(value);
  const chatId = normalizeTelegramChatId(normalized);
  if (!chatId || chatId.startsWith("-")) {
    return undefined;
  }
  return chatId;
}

function resolveTelegramOwnerApprovers(cfg: CoreBlowConfig): Array<string | number> {
  const ownerAllowFrom = cfg.commands?.ownerAllowFrom;
  return Array.isArray(ownerAllowFrom) ? ownerAllowFrom : [];
}

export function resolveTelegramExecApprovalConfig(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
}): TelegramExecApprovalConfig | undefined {
  const account = resolveTelegramAccount(params);
  const config = account.config.execApprovals;
  const enabled =
    account.enabled && account.tokenSource !== "none" ? Boolean(config?.enabled) : false;
  return {
    ...config,
    enabled,
  };
}

export function getTelegramExecApprovalApprovers(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
}): string[] {
  return resolveApprovalApprovers({
    explicit: resolveTelegramExecApprovalConfig(params)?.approvers,
    allowFrom: resolveTelegramOwnerApprovers(params.cfg),
    normalizeApprover: normalizeTelegramDirectApproverId,
  });
}

export function isTelegramExecApprovalTargetRecipient(params: {
  cfg: CoreBlowConfig;
  senderId?: string | null;
  accountId?: string | null;
}): boolean {
  return isChannelExecApprovalTargetRecipient({
    ...params,
    channel: "telegram",
    matchTarget: ({ target, normalizedSenderId }) => {
      const to = target.to ? normalizeTelegramChatId(target.to) : undefined;
      if (!to || to.startsWith("-")) {
        return false;
      }
      return to === normalizedSenderId;
    },
  });
}

function countTelegramExecApprovalEligibleAccounts(params: {
  cfg: CoreBlowConfig;
  request: ExecApprovalRequest | PluginApprovalRequest;
}): number {
  return listTelegramAccountIds(params.cfg).filter((accountId) => {
    const account = resolveTelegramAccount({ cfg: params.cfg, accountId });
    if (!account.enabled || account.tokenSource === "none") {
      return false;
    }
    const config = resolveTelegramExecApprovalConfig({
      cfg: params.cfg,
      accountId,
    });
    return (
      isChannelExecApprovalClientEnabledFromConfig({
        enabled: config?.enabled,
        approverCount: getTelegramExecApprovalApprovers({ cfg: params.cfg, accountId }).length,
      }) &&
      matchesApprovalRequestFilters({
        request: params.request.request,
        agentFilter: config?.agentFilter,
        sessionFilter: config?.sessionFilter,
        fallbackAgentIdFromSessionKey: true,
      })
    );
  }).length;
}

function isExecApprovalRequest(
  request: ExecApprovalRequest | PluginApprovalRequest,
): request is ExecApprovalRequest {
  return "command" in request.request;
}

function isTargetForwardingMode(mode?: string): boolean {
  return mode === "targets" || mode === "both";
}

function matchesExplicitTelegramForwardTargetAccount(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  request: ExecApprovalRequest | PluginApprovalRequest;
}): boolean | undefined {
  const forwardingConfig = isExecApprovalRequest(params.request)
    ? params.cfg.approvals?.exec
    : params.cfg.approvals?.plugin;
  if (!forwardingConfig?.enabled || !isTargetForwardingMode(forwardingConfig.mode)) {
    return undefined;
  }
  const telegramTargets = (forwardingConfig.targets ?? []).filter(
    (target) => (target.channel ?? "").trim().toLowerCase() === "telegram",
  );
  if (telegramTargets.some((target) => !target.accountId?.trim())) {
    return undefined;
  }
  const scopedTelegramAccountIds = telegramTargets
    .map((target) => target.accountId?.trim())
    .filter((accountId): accountId is string => Boolean(accountId));
  if (scopedTelegramAccountIds.length === 0) {
    return undefined;
  }
  const normalizedAccountId = params.accountId ? normalizeAccountId(params.accountId) : "";
  return (
    Boolean(normalizedAccountId) &&
    scopedTelegramAccountIds.some(
      (accountId) => normalizeAccountId(accountId) === normalizedAccountId,
    )
  );
}

function matchesTelegramRequestAccount(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  request: ExecApprovalRequest | PluginApprovalRequest;
}): boolean {
  const explicitTargetMatch = matchesExplicitTelegramForwardTargetAccount(params);
  if (explicitTargetMatch !== undefined) {
    return explicitTargetMatch;
  }
  const turnSourceChannel = (params.request.request.turnSourceChannel ?? "").trim().toLowerCase();
  const boundAccountId = resolveApprovalRequestChannelAccountId({
    cfg: params.cfg,
    request: params.request,
    channel: "telegram",
  });
  if (turnSourceChannel && turnSourceChannel !== "telegram" && !boundAccountId) {
    return (
      countTelegramExecApprovalEligibleAccounts({
        cfg: params.cfg,
        request: params.request,
      }) <= 1
    );
  }
  return (
    !boundAccountId ||
    !params.accountId ||
    normalizeAccountId(boundAccountId) === normalizeAccountId(params.accountId)
  );
}

const telegramExecApprovalProfile = createChannelExecApprovalProfile({
  resolveConfig: resolveTelegramExecApprovalConfig,
  resolveApprovers: getTelegramExecApprovalApprovers,
  isTargetRecipient: isTelegramExecApprovalTargetRecipient,
  matchesRequestAccount: matchesTelegramRequestAccount,
  fallbackAgentIdFromSessionKey: true,
  requireClientEnabledForLocalPromptSuppression: false,
});

export const isTelegramExecApprovalClientEnabled = telegramExecApprovalProfile.isClientEnabled;
export const isTelegramExecApprovalApprover = telegramExecApprovalProfile.isApprover;
export const isTelegramExecApprovalAuthorizedSender =
  telegramExecApprovalProfile.isAuthorizedSender;
export const resolveTelegramExecApprovalTarget = telegramExecApprovalProfile.resolveTarget;
export const shouldHandleTelegramExecApprovalRequest =
  telegramExecApprovalProfile.shouldHandleRequest;

export function isTelegramExecApprovalHandlerConfigured(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
}): boolean {
  return isTelegramExecApprovalClientEnabled(params);
}

export function shouldInjectTelegramExecApprovalButtons(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  to: string;
}): boolean {
  if (!isTelegramExecApprovalClientEnabled(params)) {
    return false;
  }
  const target = resolveTelegramExecApprovalTarget(params);
  const chatType = resolveTelegramTargetChatType(params.to);
  if (chatType === "direct") {
    return target === "dm" || target === "both";
  }
  if (chatType === "group") {
    return target === "channel" || target === "both";
  }
  return target === "both";
}

function resolveExecApprovalButtonsExplicitlyDisabled(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
}): boolean {
  const capabilities = resolveTelegramAccount(params).config.capabilities;
  return resolveTelegramInlineButtonsConfigScope(capabilities) === "off";
}

export function shouldEnableTelegramExecApprovalButtons(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  to: string;
}): boolean {
  if (!shouldInjectTelegramExecApprovalButtons(params)) {
    return false;
  }
  return !resolveExecApprovalButtonsExplicitlyDisabled(params);
}

export function shouldSuppressLocalTelegramExecApprovalPrompt(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  payload: ReplyPayload;
}): boolean {
  return telegramExecApprovalProfile.shouldSuppressLocalPrompt(params);
}
