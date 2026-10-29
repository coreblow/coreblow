import type { ExecApprovalReplyDecision } from "coreblow/plugin-sdk/approval-reply-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";

const approvalGatewayRuntimeHoisted = vi.hoisted(() => ({
  resolveApprovalOverGatewaySpy: vi.fn(),
}));

vi.mock("coreblow/plugin-sdk/approval-gateway-runtime", () => ({
  resolveApprovalOverGateway: (...args: unknown[]) =>
    approvalGatewayRuntimeHoisted.resolveApprovalOverGatewaySpy(...args),
}));

describe("resolveTelegramExecApproval", () => {
  async function invokeResolver(params: {
    approvalId: string;
    decision: ExecApprovalReplyDecision;
    senderId: string;
    allowPluginFallback?: boolean;
  }) {
    const { resolveTelegramExecApproval } = await import("./exec-approval-resolver.js");

    await resolveTelegramExecApproval({
      cfg: {} as never,
      gatewayUrl: undefined,
      ...params,
    });
  }

  function expectApprovalGatewayCall(params: {
    approvalId: string;
    decision: ExecApprovalReplyDecision;
    senderId: string;
    allowPluginFallback?: boolean;
  }) {
    expect(approvalGatewayRuntimeHoisted.resolveApprovalOverGatewaySpy).toHaveBeenCalledWith({
      cfg: {} as never,
      approvalId: params.approvalId,
      decision: params.decision,
      senderId: params.senderId,
      gatewayUrl: undefined,
      allowPluginFallback: params.allowPluginFallback,
      clientDisplayName: `Telegram approval (${params.senderId})`,
    });
  }

  beforeEach(() => {
    approvalGatewayRuntimeHoisted.resolveApprovalOverGatewaySpy
      .mockReset()
      .mockResolvedValue(undefined);
  });

  it("forwards telegram approval resolution through gateway approval helper", async () => {
    await invokeResolver({
      approvalId: "appr-1",
      decision: "allow-once",
      senderId: "tg:12345",
    });

    expectApprovalGatewayCall({
      approvalId: "appr-1",
      decision: "allow-once",
      senderId: "tg:12345",
      allowPluginFallback: undefined,
    });
  });

  it("preserves allowPluginFallback flag when provided", async () => {
    await invokeResolver({
      approvalId: "appr-2",
      decision: "deny",
      senderId: "tg:admin",
      allowPluginFallback: true,
    });

    expectApprovalGatewayCall({
      approvalId: "appr-2",
      decision: "deny",
      senderId: "tg:admin",
      allowPluginFallback: true,
    });
  });
});
