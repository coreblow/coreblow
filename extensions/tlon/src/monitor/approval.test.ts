import { describe, expect, it, vi } from "vitest";
import { createPendingApproval, formatApprovalRequest, parseApprovalResponse } from "./approval.js";

describe("tlon approval helpers", () => {
  it("formats and parses approval requests", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const approval = createPendingApproval({
      type: "dm",
      requestingShip: "~sampel-palnet",
      messagePreview: "hello",
    });

    expect(approval.id).toMatch(/^dm-1234-/);
    expect(formatApprovalRequest(approval)).toContain("~sampel-palnet");
    expect(parseApprovalResponse(`approve ${approval.id}`)).toEqual({
      action: "approve",
      id: approval.id,
    });
  });
});
