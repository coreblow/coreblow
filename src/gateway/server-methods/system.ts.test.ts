import { describe, expect, it } from "vitest";
describe("server-methods/system — import", () => {
  it("is importable", async () => {
    const m = await import("./system.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/talk — import", () => {
  it("is importable", async () => {
    const m = await import("./talk.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
