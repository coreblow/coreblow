import { describe, expect, it } from "vitest";
import { configValidationIssuesToHealthFindings, CORE_HEALTH_CHECKS } from "./doctor-core-checks.js";

describe("doctor core checks", () => {
  it("maps config validation issues into health findings", () => {
    expect(
      configValidationIssuesToHealthFindings([{ path: "gateway.mode", message: "bad mode" }]),
    ).toEqual([
      {
        checkId: "core/doctor/final-config-validation",
        severity: "error",
        message: "bad mode",
        path: "gateway.mode",
      },
    ]);
  });

  it("includes gateway config health check", () => {
    expect(CORE_HEALTH_CHECKS.map((check) => check.id)).toContain("core/doctor/gateway-config");
  });
});
