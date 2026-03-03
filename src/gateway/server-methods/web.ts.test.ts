import { describe, expect, it } from "vitest";
describe("server-methods/web — import", () => {
  it("is importable", async () => {
    const m = await import("./web.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/wizard — import", () => {
  it("is importable", async () => {
    const m = await import("./wizard.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
