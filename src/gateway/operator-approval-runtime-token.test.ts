import { describe, expect, it } from "vitest";
import {
  getOperatorApprovalRuntimeToken,
  isOperatorApprovalRuntimeToken,
} from "./operator-approval-runtime-token.js";

describe("operator approval runtime token", () => {
  it("creates one process-local runtime token and accepts it", () => {
    const token = getOperatorApprovalRuntimeToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).toBe(getOperatorApprovalRuntimeToken());
    expect(isOperatorApprovalRuntimeToken(token)).toBe(true);
    expect(isOperatorApprovalRuntimeToken(` ${token} `)).toBe(true);
  });

  it("rejects empty, wrong, and different-length tokens", () => {
    expect(isOperatorApprovalRuntimeToken(undefined)).toBe(false);
    expect(isOperatorApprovalRuntimeToken("")).toBe(false);
    expect(isOperatorApprovalRuntimeToken("wrong-token")).toBe(false);
    expect(isOperatorApprovalRuntimeToken(`${getOperatorApprovalRuntimeToken()}x`)).toBe(false);
  });
});
