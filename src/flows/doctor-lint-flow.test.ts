import { describe, expect, it } from "vitest";
import { exitCodeFromFindings, runDoctorLintChecks } from "./doctor-lint-flow.js";
import type { HealthCheck } from "./health-checks.js";
import type { RuntimeEnv } from "../runtime.js";

const runtime: RuntimeEnv = { log: () => {}, error: () => {}, exit: () => {} };

describe("doctor lint flow", () => {
  it("sorts findings by severity and returns warning exit code", async () => {
    const checks: HealthCheck[] = [
      {
        id: "b",
        kind: "core",
        description: "b",
        async detect() {
          return [{ checkId: "b", severity: "info", message: "info" }];
        },
      },
      {
        id: "a",
        kind: "core",
        description: "a",
        async detect() {
          return [{ checkId: "a", severity: "error", message: "error" }];
        },
      },
    ];

    const result = await runDoctorLintChecks({ mode: "lint", cfg: {}, runtime }, { checks });

    expect(result.findings.map((finding) => finding.severity)).toEqual(["error", "info"]);
    expect(exitCodeFromFindings(result.findings)).toBe(1);
  });
});
