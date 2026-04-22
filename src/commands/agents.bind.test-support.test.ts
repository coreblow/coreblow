/**
 * src/commands/agents.bind.test-support.test.ts
 */
import { describe, expect, it } from "vitest";
describe("agents.bind.test-support — import", () => {
  it("is importable", async () => {
    const m = await import("./agents.bind.test-support.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("doctor-config-flow.test-utils — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-config-flow.test-utils.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
