import type { CoreBlowConfig } from "./runtime-api.js";
import { resolveZaloAccount } from "./accounts.js";

function normalizeZaloApproverId(value: string | number): string | undefined {
  const normalized = String(value).trim().replace(/^(zalo|zl):/i, "").trim();
  return /^\d+$/.test(normalized) ? normalized : undefined;
}

function resolveApprovers(params: { cfg: CoreBlowConfig; accountId?: string | null }): string[] {
  const { cfg, accountId } = params;
  return (resolveZaloAccount({ cfg, accountId }).config.allowFrom ?? [])
    .map((entry) => normalizeZaloApproverId(entry))
    .filter((entry): entry is string => Boolean(entry));
}

export const zaloApprovalAuth = {
  authorizeActorAction(params: {
    cfg: CoreBlowConfig;
    accountId?: string | null;
    senderId?: string | null;
    action: "approve";
    approvalKind: "exec" | "plugin";
  }) {
    const approvers = resolveApprovers(params);
    if (approvers.length === 0) {
      return { authorized: true } as const;
    }
    const senderId = params.senderId ? normalizeZaloApproverId(params.senderId) : undefined;
    if (senderId && approvers.includes(senderId)) {
      return { authorized: true } as const;
    }
    return {
      authorized: false,
      reason: `You are not authorized to approve ${params.approvalKind} requests on Zalo.`,
    } as const;
  },
};
