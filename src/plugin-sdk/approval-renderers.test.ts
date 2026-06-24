import { describe, expect, it } from "vitest";
import {
  buildApprovalPendingReplyPayload,
  buildApprovalResolvedReplyPayload,
} from "./approval-renderers.js";

describe("approval renderers", () => {
  it("builds pending payloads with portable actions and metadata", () => {
    const payload = buildApprovalPendingReplyPayload({
      approvalId: "approval-1",
      approvalSlug: "approval",
      text: "Approval required",
    });
    expect(payload.presentation).toBeDefined();
    expect(payload.channelData?.execApproval).toMatchObject({
      approvalId: "approval-1",
      state: "pending",
    });
  });

  it("builds resolved payloads without interactive controls", () => {
    const payload = buildApprovalResolvedReplyPayload({
      approvalId: "approval-1",
      approvalSlug: "approval",
      text: "Resolved",
    });
    expect(payload.presentation).toBeUndefined();
    expect(payload.channelData?.execApproval).toMatchObject({ state: "resolved" });
  });
});
