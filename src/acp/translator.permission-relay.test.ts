import { describe, expect, it } from "vitest";
import { buildAcpPermissionRequest } from "./permission-relay.js";

describe("ACP translator permission relay", () => {
  it("uses approval id as a stable fallback tool-call id", () => {
    const request = buildAcpPermissionRequest({
      sessionId: "session-1",
      event: { approvalId: "approval-1", title: "Run command" },
    });
    expect(request.toolCall.toolCallId).toBe("exec:approval-1");
    expect(request.toolCall._meta).toMatchObject({ toolName: "exec", approvalId: "approval-1" });
  });
});
