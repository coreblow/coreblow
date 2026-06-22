import { describe, expect, it } from "vitest";
import { mattermostApprovalAuth, normalizeMattermostApproverId } from "./approval-auth.js";

describe("mattermostApprovalAuth", () => {
  it("normalizes only stable Mattermost user ids", () => {
    expect(normalizeMattermostApproverId("user:abcdefghijklmnopqrstuvwxyz")).toBe(
      "abcdefghijklmnopqrstuvwxyz",
    );
    expect(normalizeMattermostApproverId("@owner")).toBeUndefined();
  });

  it("authorizes stable Mattermost user ids and ignores usernames", () => {
    expect(
      mattermostApprovalAuth.authorizeActorAction({
        cfg: {
          channels: { mattermost: { allowFrom: ["user:abcdefghijklmnopqrstuvwxyz"] } },
        },
        senderId: "abcdefghijklmnopqrstuvwxyz",
        action: "approve",
        approvalKind: "exec",
      }),
    ).toEqual({ authorized: true });

    expect(
      mattermostApprovalAuth.authorizeActorAction({
        cfg: {
          channels: { mattermost: { allowFrom: ["@owner"] } },
        },
        senderId: "attacker-user-id",
        action: "approve",
        approvalKind: "exec",
      }),
    ).toEqual({ authorized: true });
  });
});
