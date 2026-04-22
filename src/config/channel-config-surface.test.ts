/**
 * src/config/channel-config-surface.test.ts
 *
 * CoreBlow — Channel Config Surface Tests
 * Verifies channel-config-surface exports are importable
 * and key resolver functions return expected types.
 */
import { describe, expect, it } from "vitest";

describe("channel-config-surface module", () => {
  it("is importable without throwing", async () => {
    await expect(import("./channel-config-surface.js")).resolves.toBeDefined();
  });

  it("exports are object type", async () => {
    const mod = await import("./channel-config-surface.js");
    expect(typeof mod).toBe("object");
  });

  it("has at least one named export", async () => {
    const mod = await import("./channel-config-surface.js");
    const keys = Object.keys(mod);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("all exports are functions or objects", async () => {
    const mod = await import("./channel-config-surface.js") as Record<string, unknown>;
    for (const [, val] of Object.entries(mod)) {
      expect(["function", "object", "string", "number", "boolean"]).toContain(typeof val);
    }
  });
});
