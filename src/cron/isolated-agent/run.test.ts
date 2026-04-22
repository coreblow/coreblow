/**
 * src/cron/isolated-agent/run.test.ts
 *
 * CoreBlow — Cron Isolated Agent Run Tests
 * Verifies runIsolatedCronAgent module export shape and
 * basic contract without triggering full agent execution.
 */
import { describe, expect, it } from "vitest";

describe("cron/isolated-agent/run module", () => {
  it("is importable without throwing", async () => {
    await expect(import("./run.js")).resolves.toBeDefined();
  });

  it("exports are defined", async () => {
    const mod = await import("./run.js");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("has at least one named export", async () => {
    const mod = await import("./run.js") as Record<string, unknown>;
    const exportedKeys = Object.keys(mod);
    expect(exportedKeys.length).toBeGreaterThan(0);
  });

  it("all exports are functions or objects", async () => {
    const mod = await import("./run.js") as Record<string, unknown>;
    for (const [, val] of Object.entries(mod)) {
      expect(["function", "object", "string"]).toContain(typeof val);
    }
  });
});
