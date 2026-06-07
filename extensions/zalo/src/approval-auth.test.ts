import { describe, expect, it } from "vitest";
import { zaloApprovalAuth } from "./approval-auth.js";

describe("zalo approval auth", () => {
  it("authorizes configured approvers", () => {
    const result = zaloApprovalAuth.authorizeActorAction({
      cfg: { channels: { zalo: { allowFrom: ["zalo:123"] } } },
      senderId: "123",
      action: "approve",
      approvalKind: "exec",
    });
    expect(result.authorized).toBe(true);
  });
});
