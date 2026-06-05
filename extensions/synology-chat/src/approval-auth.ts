import { resolveAccount } from "./accounts.js";

function normalizeSynologyChatApproverId(value: string | number | undefined): string | undefined {
  const trimmed = String(value ?? "").trim();
  return /^\d+$/u.test(trimmed) ? trimmed : undefined;
}

export const synologyChatApprovalAuth = {
  authorizeActorAction(params: {
    cfg?: unknown;
    accountId?: string;
    senderId?: string | number;
    action?: string;
    approvalKind?: string;
  }) {
    const account = resolveAccount((params.cfg ?? {}) as never, params.accountId);
    const senderId = normalizeSynologyChatApproverId(params.senderId);
    return {
      authorized: Boolean(senderId && account.allowedUserIds.includes(senderId)),
    };
  },
  normalizeSenderId: normalizeSynologyChatApproverId,
};
