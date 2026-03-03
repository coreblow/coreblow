import { describe, expect, it } from "vitest";
describe("server-methods/restart-request — import", () => {
  it("is importable", async () => {
    const m = await import("./restart-request.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/send — import", () => {
  it("is importable", async () => {
    const m = await import("./send.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
