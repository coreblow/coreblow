import { describe, expect, it } from "vitest";
import {
  buildAcpPermissionRequest,
  normalizeGatewayExecApprovalDecisions,
  parseGatewayExecApprovalEventData,
  resolveGatewayDecisionFromPermissionOutcome,
} from "./permission-relay.js";

describe("ACP permission relay", () => {
  it("normalizes gateway approval events into ACP options", () => {
    const event = parseGatewayExecApprovalEventData({
      phase: "requested",
      kind: "exec",
      status: "pending",
      approvalId: "approval-1",
      command: "pnpm test",
    });
    expect(event).not.toBeNull();
    const request = buildAcpPermissionRequest({
      sessionId: "session-1",
      event: event!,
      details: { allowedDecisions: ["allow-once", "deny"] },
    });
    expect(request.options.map((option: { optionId: string }) => option.optionId)).toEqual([
      "allow-once",
      "deny",
    ]);
    expect(resolveGatewayDecisionFromPermissionOutcome(
      { outcome: { outcome: "selected", optionId: "allow-once" } },
      request.options,
    )).toBe("allow-once");
  });

  it("uses least-privilege fallback decisions", () => {
    expect(normalizeGatewayExecApprovalDecisions(undefined)).toEqual(["allow-once", "deny"]);
  });
});
