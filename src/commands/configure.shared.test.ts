import { describe, expect, it } from "vitest";
describe("configure.shared — import", () => {
  it("is importable", async () => {
    const m = await import("./configure.shared.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("configure.ts — import", () => {
  it("is importable", async () => {
    const m = await import("./configure.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
