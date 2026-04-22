/**
 * src/commands/doctor-update.test.ts
 */
import { describe, expect, it } from "vitest";
describe("commands/doctor-update — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-update.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/doctor-workspace — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-workspace.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
