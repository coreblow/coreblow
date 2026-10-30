import { resolveApprovalOverGateway } from "coreblow/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "coreblow/plugin-sdk/approval-runtime";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-contracts";
import { isApprovalNotFoundError } from "coreblow/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveMatrixApproval(params: {
  cfg: CoreBlowConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  gatewayUrl?: string;
}): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: `Matrix approval (${params.senderId?.trim() || "unknown"})`,
  });
}
