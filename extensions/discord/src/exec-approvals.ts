import { getExecApprovalReplyMetadata } from "coreblow/plugin-sdk/approval-runtime";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import type { ReplyPayload } from "coreblow/plugin-sdk/reply-runtime";
import { resolveDiscordAccount } from "./accounts.js";

export function isDiscordExecApprovalClientEnabled(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
}): boolean {
  const config = resolveDiscordAccount(params).config.execApprovals;
  return Boolean(config?.enabled && (config.approvers?.length ?? 0) > 0);
}

export function isDiscordExecApprovalApprover(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  senderId?: string | null;
}): boolean {
  const senderId = params.senderId?.trim();
  if (!senderId) {
    return false;
  }
  const approvers = resolveDiscordAccount(params).config.execApprovals?.approvers ?? [];
  return approvers.some((approverId) => String(approverId) === senderId);
}

export function shouldSuppressLocalDiscordExecApprovalPrompt(params: {
  cfg: CoreBlowConfig;
  accountId?: string | null;
  payload: ReplyPayload;
}): boolean {
  return (
    isDiscordExecApprovalClientEnabled(params) &&
    getExecApprovalReplyMetadata(params.payload) !== null
  );
}
