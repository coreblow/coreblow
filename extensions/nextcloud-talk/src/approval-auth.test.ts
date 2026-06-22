import { describe, expect, it } from "vitest";
import { nextcloudTalkApprovalAuth, normalizeNextcloudTalkApproverId } from "./approval-auth.js";

describe("nextcloud-talk approval authorization", () => {
  it("normalizes channel prefixes and rejects non-approvers", () => {
    expect(normalizeNextcloudTalkApproverId("NC:Alice")).toBe("alice");
    const cfg = { channels: { "nextcloud-talk": { allowFrom: ["nextcloud-talk:alice"] } } };
    expect(nextcloudTalkApprovalAuth.authorizeActorAction({ cfg, action: "approve", approvalKind: "exec", senderId: "ALICE" }).authorized).toBe(true);
    expect(nextcloudTalkApprovalAuth.authorizeActorAction({ cfg, action: "approve", approvalKind: "exec", senderId: "mallory" }).authorized).toBe(false);
  });
});
