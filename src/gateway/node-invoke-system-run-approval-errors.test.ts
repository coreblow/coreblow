import { describe, it, expect } from "vitest";
import {
  systemRunApprovalGuardError,
  systemRunApprovalRequired,
} from "./node-invoke-system-run-approval-errors.js";

describe("systemRunApprovalGuardError", () => {
  it("creates error with code in details", () => {
    const err = systemRunApprovalGuardError({
      code: "DENIED",
      message: "command denied",
    });
    expect(err.ok).toBe(false);
    expect(err.message).toBe("command denied");
    expect(err.details.code).toBe("DENIED");
  });

  it("merges extra details", () => {
    const err = systemRunApprovalGuardError({
      code: "BLOCKED",
      message: "blocked",
      details: { command: "rm -rf /", reason: "dangerous" },
    });
    expect(err.details.code).toBe("BLOCKED");
    expect(err.details.command).toBe("rm -rf /");
    expect(err.details.reason).toBe("dangerous");
  });

  it("handles missing details", () => {
    const err = systemRunApprovalGuardError({
      code: "ERROR",
      message: "error",
    });
    expect(err.details).toEqual({ code: "ERROR" });
  });
});

describe("systemRunApprovalRequired", () => {
  it("creates approval required error with runId", () => {
    const err = systemRunApprovalRequired("run-123");
    expect(err.ok).toBe(false);
    expect(err.message).toBe("approval required");
    expect(err.details.code).toBe("APPROVAL_REQUIRED");
    expect(err.details.runId).toBe("run-123");
  });
});
