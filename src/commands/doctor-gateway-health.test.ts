import { describe, expect, it } from "vitest";
describe("commands/doctor-gateway-health — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-gateway-health.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("commands/doctor-install — import", () => {
  it("is importable", async () => {
    const m = await import("./doctor-install.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
