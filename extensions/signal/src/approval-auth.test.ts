import { describe, expect, it } from "vitest";
import { normalizeSignalApproverId, signalApprovalAuth } from "./approval-auth.js";

describe("Signal approval auth", () => {
  it("normalizes phone and UUID approvers while rejecting groups", () => {
    expect(normalizeSignalApproverId("+1 (555) 000-1111")).toBe("+15550001111");
    expect(normalizeSignalApproverId("123e4567-e89b-12d3-a456-426614174000")).toBe(
      "uuid:123e4567-e89b-12d3-a456-426614174000",
    );
    expect(normalizeSignalApproverId("group:test")).toBeUndefined();
  });

  it("authorizes configured approvers", () => {
    expect(
      signalApprovalAuth.authorizeActorAction({
        cfg: { channels: { signal: { allowFrom: ["+15550001111"] } } },
        senderId: "+15550001111",
        action: "approve",
        approvalKind: "exec",
      }),
    ).toMatchObject({ authorized: true });
  });
});
