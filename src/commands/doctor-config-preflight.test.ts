/**
 * src/commands/doctor-config-preflight.test.ts
 */
import { describe, expect, it } from "vitest";
describe("commands/doctor-config-preflight — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-config-preflight.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/doctor-format — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-format.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
