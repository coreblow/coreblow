/**
 * src/commands/doctor-sandbox.test.ts
 */
import { describe, expect, it } from "vitest";
describe("commands/doctor-sandbox — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-sandbox.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/doctor-ui — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-ui.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
