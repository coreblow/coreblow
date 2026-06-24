import { describe, expect, it } from "vitest";
import { resolveApprovalApprovers } from "./approval-approvers.js";

const normalize = (value: string | number) => String(value).trim() || undefined;

describe("resolveApprovalApprovers", () => {
  it("prefers explicit approvers and deduplicates them", () => {
    expect(
      resolveApprovalApprovers({
        explicit: [" owner ", "owner"],
        allowFrom: ["fallback"],
        normalizeApprover: normalize,
      }),
    ).toEqual(["owner"]);
  });

  it("infers approvers from allowlists and default targets", () => {
    expect(
      resolveApprovalApprovers({
        allowFrom: ["owner"],
        extraAllowFrom: [42],
        defaultTo: "alerts",
        normalizeApprover: normalize,
      }),
    ).toEqual(["owner", "42", "alerts"]);
  });
});
