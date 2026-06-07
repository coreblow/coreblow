import { describe, expect, it } from "vitest";
import { normalizeGoogleChatApproverId } from "./approval-auth.js";

describe("googlechat approval auth", () => {
  it("normalizes user approver ids", () => {
    expect(normalizeGoogleChatApproverId("users/ABC123")).toBe("users/abc123");
  });
});
