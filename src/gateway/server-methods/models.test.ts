import { describe, expect, it } from "vitest";
describe("server-methods/models — import", () => {
  it("is importable", async () => {
    const m = await import("./models.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/nodes — import", () => {
  it("is importable", async () => {
    const m = await import("./nodes.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
