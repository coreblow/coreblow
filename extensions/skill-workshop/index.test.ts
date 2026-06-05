import { describe, expect, it } from "vitest";
import plugin from "./index.js";
import { createProposalFromMessages } from "./src/signals.js";

describe("skill workshop plugin entry", () => {
  it("exports the plugin and proposal helper", () => {
    expect(plugin.id).toBe("skill-workshop");
    expect(typeof plugin.register).toBe("function");
    expect(typeof createProposalFromMessages).toBe("function");
  });
});
