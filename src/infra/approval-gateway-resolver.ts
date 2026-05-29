import type { CoreBlowConfig } from "../config/config.js";
import { withOperatorApprovalsGatewayClient } from "../gateway/operator-approvals-client.js";
import { isApprovalNotFoundError } from "./approval-errors.js";
import type { ExecApprovalDecision } from "./exec-approvals.js";

type ResolveApprovalOverGatewayParams = {
  cfg: CoreBlowConfig;
  approvalId: string;
  decision: ExecApprovalDecision;
  senderId?: string | null;
  allowPluginFallback?: boolean;
  resolveMethod?: "plugin";
  gatewayUrl?: string;
  clientDisplayName?: string;
};

export async function resolveApprovalOverGateway(
  params: ResolveApprovalOverGatewayParams,
): Promise<void> {
  await withOperatorApprovalsGatewayClient(
    {
      config: params.cfg,
      gatewayUrl: params.gatewayUrl,
      clientDisplayName:
        params.clientDisplayName ?? `Approval (${params.senderId?.trim() || "unknown"})`,
    },
    async (gatewayClient) => {
      const requestResolve = async (
        method: "exec.approval.resolve" | "plugin.approval.resolve",
      ) => {
        await gatewayClient.request(method, {
          id: params.approvalId,
          decision: params.decision,
        });
      };
      if (params.resolveMethod === "plugin" || params.approvalId.startsWith("plugin:")) {
        await requestResolve("plugin.approval.resolve");
        return;
      }
      try {
        await requestResolve("exec.approval.resolve");
      } catch (err) {
        if (!params.allowPluginFallback || !isApprovalNotFoundError(err)) {
          throw err;
        }
        await requestResolve("plugin.approval.resolve");
      }
    },
  );
}

import { createStandaloneSingleton } from "./service-patterns.js";

export class ApprovalGatewayResolverService {
  resolveApprovalOverGateway(...args: Parameters<typeof resolveApprovalOverGateway>) {
    return resolveApprovalOverGateway(...args);
  }
}

const {
  getInstance: getApprovalGatewayResolverService,
  __testing: __testing_approvalGatewayResolver,
} = createStandaloneSingleton({
  create: () => new ApprovalGatewayResolverService(),
  defaultDeps: {},
});

export { getApprovalGatewayResolverService, __testing_approvalGatewayResolver };
