import { describe, expect, it } from "vitest";
import { runDoctorHealthRepairs } from "./doctor-repair-flow.js";
import type { HealthCheck } from "./health-checks.js";
import type { RuntimeEnv } from "../runtime.js";

const runtime: RuntimeEnv = { log: () => {}, error: () => {}, exit: () => {} };

describe("doctor repair flow", () => {
  it("applies repaired config and validates scoped findings", async () => {
    const checks: HealthCheck[] = [
      {
        id: "repairable",
        kind: "core",
        description: "repairable",
        async detect(_ctx, scope) {
          return scope
            ? []
            : [{ checkId: "repairable", severity: "warning", message: "fix me", path: "x" }];
        },
        async repair(ctx) {
          return { config: { ...ctx.cfg, gateway: { mode: "local" } }, changes: ["set gateway"] };
        },
      },
    ];

    const result = await runDoctorHealthRepairs(
      { mode: "fix", cfg: {}, runtime },
      { checks },
    );

    expect(result.config.gateway?.mode).toBe("local");
    expect(result.changes).toEqual(["set gateway"]);
    expect(result.checksValidated).toBe(1);
  });
});
