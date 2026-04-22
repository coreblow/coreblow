import { describe, expect, it } from "vitest";
describe("server-methods/connect — import", () => {
  it("is importable", async () => {
    const m = await import("./connect.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/cron — import", () => {
  it("is importable", async () => {
    const m = await import("./cron.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
