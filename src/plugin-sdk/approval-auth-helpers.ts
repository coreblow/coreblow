import type { CoreBlowConfig } from "../config/config.js";

type ApprovalKind = "exec" | "plugin";

export type ApprovalAuthorizationResult = {
  authorized: boolean;
  reason?: string;
};

const IMPLICIT_SAME_CHAT_APPROVAL_AUTHORIZATION = Symbol(
  "coreblow.implicitSameChatApprovalAuthorization",
);

function normalizeOptionalString(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function markImplicitSameChatApprovalAuthorization(
  result: ApprovalAuthorizationResult,
): ApprovalAuthorizationResult {
  Object.defineProperty(result, IMPLICIT_SAME_CHAT_APPROVAL_AUTHORIZATION, {
    value: true,
    enumerable: false,
  });
  return result;
}

export function isImplicitSameChatApprovalAuthorization(
  result: ApprovalAuthorizationResult | null | undefined,
): boolean {
  return Boolean(
    result &&
      (
        result as ApprovalAuthorizationResult & {
          [IMPLICIT_SAME_CHAT_APPROVAL_AUTHORIZATION]?: true;
        }
      )[IMPLICIT_SAME_CHAT_APPROVAL_AUTHORIZATION],
  );
}

export function createResolvedApproverActionAuthAdapter(params: {
  channelLabel: string;
  resolveApprovers: (params: { cfg: CoreBlowConfig; accountId?: string | null }) => string[];
  normalizeSenderId?: (value: string) => string | undefined;
}) {
  const normalizeSenderId = params.normalizeSenderId ?? normalizeOptionalString;

  return {
    authorizeActorAction({
      cfg,
      accountId,
      senderId,
      approvalKind,
    }: {
      cfg: CoreBlowConfig;
      accountId?: string | null;
      senderId?: string | null;
      action: "approve";
      approvalKind: ApprovalKind;
    }) {
      const approvers = params.resolveApprovers({ cfg, accountId });
      if (approvers.length === 0) {
        return markImplicitSameChatApprovalAuthorization({ authorized: true });
      }
      const normalizedSenderId = senderId ? normalizeSenderId(senderId) : undefined;
      if (normalizedSenderId && approvers.includes(normalizedSenderId)) {
        return { authorized: true } as const;
      }
      return {
        authorized: false,
        reason: `❌ You are not authorized to approve ${approvalKind} requests on ${params.channelLabel}.`,
      } as const;
    },
  };
}
