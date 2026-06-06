import { describe, expect, it } from "vitest";
import { defineToolDescriptor } from "./descriptors.js";
import { buildToolPlan } from "./planner.js";

describe("tools parity boundary", () => {
  it("keeps descriptor planning independent from executor implementation", () => {
    const descriptor = defineToolDescriptor({
      name: "core_status",
      description: "Read CoreBlow status",
      inputSchema: { type: "object" },
      owner: { kind: "core" },
      executor: { kind: "core", executorId: "core_status" },
    });

    const plan = buildToolPlan({ descriptors: [descriptor] });

    expect(plan.visible).toHaveLength(1);
    expect(plan.hidden).toHaveLength(0);
  });
});
