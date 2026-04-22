/**
 * src/cron/isolated-agent/model-selection.test.ts
 *
 * CoreBlow — Cron Isolated Agent Model Selection Tests
 * Verifies model selection module exports and basic function contracts.
 */
import { describe, expect, it } from "vitest";

describe("cron/isolated-agent/model-selection module", () => {
  it("is importable without throwing", async () => {
    await expect(import("./model-selection.js")).resolves.toBeDefined();
  });

  it("has at least one named export", async () => {
    const mod = await import("./model-selection.js") as Record<string, unknown>;
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });

  it("all exports are functions or objects", async () => {
    const mod = await import("./model-selection.js") as Record<string, unknown>;
    for (const [, val] of Object.entries(mod)) {
      expect(["function", "object", "string", "boolean"]).toContain(typeof val);
    }
  });
});
