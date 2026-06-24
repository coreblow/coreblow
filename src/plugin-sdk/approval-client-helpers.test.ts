import { describe, expect, it } from "vitest";
import {
  createChannelExecApprovalProfile,
  isChannelExecApprovalClientEnabledFromConfig,
} from "./approval-client-helpers.js";

describe("approval client helpers", () => {
  it("requires enabled config and configured approvers", () => {
    expect(
      isChannelExecApprovalClientEnabledFromConfig({ enabled: "auto", approverCount: 1 }),
    ).toBe(true);
    expect(isChannelExecApprovalClientEnabledFromConfig({ enabled: true, approverCount: 0 })).toBe(
      false,
    );
  });

  it("builds a reusable channel approval profile", () => {
    const profile = createChannelExecApprovalProfile({
      resolveConfig: () => ({ enabled: true, target: "both" }),
      resolveApprovers: () => ["owner"],
    });
    expect(profile.isApprover({ cfg: {}, senderId: "owner" })).toBe(true);
    expect(profile.isAuthorizedSender({ cfg: {}, senderId: "other" })).toBe(false);
    expect(profile.resolveTarget({ cfg: {} })).toBe("both");
  });
});
