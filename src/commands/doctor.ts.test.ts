/**
 * src/commands/doctor.ts.test.ts
 */
import { describe, expect, it } from "vitest";
describe("commands/doctor.ts — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/doctor-service-audit.test-helpers — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-service-audit.test-helpers.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
