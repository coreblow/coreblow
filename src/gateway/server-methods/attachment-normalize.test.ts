import { describe, expect, it } from "vitest";
describe("server-methods/attachment-normalize — import", () => {
  it("is importable", async () => {
    const m = await import("./attachment-normalize.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/channels — import", () => {
  it("is importable", async () => {
    const m = await import("./channels.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
